import { prisma } from '@newranews/database';
import { PRODUCT_EVENT_RETENTION_DAYS } from '@newranews/types';
import type {
  InvariantId,
  InvariantMeasure,
  InvariantReport,
  InvariantResult,
} from '@newranews/types';
import { z } from 'zod';
import { AppError } from '../utils/errors';
import { yieldToEventLoop } from '../utils/event-loop';
import { scrubMessage } from '../utils/logger';
import { AUDIT_EVENT_RETENTION_DAYS } from './audit.service';
import {
  ERROR_EVENT_RETENTION_DAYS,
  INVARIANT_VIOLATED_CODE,
  recordError,
} from './error-event.service';
import {
  ARTICLE_RETENTION_DAYS,
  NEWS_RETENTION_DAYS,
  PIPELINE_LOG_RETENTION_DAYS,
} from './retention';
import { STALE_RUN_MS } from './run-outcome';
import { SOURCE_HEALTH_RETENTION_DAYS } from './source-health.service';

/**
 * **As invariantes do sistema — §10 do plano de observabilidade, Fase 6.**
 *
 * O que a fase fecha: as etapas 7.5, 8, 8.5 e 9 engolem a própria falha de
 * propósito, para o run terminar — e nada nunca perguntava *"o que deveria
 * ter acontecido aconteceu?"*. A retenção podia parar de funcionar por um mês
 * e o primeiro sintoma seria uma conta do Neon; o dia sem briefing de
 * 01/09/2026 teve como único sinal o briefing ausente.
 *
 * Roda como **etapa 9.5**, depois de a etapa 9 gravar a métrica do dia e
 * antes de o run virar `SUCCESS`. Cada invariante é **uma consulta agregada
 * sobre coluna indexada** — `aggregate`, `count`, ou um `findMany` de uma
 * coluna só e ≤ 31 linhas —, e a suíte **cede o event loop entre uma e outra**
 * pelo mesmo `yieldToEventLoop` da etapa 8.5. É a lição de 03/09/2026 escrita
 * na forma: suíte de invariante é exatamente o tipo de coisa que vira
 * varredura sem ninguém perceber, e o sintoma seria um `SIGTERM`, não um
 * teste lento. A guarda em `tests/services/invariants.service.test.ts` cobra
 * as duas coisas pelo parser: nenhuma consulta carrega linha, e o loop gira
 * no meio.
 *
 * ## Para onde o resultado vai
 *
 * Zero tabela nova. O relatório inteiro é o `context` de **um
 * `PipelineEvent`** da etapa 9.5 (`INFO` — ou `WARN`, se alguma consulta
 * lançou), que a tela de detalhe de um run já mostra; e cada violação é **um
 * `recordError({ origin: 'INVARIANT' })`**, com o id da invariante como
 * `route` do fingerprint — uma violação que dura dez dias são dez linhas na
 * tabela de falhas, uma por run. `GET /api/admin/invariants` lê o último
 * evento em vez de rodar a suíte de novo: atualizar a tela não pode disparar
 * doze consultas em 0.1 vCPU.
 *
 * ## Violação não degrada o run — e a decisão está escrita
 *
 * O run não é o que falhou; o que falhou é o que uma etapa **anterior**
 * deveria ter feito. A linha vermelha mora na tabela de falhas (por
 * invariante) e no painel de invariantes, não no desfecho do dia. O que
 * degrada o run é a **suíte** não conseguir perguntar: uma consulta que lança
 * sai como `ERROR` no resultado, e a etapa emite `WARN` com
 * `degradedBy.push(9.5)` — porque aí o que não aconteceu foi a checagem.
 *
 * ## O orçamento é por tempo e por forma, não por contagem
 *
 * A §10 dizia "no máximo 10 consultas agregadas"; o inventário reconferido em
 * 16/09 achou onze, e esta implementação tem **doze** — a etapa 8 expurga
 * sete tabelas, e a lista tinha retenção para seis. Os sete `MIN(coluna)` são
 * os `aggregate` mais baratos que existem, cada um num índice. O que o
 * orçamento protege é o event loop, então ele vale por {@link INVARIANTS_BUDGET_MS}
 * de relógio e pela forma de cada consulta — e o relatório carrega a duração
 * para a tela dizer quanto sobrou.
 */

