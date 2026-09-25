import { prisma, Prisma } from '@newranews/database';
import { fetchAll } from './news-fetcher.service';
import { generateArticle } from './ai.service';
import { sendDailyNewsletter } from './newsletter.service';
import { renormalizeStoredNews } from './news-renormalizer.service';
import { deleteExpiredProductEvents } from './product-event.service';
import { deleteExpiredErrorEvents } from './error-event.service';
import { deleteExpiredAuditEvents } from './audit.service';
import {
  buildSourceHealthRows,
  countKeptBySource,
  deleteExpiredSourceHealth,
  recordSourceHealth,
} from './source-health.service';
import { extractErrorDetail, logPipelineEvent } from './pipeline-event.service';
import { STALE_RUN_MS, isDegradingFetchWarning } from './run-outcome';
import {
  ARTICLE_RETENTION_DAYS,
  NEWS_RETENTION_DAYS,
  PIPELINE_LOG_RETENTION_DAYS,
} from './retention';
import { runInvariants } from './invariants.service';
import {
  GateBlockedError,
  WIDENED_SELECTION,
  evaluateEntryGate,
  loadEntryBaseline,
} from './pipeline-gates.service';
import { ARTICLE_PROMPT_VERSION } from '../config/ai-prompts';
import type { RawNewsItem } from '../providers/types';
import type { PipelineTrigger } from '@newranews/types';
import { baseLogger, pipelineContext } from '../utils/logger';

// ── Helpers ────────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Grava a lista de fontes do briefing (plano V2 §18.4).
 *
 * Substitui as fontes em vez de acrescentar: o artigo é um upsert por data, e
 * uma segunda execução no mesmo dia escolhe outro conjunto de notícias — sem a
 * remoção, o briefing acumularia as fontes dos dois runs.
 *
 * O `newsId` é resolvido por `sourceUrl` (que é `@unique` em News) porque o
 * `createMany` do Stage 4 não devolve ids. Quando não resolve, a fonte é
 * gravada mesmo assim com `newsId` nulo — perder o registro de auditoria é pior
 * que perder o ponteiro, e os campos que a interface mostra estão todos aqui.
 */
async function persistBriefingSources(
  articleId: string,
  selected: RawNewsItem[],
): Promise<number> {
  const rows = await prisma.news.findMany({
    where: { sourceUrl: { in: selected.map((item) => item.sourceUrl) } },
    select: { id: true, sourceUrl: true },
  });
  const idByUrl = new Map(rows.map((row) => [row.sourceUrl, row.id]));

  const data = selected.map((item, index) => ({
    articleId,
    newsId: idByUrl.get(item.sourceUrl) ?? null,
    position: index,
    title: item.title,
    source: item.source,
    sourceUrl: item.sourceUrl,
  }));

  await prisma.$transaction([
    prisma.briefingSource.deleteMany({ where: { articleId } }),
    prisma.briefingSource.createMany({ data }),
  ]);

  return data.length;
}

function deduplicateByUrl(items: RawNewsItem[]): RawNewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.sourceUrl)) return false;
    seen.add(item.sourceUrl);
    return true;
  });
}

function countByCategory(items: RawNewsItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  return counts;
}

function selectTopItems(items: RawNewsItem[], limit = 15): RawNewsItem[] {
  return [...items]
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, limit);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Marca `FAILED` um run que ficou em `RUNNING` além de {@link STALE_RUN_MS}.
 *
 * `errorStage` fica **null de propósito**: o processo morreu sem escrever, e
 * o `currentStage` foi embora com ele. Chutar uma etapa aqui poria no banco
 * um número que ninguém mediu — a etapa real, quando existe, sai dos
 * `PipelineEvent` que o run alcançou a gravar.
 */
