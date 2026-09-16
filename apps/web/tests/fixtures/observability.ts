import type {
  AuditTrail,
  ErrorSummary,
  HttpMetrics,
  SourceDay,
  SourceHealthReport,
  SourceOutcome,
} from '@newranews/types';

/**
 * Fixtures das três leituras da Fase 5 (PR 5c), no shape dos contratos de
 * `packages/types/src/observability.ts`. Uma cópia por suíte seria o mock
 * parcial que mente por omissão, em forma de dado.
 */

export const httpMetrics: HttpMetrics = {
  since: '2026-09-14T09:00:00.000Z',
  uptimeSeconds: 11_520,
  totalRequests: 1284,
  errorRate: 0.0008,
  clientErrorRate: 0.012,
  latencyMs: { avg: 42, p50: 50, p95: 250, p99: 500, max: 4903 },
  routes: [
    { route: 'GET /api/news', count: 812, errorRate: 0, avgMs: 38, p95Ms: 100, maxMs: 940 },
    { route: 'GET /api/home', count: 300, errorRate: 0.003, avgMs: 60, p95Ms: 180, maxMs: 4903 },
  ],
  saturation: {
    memory: {
      rssBytes: 98_304_000,
      heapUsedBytes: 41_000_000,
      heapTotalBytes: 60_000_000,
      limitBytes: 536_870_912,
      ratio: 0.1831,
    },
    eventLoop: {
      resolutionMs: 10,
      samples: 35_912,
      lagMs: { p50: 0, p95: 2, p99: 11, max: 45_210 },
    },
    plan: {
      month: '2026-09',
      monthStart: '2026-09-01T00:00:00.000Z',
      secondsUsed: 1_098_000,
      hoursUsed: 305,
      limitHours: 750,
      ratio: 0.4067,
    },
  },
};

export const errorSummary: ErrorSummary = {
  window: {
    key: '24h',
    hours: 24,
    since: '2026-09-13T12:00:00.000Z',
    until: '2026-09-14T12:30:00.000Z',
  },
  total: 1042,
  distinctFingerprints: 3,
  byCategory: [
    { category: 'upstream', count: 1000 },
    { category: 'database', count: 0 },
    { category: 'validation', count: 0 },
    { category: 'authorization', count: 40 },
    { category: 'contract', count: 0 },
    { category: 'internal', count: 2 },
  ],
  bySeverity: [
    { severity: 'WARN', count: 1040 },
    { severity: 'ERROR', count: 2 },
    { severity: 'FATAL', count: 0 },
  ],
  byOrigin: [
    { origin: 'API', count: 42 },
    { origin: 'PIPELINE', count: 1000 },
    { origin: 'WEB', count: 0 },
    { origin: 'INVARIANT', count: 0 },
  ],
  groups: [
    {
      fingerprint: 'PIPELINE:WARN:feed-failed:stage-1',
      origin: 'PIPELINE',
      severity: 'WARN',
      code: 'feed-failed',
      category: 'upstream',
      route: 'stage-1',
      statusCode: null,
      message: 'Feed Superinteressante: ETIMEDOUT',
      count: 1000,
      hours: 24,
      firstSeenAt: '2026-09-13T12:00:00.000Z',
      lastSeenAt: '2026-09-14T11:05:00.000Z',
      lastRequestId: null,
      pipelineLogId: 'run-1',
    },
    {
      fingerprint: 'API:WARN:AUTH_TOKEN_INVALID:/api/account',
      origin: 'API',
      severity: 'WARN',
      code: 'AUTH_TOKEN_INVALID',
      category: 'authorization',
      route: '/api/account',
      statusCode: 401,
      message: 'Invalid or missing token',
      count: 40,
      hours: 3,
      firstSeenAt: '2026-09-14T08:00:00.000Z',
      lastSeenAt: '2026-09-14T12:10:00.000Z',
      lastRequestId: 'req-abc-123',
      pipelineLogId: null,
    },
    {
      fingerprint: 'API:ERROR:INTERNAL:/api/news/:id',
      origin: 'API',
      severity: 'ERROR',
      code: 'INTERNAL',
      category: 'internal',
      route: '/api/news/:id',
      statusCode: 500,
      message: 'Unexpected error',
      count: 2,
      hours: 1,
      firstSeenAt: '2026-09-14T09:00:00.000Z',
      lastSeenAt: '2026-09-14T09:20:00.000Z',
      lastRequestId: 'req-def-456',
      pipelineLogId: null,
    },
  ],
  truncated: false,
};