/** A etapa em que a suíte roda. É o `stage` do evento que a rota lê. */
export const INVARIANTS_STAGE = 9.5;

/**
 * O teto de relógio da suíte inteira. Estourar não é "teste lento": é uma
 * invariante que virou varredura, e o próximo sintoma é o health check do
 * Render deixando de ser respondido.
 */
export const INVARIANTS_BUDGET_MS = 2_000;

/**
 * A janela dos invariantes de briefing e de newsletter. Uma semana é o que
 * separa "ontem falhou" (o `WARN` da etapa já disse) de "está falhando" (o
 * que a invariante existe para dizer), sem alcançar a retenção de nada.
 */
const RECENT_DAYS = 7;

/**
 * A janela do `metrics.day_recorded`: os runs que ainda existem. `PipelineLog`
 * vive {@link PIPELINE_LOG_RETENTION_DAYS}; pedir mais compararia dias que o
 * expurgo já esvaziou de um lado só.
 */
const METRICS_DAYS = PIPELINE_LOG_RETENTION_DAYS;

interface InvariantContext {
  pipelineLogId: string;
  now: Date;
}

/** O que uma consulta devolve; o resto do resultado é montado aqui. */
interface InvariantOutcome {
  observed: number | string | null;
  expected: number | string;
  ok: boolean;
  detail?: string;
}

interface InvariantDefinition {
  id: InvariantId;
  measure: InvariantMeasure;
  check: (context: InvariantContext) => Promise<InvariantOutcome>;
}

function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 86_400_000);
}

/** `YYYY-MM-DD` em UTC — a chave de "que dia é" para o run e para a métrica. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Uma invariante de retenção: o instante mais antigo na tabela tem de ser
 * mais novo que `retention + 1` dias.
 *
 * **O dia a mais é a folga entre dois runs**, e não tolerância: a etapa 8
 * corta em `now - retention` e a 9.5 pergunta logo depois, então com o
 * expurgo funcionando o mínimo é `≥ now - retention` com sobra. Se a etapa 8
 * de hoje falhou — com o próprio `WARN` —, o mínimo é o corte de **ontem**,
 * `≈ now - retention - 1 dia`, na fronteira do limiar; no segundo dia sem
 * expurgo a violação é certa, porque a ingestão de todo dia deixa linha entre
 * os dois cortes. O que a invariante pega é a etapa 8 parada **em silêncio**
 * — o `deleteMany` que roda e não apaga —, e essa reprova no dia seguinte.
 *
 * Tabela vazia é `null`, e `null` passa: não há nada retido além do prazo.
 */
function retentionOf(
  id: InvariantId,
  retentionDays: number,
  oldest: (since: Date) => Promise<Date | null>,
): InvariantDefinition & { retentionDays: number } {
  return {
    id,
    measure: 'oldest',
    retentionDays,
    check: async ({ now }) => {
      const threshold = daysBefore(now, retentionDays + 1);
      const min = await oldest(threshold);
      return {
        observed: min?.toISOString() ?? null,
        expected: threshold.toISOString(),
        ok: min === null || min.getTime() >= threshold.getTime(),
      };
    },
  };
}

/**
 * As sete retenções, na ordem da etapa 8. **Uma por tabela que a etapa
 * expurga** — a guarda compara esta lista com o `Promise.all` do cleanup, para
 * que a próxima tabela com expurgo nasça com a invariante ao lado.
 */
