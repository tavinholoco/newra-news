/**
 * O que a aba de segurança e o painel de saturação leem (§9 do plano de
 * observabilidade, PR 5b). São os contratos de `GET /api/admin/errors`,
 * `GET /api/admin/audit` e do bloco `saturation` de `GET /api/metrics/http`.
 */

/** De onde a falha veio — espelho do enum `ErrorOrigin` do schema. */
export type ErrorOrigin = 'API' | 'PIPELINE' | 'WEB' | 'INVARIANT';

/** Espelho do enum `ErrorSeverity` do schema. */
export type ErrorSeverity = 'WARN' | 'ERROR' | 'FATAL';

/** As duas janelas de `GET /api/admin/errors`. */
export type ErrorSummaryWindow = '24h' | '7d';

/**
 * Uma falha distinta na janela: as linhas horárias do mesmo fingerprint,
 * somadas. `message`, `lastSeenAt` e `lastRequestId` são da hora mais recente.
 */
export interface ErrorGroup {
  fingerprint: string;
  origin: ErrorOrigin;
  severity: ErrorSeverity;
  code: string;
  category: string;
  /** O padrão da rota (`/api/news/:id`) ou a etapa (`stage-6`), nunca a URL. */
  route: string | null;
  statusCode: number | null;
  message: string;
  /** Ocorrências na janela. */
  count: number;
  /** Em quantas horas distintas apareceu — 1 é pico, 24 é crônico. */
  hours: number;
  firstSeenAt: string;
  lastSeenAt: string;
  /** O `x-request-id` mais recente — é o que torna um relato pesquisável no log. */
  lastRequestId: string | null;
  pipelineLogId: string | null;
}

/** A resposta de `GET /api/admin/errors`. */
export interface ErrorSummary {
  window: { key: ErrorSummaryWindow; hours: number; since: string; until: string };
  /** Soma de `count` sobre a janela. */
  total: number;
  distinctFingerprints: number;
  /** As seis categorias da taxonomia, sempre, na ordem dela — fatias fixas. */
  byCategory: Array<{ category: string; count: number }>;
  bySeverity: Array<{ severity: ErrorSeverity; count: number }>;
  byOrigin: Array<{ origin: ErrorOrigin; count: number }>;
  /** Mais recente primeiro. */
  groups: ErrorGroup[];
  /** `true` quando a leitura bateu no teto de linhas e o recorte está incompleto. */
  truncated: boolean;
}

/** Uma ação de admin gravada — uma linha por ocorrência. */
export interface AuditEventRecord {
  id: string;
  /** `User.id` de quem agiu. Só o id: quem precisar do nome junta na leitura. */
  actorId: string;
  /** `pipeline.triggered`, `news.deleted`, … — o conjunto fechado mora na API. */
  action: string;
  targetId: string | null;
  /** O desfecho que a rota devolveu: separa "clicou" de "aconteceu". */
  outcome: string | null;
  requestId: string | null;
  context: Record<string, unknown> | null;
  createdAt: string;
}

/** A resposta de `GET /api/admin/audit`. */
export interface AuditTrail {
  window: { days: number; since: string };
  /** Total na janela — não o tamanho de `events`, que o `limit` corta. */
  total: number;
  events: AuditEventRecord[];
}

export interface EventLoopLag {
  resolutionMs: number;
  samples: number;
  /** Já sem a resolução: o quanto o loop atrasou além do que o timer pediu. */
  lagMs: { p50: number; p95: number; p99: number; max: number };
}

/** O quarto sinal de ouro (§3.1): teto e razão já calculados para cada medida. */
export interface Saturation {
  memory: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    limitBytes: number;
    ratio: number;
  };
  eventLoop: EventLoopLag;
  plan: {
    /** `YYYY-MM`, em UTC — o mês de calendário que o Render cobra. */
    month: string;
    monthStart: string;
    secondsUsed: number;
    hoursUsed: number;
    limitHours: number;
    /** `hoursUsed / limitHours`. Passar de 1 é o que suspendeu a API em 29/08/2026. */
    ratio: number;
  };
}

export interface HttpRouteMetrics {
  route: string;
  count: number;
  errorRate: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}

/**
 * A resposta de `GET /api/metrics/http` — os quatro sinais de ouro.
 *
 * Latência, tráfego e erro são da **janela do processo** (`since`,
 * `uptimeSeconds`): zeram a cada deploy e a cada hibernação. `saturation.plan`
 * é a exceção — vem do `DailyUptime`, e fala do mês.
 */
export interface HttpMetrics {
  since: string;
  uptimeSeconds: number;
  totalRequests: number;
  errorRate: number;
  clientErrorRate: number;
  latencyMs: { avg: number; p50: number; p95: number; p99: number; max: number };
  routes: HttpRouteMetrics[];
  saturation: Saturation;
}