async function buryDeadRun(run: { id: string; startedAt: Date }): Promise<void> {
  const staleForMs = Date.now() - run.startedAt.getTime();
  const detail = {
    message: `Run marked FAILED after ${Math.round(staleForMs / 60_000)} min in RUNNING with no completion — the process very likely died mid-run (SIGTERM, OOM or restart).`,
    reason: 'stale-running',
  };
  await prisma.pipelineLog.update({
    where: { id: run.id },
    data: {
      status: 'FAILED',
      error: detail.message,
      errorDetail: detail as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  });
  // Etapa 0: o evento é sobre o run inteiro, não sobre uma das etapas — e 0
  // não colide com nenhuma delas.
  await logPipelineEvent(run.id, 0, 'ERROR', detail.message, {
    ...detail,
    startedAt: run.startedAt.toISOString(),
  });
}

/**
 * Dispara o pipeline do dia — **ou diz que não disparou**.
 *
 * A idempotência por dia é antiga e continua certa: o cron das 11h UTC e o
 * botão do painel apontam para a mesma função, e dois runs no mesmo dia
 * gerariam o briefing duas vezes e gastariam duas chamadas de IA.
 *
 * **O que mudou é a resposta.** Ela devolvia só o id, e quem chamava não tinha
 * como saber se aquele id era do run que acabara de nascer ou do que já tinha
 * fechado horas antes — os dois casos chegavam ao painel como "disparado com
 * sucesso". Devolver o desfecho é o que permite a tela dizer a verdade; ver
 * `PipelineTriggerOutcome` em `packages/types`, onde o episódio está datado.
 */
export async function triggerPipeline(): Promise<PipelineTrigger> {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  /**
   * **Todo cadáver, de qualquer dia, antes de olhar o de hoje.** O enterro só
   * alcançava o run **de hoje** — o `findFirst` abaixo é na janela do dia —, e
   * o de 03/09/2026 (o `SIGTERM` no meio da 8.5) ficou `RUNNING` no banco de
   * produção por três semanas: a faixa de 30 dias o desenhava como "rodando" e
   * a invariante `pipeline.no_stale_running` reprovava em todo run. Achado do
   * ensaio de aceitação (Fase 12, M7a). O corte é o prazo, não o dia: um run
   * de ontem às 23:55 que ainda roda às 00:05 está vivo.
   */
  const dead = await prisma.pipelineLog.findMany({
    where: { status: 'RUNNING', startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) } },
    select: { id: true, startedAt: true },
    orderBy: { startedAt: 'asc' },
    take: 20,
  });
  for (const run of dead) await buryDeadRun(run);

  // Idempotency: skip if pipeline already succeeded or is running today
  const existingLog = await prisma.pipelineLog.findFirst({
    where: {
      startedAt: { gte: today, lt: tomorrow },
      status: { in: ['SUCCESS', 'RUNNING'] },
    },
  });
  if (existingLog) {
    const staleForMs = Date.now() - existingLog.startedAt.getTime();
    const isStale = existingLog.status === 'RUNNING' && staleForMs > STALE_RUN_MS;

    if (!isStale) {
      return {
        // Os dois merecem frases diferentes na tela: "já está rodando, espere" e
        // "já rodou, não vai rodar de novo hoje" levam a ações opostas.
        outcome:
          existingLog.status === 'RUNNING'
            ? 'already-running'
            : 'already-succeeded-today',
        pipelineId: existingLog.id,
        startedAt: existingLog.startedAt.toISOString(),
      };
    }

    // Enterra o cadáver antes de seguir. Ver `STALE_RUN_MS`. (A varredura de
    // cima já o teria levado; este ramo cobre a corrida entre as duas leituras.)
    await buryDeadRun(existingLog);

    // E segue para criar um run novo: o desfecho é `started` porque é o que
    // este chamado fez. Que havia um cadáver no caminho é história do run
    // velho, e está gravada nele — não no contrato de quem acabou de disparar.
  }

  const log = await prisma.pipelineLog.create({
    data: { status: 'RUNNING' },
  });

  void runPipeline(log.id).catch((err: unknown) => {
    baseLogger.error({ err, pipelineLogId: log.id }, '[pipeline] unhandled error');
  });

  return {
    outcome: 'started',
    pipelineId: log.id,
    startedAt: log.startedAt.toISOString(),
  };
}

// ── Core pipeline ───────────────────────────────────────────────────────────

/**
 * **Toda linha de log do run carrega o id do run, e nenhuma assinatura mudou.**
 *
 * As etapas chamam services que chamam providers; os cinco avisos do
 * `news-fetcher`, os dois do `rss.provider`, os dois do `newsdata.provider` e o
 * retry do `ai-utils` são escritos três camadas abaixo daqui. Passar um logger
 * por essas camadas seria correlação por intenção — basta uma camada esquecer o
 * parâmetro para o rastro sumir sem nada acusar. O `AsyncLocalStorage` fica
 * ligado a este `run`, e o `mixin` do pino o lê de dentro de qualquer
 * profundidade. Ver `utils/logger.ts`.
 */
async function runPipeline(pipelineLogId: string): Promise<void> {
  return pipelineContext.run({ pipelineLogId }, () => runPipelineStages(pipelineLogId));
}

