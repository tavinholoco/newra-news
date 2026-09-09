import { Prisma, prisma } from '@newranews/database';
import type { PipelineEventLevel } from '@newranews/database';
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
 */
export async function logPipelineEvent(
  pipelineLogId: string,
  stage: number,
  level: PipelineEventLevel,
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
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
