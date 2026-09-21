/**
 * O pipeline diário, do jeito que uma sessão ADMIN o lê.
 *
 * **Estes tipos existem porque a porta mudou, não o dado.** As duas consultas
 * (`getDevLogs` e `getDevLogDetail`) e os dois schemas de resposta são os
 * mesmos desde a Fase 9 — o que a Fase 2 do plano de observabilidade
 * acrescentou foi `GET /api/admin/pipeline/runs`, alcançável por sessão de
 * admin, ao lado do `/api/dev/logs`, que continua atrás do `JOB_SECRET`.
 *
 * Enquanto a única porta era o painel dev, o `shared-type-contract.test.ts`
 * isentava os dois schemas com o motivo `'painel dev, fora do produto'`. **No
 * instante em que uma tela do produto passou a ler aquele shape, o motivo
 * deixou de ser verdade** — e as duas linhas de exceção saíram.
 */

/** Estado terminal de um run, mais o `RUNNING` de quem ainda está de pé. */
export type PipelineRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED';

/** Nível de um evento de etapa. Espelha o enum `PipelineEventLevel` do Prisma. */
export type PipelineRunEventLevel = 'INFO' | 'WARN' | 'ERROR';

/**
 * O desfecho de um run fechado — o que o `status` não sabe dizer. (§12 do
 * plano de observabilidade, Fase 8)
 *
 * **`SUCCESS` é binário e o pipeline não é.** Quatro etapas engolem a própria
 * falha de propósito para o run terminar (7.5 newsletter, 8 expurgo, 8.5
 * renormalização, 9 métricas), o fallback para o Groq é um `WARN` da etapa 6 e
 * a colheita degradada é um `WARN` da etapa 1 — um run pode ter seis coisas
 * erradas e reportar `SUCCESS`. `SUCCESS_DEGRADED` é o valor que carrega toda
 * essa informação, e `degradedBy` diz **qual** etapa.
 *
 * **Não é coluna**: é função pura da API sobre o run e seus eventos
 * (`services/run-outcome.ts`), derivada na leitura. Coluna pediria migration e
 * ficaria dessincronizada do que os eventos dizem (§17.19).
 *
 * O quarto estado do plano, `NEVER_RAN`, **não está aqui de propósito**: é a
 * ausência de run num dia de calendário, e a API não emite ausência — quem a
 * deriva é a faixa de 30 dias do web, sobre a listagem. Ver `outcomeByDay`.
 */
export type RunOutcome =
  /** Briefing gerado, nenhum `WARN` que conte, provider primário. */
  | 'SUCCESS'
  /** Briefing gerado, mas pelo menos uma etapa engoliu a própria falha. */
  | 'SUCCESS_DEGRADED'
  /** Sem briefing. */
  | 'FAILED';

/**
 * Um run, resumido.
 *
 * ⚠️ **`durationSeconds` é segundo, e o `formatPipelineDuration` do web recebe
 * milissegundo.** Passar um pelo outro renderiza "45 ms" para um run de 45 s,
 * em silêncio — o campo do dashboard (`pipelineDuration`) é o que está em
 * milissegundos. Quem formata este é o `formatRunDuration`.
 */
export interface PipelineRunSummary {
  id: string;
  status: PipelineRunStatus;
  newsCount: number;
  articleId: string | null;
  /** Mensagem da falha (campo legado de string única). */
  error: string | null;
  /** Etapa em que falhou — `7.5` é a newsletter. `null` quando não falhou. */
  errorStage: number | null;
  /** `{ message, provider?, statusCode? }`, quando o erro foi estruturado. */
  errorDetail: Record<string, unknown> | null;
  startedAt: string;
  completedAt: string | null;
  /** **Segundos.** `null` enquanto o run não fechou. */
  durationSeconds: number | null;
  eventCount: number;
  /** O desfecho derivado dos eventos. `null` enquanto `RUNNING`. */
  outcome: RunOutcome | null;
  /**
   * As etapas cujo `WARN` contou como degradação, em ordem e sem repetição —
   * `7.5` é a newsletter, `6` o fallback de IA, `4` a escrita da saúde por
   * fonte (Fase 11), `1` a colheita (só quando há aviso além de `feed-empty`).
   * Vazio quando não houve. Preenchido também num run `FAILED`: a colheita
   * degradada antes da falha continua verdade.
   */
  degradedBy: number[];
}

/** Uma linha do diário de um run: etapa, nível, mensagem e contexto. */
export interface PipelineRunEvent {
  id: string;
  /** 1 a 9.5, com as meias (`5.5` e `6.5` são os portões, `7.5` a newsletter, `9.5` as invariantes). */
  stage: number;
  level: PipelineRunEventLevel;
  message: string;
  context: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Os últimos runs mais os que falharam.
 *
 * `recentErrors` **não** é um recorte de `runs`: ele aplica o mesmo filtro com
 * `status: 'FAILED'`, então uma falha de três dias atrás aparece ali mesmo
 * quando os últimos 20 runs foram todos verdes. É o que responde "ele falha há
 * três dias?" sem ninguém precisar paginar.
 */
export interface PipelineRuns {
  runs: PipelineRunSummary[];
  recentErrors: PipelineRunSummary[];
}

/** A resposta de `GET /api/admin/pipeline/runs`. */
export interface PipelineRunsResponse {
  data: PipelineRuns;
  /** Total de runs do recorte — não o tamanho de `runs`, que o `limit` corta. */
  meta: { total: number };
}

/** O detalhe de um run: o resumo mais os eventos por etapa. */
export interface PipelineRunDetail {
  log: PipelineRunSummary;
  events: PipelineRunEvent[];
}
