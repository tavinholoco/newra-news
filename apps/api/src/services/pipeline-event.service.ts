import { Prisma, prisma } from '@newranews/database';
import type { PipelineEventLevel } from '@newranews/database';
import {
  PIPELINE_DEGRADED_CODE,
  PIPELINE_FAILED_CODE,
  recordError,
} from './error-event.service';
import type { ErrorCategory } from '../utils/errors';
import { baseLogger } from '../utils/logger';

// ── Tipos ───────────────────────────────────────────────────────────────────

export interface PipelineErrorDetail {
  message: string;
  provider?: string;
  statusCode?: number;
  // Erro primário que disparou o fallback (ex.: Gemini falhou antes do Groq)
  primaryError?: PipelineErrorDetail;
}

export interface PipelineEventView {
  id: string;
  stage: number;
  level: PipelineEventLevel;
  message: string;
  context: Record<string, unknown> | null;
  createdAt: string;
}

export interface DevLogSummary {
  id: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  newsCount: number;
  articleId: string | null;
  error: string | null;
  errorStage: number | null;
  errorDetail: Record<string, unknown> | null;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  eventCount: number;
}

export interface DevLogsResult {
  runs: DevLogSummary[];
  recentErrors: DevLogSummary[];
  total: number;
}

export interface GetDevLogsOptions {
  status?: 'RUNNING' | 'SUCCESS' | 'FAILED';
  sinceDays?: number;
  limit?: number;
}