export const emptyErrorSummary: ErrorSummary = {
  ...errorSummary,
  total: 0,
  distinctFingerprints: 0,
  byCategory: errorSummary.byCategory.map((entry) => ({ ...entry, count: 0 })),
  bySeverity: errorSummary.bySeverity.map((entry) => ({ ...entry, count: 0 })),
  byOrigin: errorSummary.byOrigin.map((entry) => ({ ...entry, count: 0 })),
  groups: [],
};

export const auditTrail: AuditTrail = {
  window: { days: 30, since: '2026-08-15T00:00:00.000Z' },
  total: 3,
  events: [
    {
      id: 'audit-1',
      actorId: 'user-admin-1',
      action: 'pipeline.triggered',
      targetId: 'run-1',
      outcome: 'started',
      requestId: 'req-1',
      context: { pipelineId: 'run-1' },
      createdAt: '2026-09-14T11:00:00.000Z',
    },
    {
      id: 'audit-2',
      actorId: 'user-admin-1',
      action: 'news.deleted',
      targetId: 'news-9',
      outcome: 'deleted',
      requestId: 'req-2',
      context: null,
      createdAt: '2026-09-13T15:30:00.000Z',
    },
    {
      id: 'audit-3',
      actorId: 'user-admin-1',
      action: 'news.renormalized',
      targetId: null,
      outcome: null,
      requestId: null,
      context: null,
      createdAt: '2026-09-12T10:00:00.000Z',
    },
  ],
};

/**
 * A saúde por fonte da Fase 11 (PR 11c), no shape de `GET /api/admin/sources`:
 * a janela termina em 15/09/2026, e cada série traz **só os dias com linha**.
 *
 * As duas histórias dos gatilhos da §15 estão aqui, como no seed: a
 * Superinteressante em `FAILED` nos três últimos dias, e a Trivela definhando
 * (23 dias a 10, 7 dias a 2). O G1 é a fonte estável; a NewsData é o balde do
 * agregador; e o G1 tem um dia sem linha (14/09) para o "não tentada" existir.
 */
const SOURCE_WINDOW = { days: 30, since: '2026-08-17T00:00:00.000Z', until: '2026-09-15T00:00:00.000Z' };

function sourceDay(date: string, outcome: SourceOutcome, kept: number, fetched = kept + 5): SourceDay {
  return {
    day: `${date}T00:00:00.000Z`,
    outcome,
    fetched: outcome === 'OK' ? fetched : 0,
    kept: outcome === 'OK' ? kept : 0,
    latencyMs: outcome === 'FAILED' ? 30_000 : 480,
    failureReason: outcome === 'FAILED' ? 'fetch failed: ETIMEDOUT' : null,
    pipelineLogId: `run-${date}`,
  };
}

/** `count` dias seguidos terminando em `until`, com o mesmo desfecho e `kept`. */
function sourceRun(count: number, outcome: SourceOutcome, kept: number, until = '2026-09-15'): SourceDay[] {
  const end = new Date(`${until}T00:00:00.000Z`);
  const days: SourceDay[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const at = new Date(end.getTime() - offset * 86_400_000);
    days.push(sourceDay(at.toISOString().slice(0, 10), outcome, kept));
  }
  return days;
}

export const sourceHealthReport: SourceHealthReport = {
  window: SOURCE_WINDOW,
  sources: [
    {
      source: 'G1',
      kind: 'RSS',
      // 30 dias a 30, menos o 14/09 — o dia em que o pipeline não a perguntou.
      days: sourceRun(30, 'OK', 30).filter((day) => !day.day.startsWith('2026-09-14')),
    },
    {
      source: 'Superinteressante',
      kind: 'RSS',
      days: [...sourceRun(27, 'OK', 8, '2026-09-12'), ...sourceRun(3, 'FAILED', 0)],
    },
    {
      source: 'Trivela',
      kind: 'RSS',
      days: [...sourceRun(23, 'OK', 10, '2026-09-08'), ...sourceRun(7, 'OK', 2)],
    },
    {
      source: 'Veja Saúde',
      kind: 'RSS',
      days: [...sourceRun(28, 'OK', 4, '2026-09-13'), ...sourceRun(2, 'EMPTY', 0)],
    },
    {
      source: 'newsdata',
      kind: 'AGGREGATOR',
      days: sourceRun(30, 'OK', 40, '2026-09-15'),
    },
  ],
};

/** A janela sem linha nenhuma — o estado antes do primeiro run com a Fase 11. */
export const emptySourceHealthReport: SourceHealthReport = { window: SOURCE_WINDOW, sources: [] };
