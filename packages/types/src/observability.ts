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
  /**
   * As horas do plano — **`null` quando o banco não respondeu.** É a única
   * medida que sai do banco (`DailyUptime`), e a rota é em memória de
   * propósito para responder quando o banco é o problema; a tela desenha
   * "indisponível", nunca zero.
   */
  plan: {
    /** `YYYY-MM`, em UTC — o mês de calendário que o Render cobra. */
    month: string;
    monthStart: string;
    secondsUsed: number;
    hoursUsed: number;
    limitHours: number;
    /** `hoursUsed / limitHours`. Passar de 1 é o que suspendeu a API em 29/08/2026. */
    ratio: number;
  } | null;
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

/**
 * A saúde de cada fonte, um dia de cada vez (§15 do plano de observabilidade,
 * Fase 11). É o contrato de `GET /api/admin/sources`.
 */

/** Espelho do enum `SourceKind` do schema. `AGGREGATOR` é a NewsData — um balde que agrega dezenas de veículos. */
export type SourceKind = 'RSS' | 'AGGREGATOR';

/**
 * Espelho do enum `SourceOutcome` do schema — **três valores**. "Não tentada"
 * (a fonte removida de `rss-sources.ts`, o dia sem run, o run que morreu antes
 * da etapa 4) é a **ausência** de linha num dia, derivada no web como o
 * `NEVER_RAN` do run: a API não emite ausência. Ver `SourceDayOutcome` no web.
 */
export type SourceOutcome =
  /** Trouxe item. */
  | 'OK'
  /** Respondeu e não tinha nada — o normal de feed especializado em dia comum; não degrada o run. */
  | 'EMPTY'
  /** Lançou (timeout, DNS, XML inválido), ou o provider caiu por cima dela. */
  | 'FAILED';

/** Uma linha de `SourceHealth`: o que a fonte rendeu naquele dia. */
export interface SourceDay {
  /** Dia de calendário à meia-noite UTC, ISO. Lê-se em UTC, como `Article.date`. */
  day: string;
  outcome: SourceOutcome;
  /** Itens que a fonte trouxe no run, depois do filtro do provider. */
  fetched: number;
  /**
   * Dos `fetched`, quantos entraram no acervo naquele dia — a coluna que
   * decide trocar provedor. Nunca maior que `fetched`.
   */
  kept: number;
  /** Do `fetch` ao parse; para o agregador, o provider inteiro. */
  latencyMs: number | null;
  /** Só em `FAILED`, já redigida e truncada. */
  failureReason: string | null;
  /** O run que escreveu a linha — o último do dia. */
  pipelineLogId: string | null;
}

/** A série de uma fonte na janela, do dia mais antigo ao mais recente. */
export interface SourceSeries {
  /** `name` de `rss-sources.ts`, ou `newsdata`. */
  source: string;
  kind: SourceKind;
  /** Só os dias com linha: o dia ausente é "não tentada". */
  days: SourceDay[];
}

/** A resposta de `GET /api/admin/sources`. */
export interface SourceHealthReport {
  /** `since` e `until` são meia-noite UTC do primeiro e do último dia da janela, inclusive. */
  window: { days: number; since: string; until: string };
  /** Toda fonte com linha na janela, por nome — inclusive a que saiu da lista no meio dela. */
  sources: SourceSeries[];
}

/**
 * As invariantes do sistema (§10 do plano de observabilidade, Fase 6). É o
 * contrato de `GET /api/admin/invariants` — e a forma do `context` do evento
 * da etapa 9.5, que é de onde a rota lê.
 *
 * Uma invariante é a pergunta "o que deveria ter acontecido aconteceu?",
 * feita por consulta agregada uma vez por run: a retenção de cada tabela que
 * a etapa 8 expurga, um briefing por dia, o run morto, o dia sem métrica, a
 * newsletter que não entrega. As etapas 7.5 a 9 engolem a própria falha de
 * propósito para o run terminar; a suíte é quem pergunta depois.
 */

/**
 * O conjunto fechado, como tipo: o id é a peça do fingerprint do
 * `ErrorEvent` (`route`), e a tela tem um rótulo por id. Uma invariante nova
 * entra aqui, na tabela de definições da API e nos dois arquivos de mensagem.
 */
export type InvariantId =
  | 'retention.news'
  | 'retention.pipelineLog'
  | 'retention.article'
  | 'retention.productEvent'
  | 'retention.errorEvent'
  | 'retention.auditEvent'
  | 'retention.sourceHealth'
  | 'briefing.one_per_day'
  | 'briefing.has_sources'
  | 'pipeline.no_stale_running'
  | 'metrics.day_recorded'
  | 'newsletter.delivered';

/**
 * `OK` e `VIOLATED` são a resposta da pergunta; `ERROR` é a pergunta que não
 * pôde ser feita — a consulta lançou. Os dois últimos pedem ações diferentes,
 * e por isso não são um valor só: a violação é uma etapa anterior que não fez
 * o que devia, o erro é a própria suíte (ou o banco) fora do ar.
 */
export type InvariantStatus = 'OK' | 'VIOLATED' | 'ERROR';

/** O que uma invariante mede, e é o que diz à tela como formatar `observed` e `expected`. */
export type InvariantMeasure =
  /** Uma contagem, comparada por igualdade com `expected`. */
  | 'count'
  /** O instante mais antigo na tabela (ISO), que tem de ser `>= expected`. */
  | 'oldest';

export interface InvariantResult {
  id: InvariantId;
  status: InvariantStatus;
  measure: InvariantMeasure;
  /**
   * A contagem, ou o instante mais antigo em ISO. `null` quando a tabela está
   * vazia (a retenção vale por vacuidade) ou quando a consulta lançou.
   */
  observed: number | string | null;
  /** A contagem esperada, ou o instante mais antigo admitido, em ISO. */
  expected: number | string;
  /** Só quando há o que listar — os dias sem métrica, as datas sem briefing. Curto por construção. */
  detail: string | null;
  /** Só em `ERROR`: a mensagem da consulta, redigida. */
  error: string | null;
  durationMs: number;
}

/** A resposta de `GET /api/admin/invariants`: o último relatório da etapa 9.5, ou `null` antes do primeiro run. */
export interface InvariantReport {
  /** Quando a suíte rodou — o `createdAt` do evento da etapa 9.5. */
  checkedAt: string;
  /** O run em que rodou. */
  pipelineLogId: string;
  checked: number;
  violated: number;
  errored: number;
  /** A suíte inteira, de relógio. */
  durationMs: number;
  /**
   * O teto que a §10 dá à suíte (2 s). Viaja no relatório para a tela dizer
   * quanto sobrou — estourar é uma invariante que virou varredura.
   */
  budgetMs: number;
  /** Na ordem da tabela de definições, sempre completa. */
  results: InvariantResult[];
}