export const RETENTION_INVARIANTS = [
  retentionOf('retention.news', NEWS_RETENTION_DAYS, async () => {
    const { _min } = await prisma.news.aggregate({ _min: { createdAt: true } });
    return _min.createdAt;
  }),
  retentionOf('retention.pipelineLog', PIPELINE_LOG_RETENTION_DAYS, async () => {
    const { _min } = await prisma.pipelineLog.aggregate({ _min: { startedAt: true } });
    return _min.startedAt;
  }),
  retentionOf('retention.article', ARTICLE_RETENTION_DAYS, async () => {
    const { _min } = await prisma.article.aggregate({ _min: { createdAt: true } });
    return _min.createdAt;
  }),
  retentionOf('retention.productEvent', PRODUCT_EVENT_RETENTION_DAYS, async () => {
    const { _min } = await prisma.productEvent.aggregate({ _min: { occurredAt: true } });
    return _min.occurredAt;
  }),
  retentionOf('retention.errorEvent', ERROR_EVENT_RETENTION_DAYS, async () => {
    const { _min } = await prisma.errorEvent.aggregate({ _min: { windowStart: true } });
    return _min.windowStart;
  }),
  retentionOf('retention.auditEvent', AUDIT_EVENT_RETENTION_DAYS, async () => {
    const { _min } = await prisma.auditEvent.aggregate({ _min: { createdAt: true } });
    return _min.createdAt;
  }),
  retentionOf('retention.sourceHealth', SOURCE_HEALTH_RETENTION_DAYS, async () => {
    const { _min } = await prisma.sourceHealth.aggregate({ _min: { day: true } });
    return _min.day;
  }),
];

/**
 * A tabela de definições, na ordem em que a suíte roda e em que a tela lista.
 *
 * Uma invariante nova entra aqui, em `InvariantId` (`packages/types`) e nos
 * dois arquivos de mensagem do web — e em nenhum outro lugar.
 */
const INVARIANTS: InvariantDefinition[] = [
  ...RETENTION_INVARIANTS,
  {
    /**
     * Sete datas distintas de `Article` nos últimos sete dias. É **a falha de
     * 01/09/2026**, cujo único sinal foi o briefing ausente: o cron estourou o
     * prazo acordando a API, e nenhuma linha em lugar nenhum disse que o dia
     * ficou sem. `date` é `@unique`, então contar é contar dias distintos.
     */
    id: 'briefing.one_per_day',
    measure: 'count',
    check: async ({ now }) => {
      const today = startOfDay(now);
      const since = daysBefore(today, RECENT_DAYS - 1);
      const count = await prisma.article.count({
        where: { date: { gte: since, lte: today } },
      });
      return { observed: count, expected: RECENT_DAYS, ok: count === RECENT_DAYS };
    },
  },
  {
    /**
     * Todo briefing da semana tem lista de fontes — a auditoria da §18.4 do
     * plano da V2, **conferida** em vez de suposta. `persistBriefingSources`
     * grava com `newsId` nulo quando a URL não resolve, justamente para a
     * lista nunca ficar vazia; se ficou, algo pulou a etapa 7.
     */
    id: 'briefing.has_sources',
    measure: 'count',
    check: async ({ now }) => {
      const today = startOfDay(now);
      const since = daysBefore(today, RECENT_DAYS - 1);
      const count = await prisma.article.count({
        where: { date: { gte: since, lte: today }, sources: { none: {} } },
      });
      return { observed: count, expected: 0, ok: count === 0 };
    },
  },
  {
    /**
     * Nenhum `RUNNING` mais velho que {@link STALE_RUN_MS} — o cadáver,
     * **antes** de ele travar o disparo de amanhã. O `triggerPipeline` o
     * enterra ao disparar; esta pergunta chega um dia antes. O run corrente
     * fica de fora: ele está `RUNNING` porque está rodando.
     */
    id: 'pipeline.no_stale_running',
    measure: 'count',
    check: async ({ now, pipelineLogId }) => {
      const count = await prisma.pipelineLog.count({
        where: {
          status: 'RUNNING',
          startedAt: { lt: new Date(now.getTime() - STALE_RUN_MS) },
          id: { not: pipelineLogId },
        },
      });
      return { observed: count, expected: 0, ok: count === 0 };
    },
  },
  {
    /**
     * Todo dia com run `SUCCESS` tem a sua linha de `DailyMetric` — a etapa 9
     * engolindo a própria falha. Agrupar `startedAt` por dia pede
     * `date_trunc`, que o `groupBy` do Prisma não faz; a saída honesta são
     * dois `findMany` de **uma coluna** e no máximo 31 linhas cada, comparados
     * em memória. O run de hoje ainda está `RUNNING` quando isto roda, então o
     * dia de hoje não entra — a métrica dele acabou de ser gravada pela 9, e o
     * `WARN` dela é quem fala se não foi.
     */
    id: 'metrics.day_recorded',
    measure: 'count',
    check: async ({ now }) => {
      const since = startOfDay(daysBefore(now, METRICS_DAYS));
      const [runs, metrics] = await Promise.all([
        prisma.pipelineLog.findMany({
          where: { status: 'SUCCESS', startedAt: { gte: since } },
          select: { startedAt: true },
        }),
        prisma.dailyMetric.findMany({
          where: { date: { gte: since } },
          select: { date: true },
        }),
      ]);
      const recorded = new Set(metrics.map((metric) => dayKey(metric.date)));
      const missing = [...new Set(runs.map((run) => dayKey(run.startedAt)))]
        .filter((day) => !recorded.has(day))
        .sort();
      return {
        observed: missing.length,
        expected: 0,
        ok: missing.length === 0,
        ...(missing.length > 0 ? { detail: missing.join(', ') } : {}),
      };
    },
  },
  {
    /**
     * Nenhum dia da semana em que havia assinante para receber e ninguém
     * recebeu. `total` é quantos estavam ativos na hora do envio; `sent: 0`
     * com `total > 0` é a newsletter que não entrega — hoje uma frase no
     * `CLAUDE.md` ("o domínio nunca foi verificado no Resend"), aqui uma linha
     * vermelha numa tela. Dia sem assinante (`total: 0`) não conta: não havia
     * a quem entregar.
     */
    id: 'newsletter.delivered',
    measure: 'count',
    check: async ({ now }) => {
      const today = startOfDay(now);
      const since = daysBefore(today, RECENT_DAYS - 1);
      const count = await prisma.newsletterLog.count({
        where: { date: { gte: since, lte: today }, total: { gt: 0 }, sent: 0 },
      });
      return { observed: count, expected: 0, ok: count === 0 };
    },
  },
];