export interface DevLogDetail {
  log: DevLogSummary;
  events: PipelineEventView[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const KNOWN_PROVIDERS = [
  'newsdata',
  'gemini',
  'groq',
  'rss',
  'resend',
  'newsletter',
  'prisma',
];

/**
 * Extrai um erro estruturado (mensagem, provider, status HTTP) de qualquer
 * valor. Os providers atualmente lançam `Error` com o provider/status embutidos
 * na mensagem ("Gemini API error 500: ..."), então a inferência usa a mensagem
 * como fallback; erros que carreguem `provider`/`statusCode` explícitos
 * (ex.: um PipelineError futuro) têm prioridade.
 */
export function extractErrorDetail(error: unknown): PipelineErrorDetail {
  const raw = error instanceof Error ? error : new Error(String(error));
  const message = raw.message;
  const detail: PipelineErrorDetail = { message };

  const withMeta = error as { provider?: unknown; statusCode?: unknown };
  if (typeof withMeta.provider === 'string' && withMeta.provider.length > 0) {
    detail.provider = withMeta.provider;
  }
  if (typeof withMeta.statusCode === 'number') {
    detail.statusCode = withMeta.statusCode;
  }

  if (!detail.provider) {
    const lower = message.toLowerCase();
    const found = KNOWN_PROVIDERS.find((p) => lower.includes(p));
    if (found) detail.provider = found;
  }

  if (detail.statusCode === undefined) {
    const match = message.match(/(?:error|status)[^\d]{0,10}(\d{3})/i);
    if (match) detail.statusCode = Number(match[1]);
  }

  return detail;
}

/**
 * A etapa como escopo da falha — a peça do fingerprint que separa "a coleta
 * falhou" de "a newsletter falhou".
 *
 * Conjunto finito por construção: são as etapas que o pipeline anuncia, e o
 * `diagram-drift.test.ts` já as enumera a partir da fonte. **Sem contagem
 * escrita aqui de propósito** — o número de etapas anunciadas já divergiu do
 * número de etapas do plano, e as duas prosas estavam certas.
 */
function stageScope(stage: number): string {
  return `stage-${stage}`;
}

/**
 * A categoria de uma falha de etapa, inferida do que `extractErrorDetail` já
 * sabe.
 *
 * É inferência, e o comentário diz isso de propósito: os providers ainda lançam
 * `Error` cru — a taxonomia da Fase 3 não os alcança —, então o provider sai da
 * mensagem. **Gatilho para apagar esta função:** converter `gemini`, `newsdata`,
 * `resend` e o `pipeline.service` para `AppError`, que é a dívida que a Fase 3
 * deixou escrita. Aí a categoria vem do erro, e não de um palpite sobre o
 * texto dele.
 *
 * **O `warnings` da etapa 1 é `upstream` por construção.** A primeira versão
 * lia só `context.provider` e classificava *"Collection degraded"* — um feed
 * em `ETIMEDOUT`, a NewsData fora do ar — como `internal`, porque o provider
 * ali está dentro de cada `FetchWarning`, não no topo. Achado da verificação
 * pós-merge da Fase 4: a classe de falha mais frequente do pipeline era a que
 * a categoria descrevia errado.
 */
function categoryForStageFailure(context?: Record<string, unknown>): ErrorCategory {
  if (Array.isArray(context?.warnings)) return 'upstream';
  const provider = typeof context?.provider === 'string' ? context.provider : undefined;
  if (provider === 'prisma') return 'database';
  if (provider !== undefined) return 'upstream';
  return 'internal';
}

/**
 * Põe a falha de etapa no buffer do `ErrorEvent`. Síncrona e sem lançar, como
 * o `recordError` que ela chama.
 *
 * **Dois códigos, e não um com duas severidades**, porque a diferença é de
 * natureza: `ERROR` aborta o run e `WARN` é etapa não-crítica que falhou
 * sozinha (a newsletter, o cleanup, a renormalização). São os dois estados que
 * pedem ações diferentes de quem lê a tela.
 */
function recordPipelineEvent(
  pipelineLogId: string,
  stage: number,
  level: PipelineEventLevel,
  message: string,
  context?: Record<string, unknown>,
): void {
  if (level === 'INFO') return;

  recordError({
    origin: 'PIPELINE',
    severity: level === 'ERROR' ? 'ERROR' : 'WARN',
    code: level === 'ERROR' ? PIPELINE_FAILED_CODE : PIPELINE_DEGRADED_CODE,
    category: categoryForStageFailure(context),
    message,
    route: stageScope(stage),
    // Explícito, e não pelo `AsyncLocalStorage`: o enterro do run morto roda
    // fora do contexto do run, e o id está na mão de quem chama.
    pipelineLogId,
    // `statusCode` do provedor quando `extractErrorDetail` conseguiu inferi-lo;
    // é HTTP de terceiro, não da nossa resposta.
    statusCode: typeof context?.statusCode === 'number' ? context.statusCode : null,
  });
}

function toJsonRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function toSummary(
  log: {
    id: string;
    status: 'RUNNING' | 'SUCCESS' | 'FAILED';
    newsCount: number;
    articleId: string | null;
    error: string | null;
    errorStage: number | null;
    errorDetail: unknown;
    startedAt: Date;
    completedAt: Date | null;
    _count: { events: number };
  },
): DevLogSummary {
  return {
    id: log.id,
    status: log.status,
    newsCount: log.newsCount,
    articleId: log.articleId,
    error: log.error,
    errorStage: log.errorStage ?? null,
    errorDetail: toJsonRecord(log.errorDetail),
    startedAt: log.startedAt.toISOString(),
    completedAt: log.completedAt?.toISOString() ?? null,
    durationSeconds: log.completedAt
      ? Math.round(
          (log.completedAt.getTime() - log.startedAt.getTime()) / 1000,
        )
      : null,
    eventCount: log._count.events,
  };
}

// ── Escrita (pipeline) ──────────────────────────────────────────────────────

/**
 * Registra um evento da pipeline (Stage 1–9, nível, mensagem e contexto JSON).
 * Nunca lança: observabilidade não pode quebrar o pipeline — falha de
 * persistência vira uma linha de `warn` no log, e nada além disso.
 *
 * ## O que a Fase 4 acrescentou: `WARN` e `ERROR` também viram `ErrorEvent`
 *
 * A fiação fica **aqui, e não em cada `catch` de etapa**, pelo mesmo motivo
 * que a pôs dentro do `logAppError` do outro lado: este é o único ponto por
 * onde toda etapa anuncia que algo deu errado, e enumerar `catch` à mão é a
 * forma de guarda que este projeto já viu falhar por omissão. Etapa nova entra
 * sozinha.
 *
 * **O que isso responde, e o `PipelineLog` não respondia:** *"a etapa 8.5 falha
 * há três dias?"*. O run guarda o desfecho de um dia; o `ErrorEvent` coalesce a
 * mesma falha ao longo da retenção, com contagem.
 *
 * **`INFO` não grava** — é o caminho feliz, e é a maioria das linhas de um run.
 */
export async function logPipelineEvent(
  pipelineLogId: string,
  stage: number,
  level: PipelineEventLevel,
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  recordPipelineEvent(pipelineLogId, stage, level, message, context);

  try {
    await prisma.pipelineEvent.create({
      data: {
        pipelineLogId,
        stage,
        level,
        message,
        context: context as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    baseLogger.warn(
      { err: error, pipelineLogId, stage },
      '[pipeline-event] failed to persist event',
    );
  }
}

// ── Leitura (dev dashboard) ─────────────────────────────────────────────────

/** Últimos runs (com filtros opcionais) + erros recentes. */
export async function getDevLogs(
  options: GetDevLogsOptions = {},
): Promise<DevLogsResult> {
  const { status, sinceDays, limit = 30 } = options;

  const where: {
    status?: 'RUNNING' | 'SUCCESS' | 'FAILED';
    startedAt?: { gte: Date };
  } = {};
  if (status) where.status = status;
  if (sinceDays) {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    where.startedAt = { gte: since };
  }

  const [runs, recentErrors, total] = await Promise.all([
    prisma.pipelineLog.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: { _count: { select: { events: true } } },
    }),
    prisma.pipelineLog.findMany({
      where: { ...where, status: 'FAILED' },
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 20),
      include: { _count: { select: { events: true } } },
    }),
    prisma.pipelineLog.count({ where }),
  ]);

  return {
    runs: runs.map(toSummary),
    recentErrors: recentErrors.map(toSummary),
    total,
  };
}

/** Detalhe completo de um run: log + eventos por etapa. Null se não existir. */
export async function getDevLogDetail(
  pipelineId: string,
): Promise<DevLogDetail | null> {
  const log = await prisma.pipelineLog.findUnique({
    where: { id: pipelineId },
    include: {
      events: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!log) return null;

  const { events, ...rest } = log;
  return {
    log: toSummary({ ...rest, _count: { events: events.length } }),
    events: events.map((event) => ({
      id: event.id,
      stage: event.stage,
      level: event.level,
      message: event.message,
      context: toJsonRecord(event.context),
      createdAt: event.createdAt.toISOString(),
    })),
  };
}