async function runPipelineStages(pipelineLogId: string): Promise<void> {
  const startedAt = Date.now();
  const today = startOfDay(new Date());

  // Etapa atual — usada para gravar o errorStage quando o pipeline falha. O
  // inicializador **é** a etapa 1: a primeira coisa que o `try` faz é a coleta,
  // e reatribuir ali era o `useless-assignment-to-local` que o CodeQL apontava
  // desde 05/09.
  let currentStage = 1;

  const metrics = {
    newsDataCount: 0,
    rssCount: 0,
    newsCollected: 0,
    newsByCategory: {} as Record<string, number>,
    articleGenerated: false,
    aiProvider: undefined as string | undefined,
    cleanupCount: 0,
    pipelineErrors: 0,
  };

  // **As etapas que engoliram a própria falha, na ordem em que aconteceu.**
  // (Fase 8) É o que o evento final da etapa 9 escreve em `degradedBy`, e o
  // que faz o `SUCCESS_DEGRADED` dizer *qual* etapa. A API deriva o mesmo
  // campo dos eventos gravados (`run-outcome.ts`), e há teste cobrando que as
  // duas contas batam — um `WARN` novo que não entre aqui aparece na
  // listagem e não no resumo, e é assim que se descobre.
  const degradedBy: number[] = [];

  // O que as etapas não-críticas devolvem sobe de escopo para chegar ao
  // resumo: o resultado da newsletter vive dentro do `try` da 7.5 e o da
  // renormalização dentro do da 8.5. `'failed'` é o valor quando a etapa
  // lançou — o service da newsletter não distingue "pulado por idempotência"
  // de "zero assinantes" (devolve os números do log do dia nos dois casos),
  // então "devolveu" e "lançou" é a única distinção que a etapa sabe fazer.
  let newsletterSummary: { total: number; sent: number; failed: number } | 'failed' = 'failed';
  let renormalized: { scanned: number; changed: number } | 'failed' = 'failed';
  let invariants: { checked: number; violated: number; errored: number } | 'failed' = 'failed';

  try {
    // Stage 1: Collect news (NewsData.io + RSS) — `currentStage` já é 1.
    const { newsDataItems, rssItems, allItems, warnings, sources } = await fetchAll();
    metrics.newsDataCount = newsDataItems.length;
    metrics.rssCount = rssItems.length;
    await logPipelineEvent(pipelineLogId, 1, 'INFO', 'News collected', {
      newsDataCount: newsDataItems.length,
      rssCount: rssItems.length,
      total: allItems.length,
    });

    // **A colheita degradada vira registro, e não só um número menor.**
    //
    // Um provider que falha ou volta vazio não aborta o dia — e é justamente
    // por isso que ele sumia: o run seguia para `SUCCESS` com metade das
    // notícias, indistinguível de um dia bom, e o único rastro era um
    // `console.warn` no stdout do Render, que ninguém lê. Aqui ele passa a
    // caber no `PipelineEvent` (visível em `GET /api/dev/logs/:id`) e a
    // contar em `DailyMetric.pipelineErrors`.
    //
    // **Só o nível de provider conta como erro.** Feed especializado que
    // publica devagar fica legitimamente vazio em dia comum — contá-lo faria a
    // luz acender todos os dias, e luz que acende todo dia é luz que se
    // aprende a ignorar. Ele é gravado no evento assim mesmo, porque a fonte
    // que morreu de vez só aparece na sequência de dias vazios (foi como a
    // `Reuters` passou despercebida).
    //
    // A linha entre os dois mora em `isDegradingFetchWarning`, junto do
    // desfecho da Fase 8 — a mesma função conta o erro aqui e decide se o dia
    // saiu `SUCCESS_DEGRADED` lá.
    if (warnings.length > 0) {
      const degrading = warnings.filter(isDegradingFetchWarning).length;
      metrics.pipelineErrors += degrading;
      if (degrading > 0) degradedBy.push(1);
      await logPipelineEvent(pipelineLogId, 1, 'WARN', 'Collection degraded', {
        warnings,
      });
    }

    // Stage 2: Normalization already handled by providers (RawNewsItem format)

    // Stage 3: Deduplicate by sourceUrl
    currentStage = 3;
    const deduplicated = deduplicateByUrl(allItems);
    metrics.newsCollected = deduplicated.length;
    metrics.newsByCategory = countByCategory(deduplicated);
    await logPipelineEvent(pipelineLogId, 3, 'INFO', 'News deduplicated', {
      before: allItems.length,
      after: deduplicated.length,
    });

    // Stage 4: Persist news items
    // skipDuplicates: se o pipeline rodar de novo no mesmo dia (ex.: retry manual
    // após falha do cron), URLs já persistidas não geram linhas duplicadas — a
    // constraint única em News.sourceUrl garante isso no banco.
    currentStage = 4;
    const persisted = await prisma.news.createMany({
      data: deduplicated,
      skipDuplicates: true,
    });
    await logPipelineEvent(pipelineLogId, 4, 'INFO', 'News persisted', {
      count: persisted.count,
      skipped: deduplicated.length - persisted.count,
    });

    // **A saúde de cada fonte, gravada aqui e não na etapa 1.** (Fase 11 do
    // plano de observabilidade, §15)
    //
    // `fetched` e o desfecho de cada fonte existem desde a coleta; `kept` —
    // quantos itens **desta** fonte entraram no acervo hoje — só existe depois
    // de o `createMany` acima decidir o que era novo. Uma consulta pelas URLs
    // do run, lendo o `createdAt`, é o que diz de cada item se ele entrou
    // hoje (neste run ou num anterior do mesmo dia — o re-disparo depois de um
    // `FAILED` recomputa os mesmos números em vez de zerá-los). A atribuição é
    // por identidade do objeto, porque o `source` de um item da NewsData é o
    // nome do veículo, que pode ser o nome de um feed.
    //
    // **Não crítico, de propósito**: observabilidade nunca quebra o caminho
    // que observa (§2.1). O `WARN` degrada o dia pela etapa 4 — a tabela de
    // fontes ficou sem o dia, e isso é informação.
    try {
      const rows = await prisma.news.findMany({
        where: { sourceUrl: { in: deduplicated.map((item) => item.sourceUrl) } },
        select: { sourceUrl: true, createdAt: true },
      });
      const createdAtByUrl = new Map(rows.map((row) => [row.sourceUrl, row.createdAt]));
      const keptBySource = countKeptBySource(
        deduplicated,
        new Set(newsDataItems),
        (sourceUrl) => (createdAtByUrl.get(sourceUrl)?.getTime() ?? 0) >= today.getTime(),
      );
      const healthRows = buildSourceHealthRows({ day: today, pipelineLogId, sources, keptBySource });
      const written = await recordSourceHealth(today, healthRows);
      await logPipelineEvent(pipelineLogId, 4, 'INFO', 'Source health recorded', {
        sources: written,
        ok: healthRows.filter((row) => row.outcome === 'OK').length,
        empty: healthRows.filter((row) => row.outcome === 'EMPTY').length,
        failed: healthRows.filter((row) => row.outcome === 'FAILED').length,
        kept: healthRows.reduce((sum, row) => sum + row.kept, 0),
      });
    } catch (sourceHealthErr) {
      degradedBy.push(4);
      await logPipelineEvent(pipelineLogId, 4, 'WARN', 'Source health recording failed (non-critical)', {
        ...extractErrorDetail(sourceHealthErr),
      });
    }

    // Stage 5: Select top items for AI generation
    currentStage = 5;
    const initialSelection = selectTopItems(deduplicated);

    if (initialSelection.length === 0) {
      throw new Error('No news items available for article generation');
    }
    await logPipelineEvent(pipelineLogId, 5, 'INFO', 'Top items selected for AI', {
      count: initialSelection.length,
    });

    // Stage 5.5: o portão de entrada (§13.1 do plano de observabilidade, Fase
    // 9) — **depois da seleção e antes da chamada de IA**, porque o argumento
    // é econômico antes de ser de qualidade: não gastar a chamada do modelo
    // sobre uma colheita que não presta. Volume contra a mediana dos sete dias
    // anteriores (a linha de hoje ainda não existe: `DailyMetric` é da etapa
    // 9), três fontes distintas entre os selecionados (alargando para 30 uma
    // vez antes de desistir — a seleção que segue é a do veredito), e pelo
    // menos um item das últimas 24 h. Taxa de duplicata e deriva de categoria
    // só avisam.
    //
    // **Bloqueio é `FAILED` com `errorStage: 5.5`** — o `GateBlockedError`
    // atravessa até o `catch` de fora, que grava o `ERROR` com o motivo no
    // fingerprint (`PIPELINE_GATE_BLOCKED · stage-5.5:volume`). O dia fica sem
    // briefing, e o re-disparo depois de um `FAILED` continua permitido: a
    // colheita pode estar melhor à tarde. Sem linha de base (menos de três
    // dias com briefing na janela) o portão de volume **não opina**, e o
    // evento diz que não opinou — armadilha 24.
    currentStage = 5.5;
    const gate = evaluateEntryGate({
      deduplicated,
      collected: allItems.length,
      selected: initialSelection,
      widen: () => selectTopItems(deduplicated, WIDENED_SELECTION),
      baseline: await loadEntryBaseline(today),
      now: new Date(),
    });
    const gateContext = {
      ...gate.measures,
      baseline: gate.baseline,
      findings: gate.warnings.map((finding) => finding.check),
    };
    if (gate.block !== null) {
      throw new GateBlockedError({
        gate: 'entry',
        check: gate.block.check,
        reason: 'quality',
        detail: gate.block.detail,
      });
    }
    if (gate.warnings.length > 0) {
      degradedBy.push(5.5);
      await logPipelineEvent(pipelineLogId, 5.5, 'WARN', 'Entry gate passed with warnings', {
        ...gateContext,
        warnings: gate.warnings.map((finding) => `${finding.check}: ${finding.detail}`),
      });
    } else {
      await logPipelineEvent(pipelineLogId, 5.5, 'INFO', 'Entry gate passed', gateContext);
    }
    const selected = gate.selected;

    // Stage 6: Generate article via AI (Gemini → Groq fallback) — **com o
    // portão de saída (6.5) por tentativa, dentro de `generateArticle`**. A
    // regra "qualidade cai para o provider de reserva uma vez; segurança falha
    // o dia" só é possível se o guarda for lido entre a resposta do Gemini e a
    // decisão de chamar o Groq, e é lá que ele mora (§13.2).
    currentStage = 6;
    const generatedAt = new Date();
    const { article, provider, modelVersion, primaryError, guard } = await generateArticle(selected);
    metrics.aiProvider = provider;
    // O dia em que o Gemini falhou e o Groq entregou é um dia **degradado**, e
    // até aqui só o `aiProvider` da métrica contava isso. O `WARN` faz a falha
    // do primário virar `ErrorEvent` (upstream, etapa 6) e responder "há
    // quantos dias o Gemini falha?" — que é o gatilho escrito no `CLAUDE.md`
    // (três dias seguidos). **Não conta em `pipelineErrors`**: o briefing saiu,
    // e "sucesso degradado" é função sobre eventos que a Fase 8 define.
    //
    // **Quando o primário foi bloqueado pelo portão de saída** (qualidade —
    // idioma, tamanho — e o Groq serviu), o `WARN` é da etapa **6.5**, com o
    // motivo: o Gemini respondeu, quem recusou foi o guarda. O `ErrorEvent`
    // sai como `PIPELINE_GATE_BLOCKED · WARN · stage-6.5:<motivo>`.
    if (primaryError instanceof GateBlockedError) {
      degradedBy.push(6.5);
      await logPipelineEvent(pipelineLogId, 6.5, 'WARN', 'Output guard blocked the primary attempt, fallback served', {
        ...extractErrorDetail(primaryError),
        fallbackProvider: provider,
      });
    } else if (primaryError !== undefined) {
      degradedBy.push(6);
      await logPipelineEvent(pipelineLogId, 6, 'WARN', 'Primary provider failed, fallback served', {
        ...extractErrorDetail(primaryError),
        fallbackProvider: provider,
      });
    }
    await logPipelineEvent(pipelineLogId, 6, 'INFO', 'Article generated', {
      provider,
      modelVersion,
      promptVersion: ARTICLE_PROMPT_VERSION,
    });

    // Stage 6.5: o veredito do portão de saída sobre o artigo **servido** —
    // sem bloqueio por definição (com bloqueio `generateArticle` lança), com
    // as medidas e os avisos. Aviso degrada o dia por 6.5: "texto em forma de
    // instrução" e "URL copiada do material" são raros de propósito e pedem
    // que alguém olhe, e `SUCCESS_DEGRADED` é o mecanismo que este pipeline
    // tem para dizer isso. O `push` é condicional porque o `WARN` de cima já
    // pode ter posto a etapa lá.
    currentStage = 6.5;
    const guardContext = {
      provider,
      ...guard.measures,
      findings: guard.warnings.map((finding) => finding.check),
    };
    if (guard.warnings.length > 0) {
      if (!degradedBy.includes(6.5)) degradedBy.push(6.5);
      await logPipelineEvent(pipelineLogId, 6.5, 'WARN', 'Output guard passed with warnings', {
        ...guardContext,
        warnings: guard.warnings.map((finding) => `${finding.check}: ${finding.detail}`),
      });
    } else {
      await logPipelineEvent(pipelineLogId, 6.5, 'INFO', 'Output guard passed', guardContext);
    }

    // Stage 7: Persist article (upsert by date — one article per day) com a
    // auditoria da geração e a lista de fontes (§18.4 do plano V2).
    currentStage = 7;
    const auditFields = {
      generatedAt,
      promptVersion: ARTICLE_PROMPT_VERSION,
      modelVersion,
      status: 'PUBLISHED' as const,
    };
    const savedArticle = await prisma.article.upsert({
      where: { date: today },
      create: {
        title: article.title,
        summary: article.summary,
        content: article.content,
        date: today,
        newsCount: selected.length,
        ...auditFields,
      },
      update: {
        title: article.title,
        summary: article.summary,
        content: article.content,
        newsCount: selected.length,
        ...auditFields,
      },
    });

    const sourcesSaved = await persistBriefingSources(savedArticle.id, selected);

    metrics.articleGenerated = true;
    await logPipelineEvent(pipelineLogId, 7, 'INFO', 'Article persisted', {
      articleId: savedArticle.id,
      sources: sourcesSaved,
    });

    // Update log with counts before cleanup
    await prisma.pipelineLog.update({
      where: { id: pipelineLogId },
      data: { newsCount: deduplicated.length, articleId: savedArticle.id },
    });

    // Stage 7.5: Send daily newsletter (non-critical — failure does not abort
    // the pipeline). Idempotente via NewsletterLog.date unique: se o pipeline
    // rodar de novo no mesmo dia, o envio é pulado. Falhas individuais de
    // e-mail são contadas pelo service (sent/failed) e não lançam erro;
    // sem RESEND_API_KEY o provider lança por e-mail e tudo vira failed.
    // Não incrementa pipelineErrors de propósito: a newsletter é opcional e
    // sua indisponibilidade não deve marcar o dia como falha do pipeline.
    try {
      currentStage = 7.5;
      const newsletter = await sendDailyNewsletter();
      newsletterSummary = {
        total: newsletter.total,
        sent: newsletter.sent,
        failed: newsletter.failed,
      };
      await logPipelineEvent(pipelineLogId, 7.5, 'INFO', 'Daily newsletter sent', {
        total: newsletter.total,
        sent: newsletter.sent,
        failed: newsletter.failed,
      });
    } catch (newsletterErr) {
      degradedBy.push(7.5);
      await logPipelineEvent(pipelineLogId, 7.5, 'WARN', 'Newsletter failed (non-critical)', {
        ...extractErrorDetail(newsletterErr),
      });
    }

    // Stage 8: Cleanup old data (non-critical — failure does not abort pipeline)
    try {
      currentStage = 8;
      const cutoff = (days: number): Date => {
        const at = new Date();
        at.setDate(at.getDate() - days);
        return at;
      };
      const newsCutoff = cutoff(NEWS_RETENTION_DAYS);
      const logsCutoff = cutoff(PIPELINE_LOG_RETENTION_DAYS);
      const articlesCutoff = cutoff(ARTICLE_RETENTION_DAYS);

      // A retenção de evento de produto entra **aqui**, e não numa etapa nova:
      // é o mesmo expurgo por idade que a notícia e o briefing já fazem, e o
      // que a §4 dos slots pede (90 dias no nível de evento). Etapa própria
      // seria um segundo lugar para lembrar de olhar quando algo parasse.
      //
      // O `ErrorEvent` entrou pelo mesmo argumento, com corte em **14 dias** —
      // ele responde "o que está quebrado agora", e não "estava quebrado no mês
      // passado", que é o que `PipelineLog` e `DailyMetric` respondem.
      //
      // O `AuditEvent` (Fase 5) é o oposto: **365 dias**, mais que qualquer
      // outra tabela, porque log de segurança responde pergunta feita meses
      // depois. E a `SourceHealth` (Fase 11) vive **90**, como o `Article`:
      // "esta fonte vale a pena?" é pergunta trimestral. As constantes moram
      // em cada service; os literais em prosa têm guarda em
      // `tests/docs/retention-drift.test.ts`.
      const [
        deletedNews,
        deletedLogs,
        deletedArticles,
        deletedEvents,
        deletedErrors,
        deletedAudit,
        deletedSourceHealth,
      ] = await Promise.all([
        prisma.news.deleteMany({ where: { createdAt: { lt: newsCutoff } } }),
        prisma.pipelineLog.deleteMany({
          where: { startedAt: { lt: logsCutoff }, id: { not: pipelineLogId } },
        }),
        prisma.article.deleteMany({ where: { createdAt: { lt: articlesCutoff } } }),
        deleteExpiredProductEvents(),
        deleteExpiredErrorEvents(),
        deleteExpiredAuditEvents(),
        deleteExpiredSourceHealth(),
      ]);
      metrics.cleanupCount =
        deletedNews.count +
        deletedLogs.count +
        deletedArticles.count +
        deletedEvents +
        deletedErrors +
        deletedAudit +
        deletedSourceHealth;
      // **Uma contagem por tabela.** As três primeiras só existiam dentro do
      // total, e "a notícia velha foi apagada?" não se lia do evento — achado
      // do ensaio de aceitação (Fase 12, A4.07), onde o `deleted: 8` escondia
      // quais das sete linhas velhas tinham saído.
      await logPipelineEvent(pipelineLogId, 8, 'INFO', 'Cleanup completed', {
        deleted: metrics.cleanupCount,
        news: deletedNews.count,
        pipelineLogs: deletedLogs.count,
        articles: deletedArticles.count,
        productEvents: deletedEvents,
        errorEvents: deletedErrors,
        auditEvents: deletedAudit,
        sourceHealth: deletedSourceHealth,
      });
    } catch (cleanupErr) {
      metrics.pipelineErrors += 1;
      degradedBy.push(8);
      await logPipelineEvent(pipelineLogId, 8, 'WARN', 'Cleanup failed (non-critical)', {
        ...extractErrorDetail(cleanupErr),
      });
    }

    // Stage 8.5: Reaplica as regras de ingestão ao acervo (non-critical —
    // failure does not abort pipeline).
    //
    // **É o que faz a correção de regra valer para o que já está gravado.**
    // Consertar a ingestão só conserta o que entra; as linhas antigas seguem
    // servidas até o cleanup, e a Home da V2 agrupa por categoria, então uma
    // regra corrigida hoje levaria 30 dias para aparecer inteira. Rodando aqui,
    // todo dia, o acervo converge sozinho no dia seguinte a qualquer mudança de
    // regra — sem ninguém lembrar de disparar nada, sem segredo na mão de
    // alguém, e sem voltar a divergir na próxima vez.
    //
    // **Depois do cleanup, de propósito:** renormalizar linha que a etapa 8
    // acabou de apagar é trabalho jogado fora.
    //
    // É idempotente e barato em regime: a primeira execução depois de uma
    // mudança de regra ajusta o que precisa, e as seguintes varrem e não
    // escrevem nada. Fica em `clear-only`, que é o subconjunto seguro — ver
    // `CategoryMode`.
    try {
      currentStage = 8.5;
      const report = await renormalizeStoredNews({ dryRun: false });
      renormalized = {
        scanned: report.scanned,
        changed: report.textChanged + report.imageRecovered + report.categoryChanged,
      };
      await logPipelineEvent(pipelineLogId, 8.5, 'INFO', 'Stored news renormalized', {
        scanned: report.scanned,
        textChanged: report.textChanged,
        imageRecovered: report.imageRecovered,
        categoryChanged: report.categoryChanged,
        categorySkipped: report.categorySkipped,
      });
    } catch (renormalizeErr) {
      metrics.pipelineErrors += 1;
      degradedBy.push(8.5);
      await logPipelineEvent(
        pipelineLogId,
        8.5,
        'WARN',
        'Renormalization failed (non-critical)',
        { ...extractErrorDetail(renormalizeErr) },
      );
    }

    // Stage 9: Record daily metrics (non-critical — failure does not abort pipeline)
    try {
      currentStage = 9;
      const pipelineDuration = Date.now() - startedAt;
      await prisma.dailyMetric.upsert({
        where: { date: today },
        create: {
          date: today,
          newsCollected: metrics.newsCollected,
          newsByCategory: metrics.newsByCategory,
          newsApiCount: metrics.newsDataCount, // coluna historica; hoje mede NewsData.io
          rssCount: metrics.rssCount,
          articleGenerated: metrics.articleGenerated,
          aiProvider: metrics.aiProvider,
          cleanupCount: metrics.cleanupCount,
          pipelineDuration,
          pipelineErrors: metrics.pipelineErrors,
        },
        update: {
          newsCollected: metrics.newsCollected,
          newsByCategory: metrics.newsByCategory,
          newsApiCount: metrics.newsDataCount, // coluna historica; hoje mede NewsData.io
          rssCount: metrics.rssCount,
          articleGenerated: metrics.articleGenerated,
          aiProvider: metrics.aiProvider,
          cleanupCount: metrics.cleanupCount,
          pipelineDuration,
          pipelineErrors: metrics.pipelineErrors,
        },
      });
      await logPipelineEvent(pipelineLogId, 9, 'INFO', 'Daily metrics recorded', {
        durationMs: pipelineDuration,
      });
    } catch (metricsErr) {
      degradedBy.push(9);
      await logPipelineEvent(pipelineLogId, 9, 'WARN', 'Metrics recording failed (non-critical)', {
        ...extractErrorDetail(metricsErr),
      });
    }

    // Stage 9.5: Invariants (§10 do plano de observabilidade, Fase 6 —
    // non-critical, failure does not abort pipeline).
    //
    // **"O que deveria ter acontecido aconteceu?"**, perguntado uma vez por
    // run, depois de a 9 gravar a métrica do dia e antes de o run virar
    // `SUCCESS`. As etapas 7.5 a 9 engolem a própria falha para o run
    // terminar; esta é quem confere depois — a retenção que parou em silêncio,
    // o dia sem briefing, o cadáver em `RUNNING`, o dia sem métrica, a
    // newsletter que não entrega.
    //
    // **Violação não degrada o run.** O relatório inteiro vai no `context` de
    // um evento `INFO`, e cada violação é um `ErrorEvent` próprio com o id da
    // invariante no fingerprint (`runInvariants` os grava). O que degrada é a
    // suíte não conseguir perguntar — uma consulta que lançou sai como `ERROR`
    // no resultado, e aí o evento é `WARN`: o que não aconteceu foi a checagem.
    // O `catch` de fora é para a própria suíte quebrar, que ela promete não
    // fazer.
    //
    // O número é literal como em toda etapa — o `diagram-drift` deriva as
    // etapas anunciadas dos literais — e `INVARIANTS_STAGE` é o que a leitura
    // usa; há teste cobrando que os dois sejam o mesmo.
    try {
      currentStage = 9.5;
      const report = await runInvariants({ pipelineLogId });
      invariants = { checked: report.checked, violated: report.violated, errored: report.errored };
      if (report.errored > 0) {
        degradedBy.push(9.5);
        await logPipelineEvent(pipelineLogId, 9.5, 'WARN', 'Invariants partially checked (non-critical)', {
          message: `${report.errored} of ${report.checked} checks could not run`,
          ...report,
        });
      } else {
        await logPipelineEvent(pipelineLogId, 9.5, 'INFO', 'Invariants checked', { ...report });
      }
    } catch (invariantsErr) {
      degradedBy.push(9.5);
      await logPipelineEvent(pipelineLogId, 9.5, 'WARN', 'Invariants check failed (non-critical)', {
        ...extractErrorDetail(invariantsErr),
      });
    }

    // Mark pipeline as successful
    currentStage = 9;
    await prisma.pipelineLog.update({
      where: { id: pipelineLogId },
      data: { status: 'SUCCESS', completedAt: new Date() },
    });

    // **O resumo do que deu certo, e não só do que deu errado.** (Fase 8, §12)
    //
    // O evento final carregava só `durationMs`; o que uma pessoa quer saber ao
    // abrir a tela de manhã — quantas notícias, de quantas fontes, qual modelo
    // escreveu, quantos assinantes receberam, e qual etapa engoliu a falha —
    // estava espalhado por ~15 eventos ou não estava em lugar nenhum. É um
    // evento `INFO`, então não vira `ErrorEvent`; é a linha que o detalhe de um
    // run abre primeiro.
    await logPipelineEvent(pipelineLogId, 9, 'INFO', 'Pipeline completed successfully', {
      collected: allItems.length,
      sources: new Set(deduplicated.map((item) => item.source)).size,
      deduped: deduplicated.length,
      persisted: persisted.count,
      selected: selected.length,
      provider,
      model: modelVersion,
      promptVersion: ARTICLE_PROMPT_VERSION,
      briefingId: savedArticle.id,
      briefingChars: article.content.length,
      sourcesCited: sourcesSaved,
      newsletter: newsletterSummary,
      renormalized,
      invariants,
      degradedBy,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const detail = extractErrorDetail(error);

    // **A etapa da falha é a do portão quando foi um portão que bloqueou.** O
    // `GateBlockedError` do portão de saída nasce dentro de `generateArticle`,
    // com `currentStage` ainda em 6; o do portão de entrada nasce na 5.5. A
    // etapa vem do erro, e não de um `currentStage` reatribuído no meio da
    // chamada de IA — o mesmo portão não bloqueia em duas etapas.
    if (error instanceof GateBlockedError) currentStage = error.stage;

    // Fallback de IA (Gemini → Groq): se o provider primário falhou antes do
    // fallback (erro carregado por `withPrimaryError` no ai.service), registra
    // os dois erros — WARN do primário + ERROR final — no PipelineLog. Quando
    // o primário foi um bloqueio de qualidade do portão de saída, o `WARN` é
    // da 6.5 (a etapa do portão), como no caminho em que o Groq serviu.
    const primaryError = (error as { primaryError?: unknown }).primaryError;
    if (primaryError !== undefined) {
      const primaryDetail = extractErrorDetail(primaryError);
      detail.primaryError = primaryDetail;
      const primaryStage = primaryError instanceof GateBlockedError ? primaryError.stage : 6;
      await logPipelineEvent(pipelineLogId, primaryStage, 'WARN', 'Primary provider failed before fallback', {
        ...primaryDetail,
      });
    }

    // **O evento antes do `update`, de propósito.** `logPipelineEvent` põe a
    // falha no buffer do `ErrorEvent` de forma síncrona e nunca lança; o
    // `update` abaixo é uma ida ao banco que pode falhar — e falha justamente
    // quando o que abortou o run foi o banco. Na ordem antiga, esse caso
    // terminava sem registro nenhum: o `update` lançava, o `ERROR` nunca era
    // escrito, e o `.catch` de fora só logava. Achado da verificação
    // pós-merge da Fase 4.
    await logPipelineEvent(pipelineLogId, currentStage, 'ERROR', detail.message, {
      ...detail,
    });
    await prisma.pipelineLog.update({
      where: { id: pipelineLogId },
      data: {
        status: 'FAILED',
        error: detail.message,
        errorStage: currentStage,
        errorDetail: { ...detail } as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    throw error;
  }
}