/** Os ids, na ordem da tabela. Para a guarda e para quem lista. */
export const INVARIANT_IDS: readonly InvariantId[] = INVARIANTS.map((invariant) => invariant.id);

/**
 * O que a etapa 9.5 grava no `context` do evento — o relatório sem os dois
 * campos que vêm do próprio evento (`checkedAt` é o `createdAt`,
 * `pipelineLogId` é a coluna).
 */
export type InvariantRun = Omit<InvariantReport, 'checkedAt' | 'pipelineLogId'>;

/**
 * Roda a suíte inteira. **Nunca lança**: uma consulta que lança vira `ERROR`
 * naquele resultado, e as outras continuam — quem chama decide o nível do
 * evento pelo `errored`.
 *
 * `await yieldToEventLoop()` **antes de cada** consulta, e não só entre duas:
 * a primeira também chega depois de a etapa 9 ter acabado de ir ao banco.
 */
export async function runInvariants(
  context: { pipelineLogId: string; now?: Date },
): Promise<InvariantRun> {
  const now = context.now ?? new Date();
  const ctx: InvariantContext = { pipelineLogId: context.pipelineLogId, now };
  const startedAt = Date.now();
  const results: InvariantResult[] = [];

  for (const invariant of INVARIANTS) {
    await yieldToEventLoop();
    const checkStartedAt = Date.now();
    try {
      const outcome = await invariant.check(ctx);
      const result: InvariantResult = {
        id: invariant.id,
        status: outcome.ok ? 'OK' : 'VIOLATED',
        measure: invariant.measure,
        observed: outcome.observed,
        expected: outcome.expected,
        detail: outcome.detail ?? null,
        error: null,
        durationMs: Date.now() - checkStartedAt,
      };
      results.push(result);
      if (!outcome.ok) recordViolation(result, ctx);
    } catch (error) {
      results.push({
        id: invariant.id,
        status: 'ERROR',
        measure: invariant.measure,
        observed: null,
        expected: invariant.measure === 'count' ? 0 : '',
        detail: null,
        error: scrubMessage(error instanceof Error ? error.message : String(error)),
        durationMs: Date.now() - checkStartedAt,
      });
    }
  }

  return {
    checked: results.length,
    violated: results.filter((result) => result.status === 'VIOLATED').length,
    errored: results.filter((result) => result.status === 'ERROR').length,
    durationMs: Date.now() - startedAt,
    budgetMs: INVARIANTS_BUDGET_MS,
    results,
  };
}

/**
 * Uma violação, uma linha por `(invariante, hora)` — e o id no `route`, que
 * é o que dá o teto: a tabela cresce com invariantes × runs, nunca com o
 * tamanho do que a consulta mediu. `WARN`, porque a retenção parada é
 * degradação e não quebra; `ERROR` faria a tabela de falhas gritar por uma
 * linha que dura dias. `category: 'contract'` é a da taxonomia para "o dado
 * não casa com o que foi prometido — forma de resposta, **invariante**".
 */
function recordViolation(result: InvariantResult, ctx: InvariantContext): void {
  recordError(
    {
      origin: 'INVARIANT',
      severity: 'WARN',
      code: INVARIANT_VIOLATED_CODE,
      category: 'contract',
      message: `${result.id}: observed ${String(result.observed)}, expected ${
        result.measure === 'oldest' ? '>= ' : ''
      }${String(result.expected)}`,
      route: result.id,
      pipelineLogId: ctx.pipelineLogId,
      context: {
        observed: result.observed,
        expected: result.expected,
        ...(result.detail !== null ? { detail: result.detail } : {}),
      },
    },
    // O relógio da suíte, e não o do `recordError`: a hora da linha é a hora
    // em que a pergunta foi feita, e os dois têm de concordar.
    ctx.now,
  );
}

// ── Leitura ─────────────────────────────────────────────────────────────────

const invariantIdSchema = z.enum([
  'retention.news',
  'retention.pipelineLog',
  'retention.article',
  'retention.productEvent',
  'retention.errorEvent',
  'retention.auditEvent',
  'retention.sourceHealth',
  'briefing.one_per_day',
  'briefing.has_sources',
  'pipeline.no_stale_running',
  'metrics.day_recorded',
  'newsletter.delivered',
]);

/**
 * A forma do `context` que a etapa 9.5 grava. É o mesmo schema que
 * `routes/admin/schemas.ts` usa na resposta, menos os dois campos do evento —
 * ler com ele é o que garante que o que sai pela rota é o que foi gravado, e
 * não o que o serializador deixou passar.
 */
export const invariantRunSchema = z.object({
  checked: z.number().int(),
  violated: z.number().int(),
  errored: z.number().int(),
  durationMs: z.number().int(),
  budgetMs: z.number().int(),
  results: z.array(
    z.object({
      id: invariantIdSchema,
      status: z.enum(['OK', 'VIOLATED', 'ERROR']),
      measure: z.enum(['count', 'oldest']),
      observed: z.union([z.number(), z.string(), z.null()]),
      expected: z.union([z.number(), z.string()]),
      detail: z.string().nullable(),
      error: z.string().nullable(),
      durationMs: z.number().int(),
    }),
  ),
});

/**
 * O último relatório — o evento mais recente da etapa 9.5, de qualquer run.
 * `null` antes do primeiro run com a etapa; a tela diz "nenhuma verificação
 * ainda", que é diferente de "indisponível".
 *
 * **Lê o evento, não roda a suíte.** `PipelineEvent` tem índice em `stage` e
 * em `createdAt`; é um `findFirst`. Um `context` que não parseia é contrato
 * quebrado entre quem grava e quem lê — os dois moram neste arquivo —, e sai
 * como 500 com `category: 'contract'`, nunca como "nenhuma verificação".
 */
export async function getLatestInvariantReport(): Promise<InvariantReport | null> {
  const event = await prisma.pipelineEvent.findFirst({
    where: { stage: INVARIANTS_STAGE },
    orderBy: { createdAt: 'desc' },
    select: { context: true, createdAt: true, pipelineLogId: true },
  });
  if (!event) return null;

  const parsed = invariantRunSchema.safeParse(event.context);
  if (!parsed.success) {
    throw new AppError('Invariant report is malformed', 500, {
      category: 'contract',
      context: { pipelineLogId: event.pipelineLogId, issue: parsed.error.issues[0]?.message ?? '' },
    });
  }

  return {
    checkedAt: event.createdAt.toISOString(),
    pipelineLogId: event.pipelineLogId,
    ...parsed.data,
  };
}
