import type { RunOutcome } from '@newranews/types';
import type { FetchWarningKind } from './news-fetcher.service';

/**
 * O desfecho de um run, derivado — e por que `SUCCESS` mente. (§12 do plano de
 * observabilidade, Fase 8)
 *
 * **`PipelineLog.status` é binário e o pipeline não é.** Cinco etapas engolem
 * a própria falha de propósito para o run terminar (7.5, 8, 8.5, 9 e 9.5 —
 * `WARN`, e o run segue `SUCCESS`), o fallback para o Groq é um `WARN` da
 * etapa 6 e a colheita degradada é um `WARN` da etapa 1. Um run pode ter
 * **sete coisas erradas** e reportar `SUCCESS`; o `SUCCESS_DEGRADED` é o valor
 * que carrega toda essa informação, e `degradedBy` diz qual etapa.
 *
 * **Função pura, sem coluna e sem banco — de propósito.** O desfecho é lido dos
 * eventos que o run já grava; uma coluna pediria migration e divergiria dos
 * eventos no primeiro `catch` que alguém esquecesse de espelhar (§17.19). Quem
 * alimenta esta função é o `pipeline-event.service` (uma consulta de `WARN`
 * sobre os runs da página); ela mesma não importa nada de runtime, o que é o
 * que a deixa testável no `turbo test` e importável pelo próprio pipeline sem
 * arrastar os providers para o grafo de módulos.
 *
 * **`NEVER_RAN` não está aqui.** É a ausência de run num dia de calendário, e
 * uma função sobre um run não sabe dizer que o run não existe — quem deriva
 * isso é o calendário do web (`lib/outcome-days.ts`), sobre a listagem dos
 * últimos 30 dias.
 */

/**
 * Depois de quanto tempo um `RUNNING` deixa de ser "está rodando" e passa a ser
 * "morreu sem conseguir contar".
 *
 * **O run só vira `SUCCESS` na etapa 9.** Se o processo morre antes — e ele
 * morre: em 03/09/2026 o Render mandou `SIGTERM` no meio da etapa 8.5, porque a
 * varredura do acervo segurou o event loop por 45 s e os health checks pararam
 * de ser respondidos —, a linha fica em `RUNNING` para sempre. Não há `catch`
 * que alcance isso, porque `process.exit` não desenrola pilha nenhuma.
 *
 * O estrago não é o registro errado, é a idempotência: o `findFirst` do
 * `triggerPipeline` aceita `RUNNING` como "já tem run hoje", então **um cadáver
 * recusa todo disparo pelo resto do dia** — e a tela responde "já está
 * rodando" sobre algo que morreu de manhã. É a mesma família do episódio de
 * 25/08, quando o painel dizia "disparado com sucesso" sem ter disparado:
 * resposta que não distingue o que de fato aconteceu.
 *
 * **Quinze minutos é folga sobre o pipeline inteiro, não sobre uma etapa.** Os
 * runs medidos fecham em torno de 20 s a 60 s; o mais lento tem a geração de
 * IA com três tentativas e o fallback do Groq no caminho, e ainda assim não
 * passa de poucos minutos. Um `RUNNING` de quinze minutos não está lento, está
 * morto.
 *
 * **Mora aqui, e não no `pipeline.service.ts`, desde a Fase 6**: o invariante
 * `pipeline.no_stale_running` pergunta pelo mesmo número, e o
 * `invariants.service` não pode importar o pipeline — é o pipeline que o
 * importa. Este módulo é puro, e "quando um run está morto" é definição de
 * estado do run, que é o que ele descreve.
 */
export const STALE_RUN_MS = 15 * 60 * 1000;

/** O que a derivação lê de um run: só o estado. */
export interface OutcomeRun {
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
}

/** O que a derivação lê de um evento: etapa, nível e o `context` cru. */
export interface OutcomeEvent {
  stage: number;
  level: 'INFO' | 'WARN' | 'ERROR';
  context: unknown;
}

/**
 * O aviso de colheita que **não** degrada o dia.
 *
 * `feed-empty` é a classe "publicou devagar": um feed especializado que fica
 * legitimamente vazio em dia comum (fim de semana de um feed de saúde). O item
 * 46 o tirou de `pipelineErrors` por isso — luz que acende todo dia é luz que
 * se aprende a ignorar. Os outros três (`provider-failed`, `provider-empty`,
 * `feed-failed`) são falha de verdade, e contam.
 */
const BENIGN_FETCH_WARNING: FetchWarningKind = 'feed-empty';

/**
 * A linha entre "colheita degradada" e "feed que publicou nada" — **num lugar
 * só**. O `pipelineErrors` da etapa 1 e o desfecho aqui a traçam pela mesma
 * função; a primeira versão do inventário desta fase dizia "zero `WARN`", o que
 * marcaria como degradado todo dia em que um feed ficou vazio, e
 * `SUCCESS_DEGRADED` viraria o estado normal.
 *
 * Um aviso sem `kind` legível **conta**: o que não se sabe classificar não é
 * benigno até prova em contrário.
 */
export function isDegradingFetchWarning(warning: { kind?: unknown }): boolean {
  return warning.kind !== BENIGN_FETCH_WARNING;
}

/**
 * Se um `WARN` conta como degradação.
 *
 * Todo `WARN` conta, com uma exceção lida do `context`: o da etapa 1 carrega
 * `warnings: FetchWarning[]`, e é julgado pelos avisos que traz — só degrada se
 * algum deles for mais que `feed-empty`. A forma (`warnings` é array) é o que
 * identifica o evento, e não o número da etapa, para a regra continuar certa
 * se a coleta um dia mudar de etapa.
 *
 * **Exportada porque tem três consumidores, e o terceiro traçava a linha
 * diferente** (pós-merge da Fase 8): o desfecho aqui, o `pipelineErrors` da
 * etapa 1 (via `isDegradingFetchWarning`) e o `ErrorEvent` que
 * `logPipelineEvent` grava para todo `WARN` — que chamava de
 * `PIPELINE_STAGE_DEGRADED` o domingo de um feed de saúde, enquanto o desfecho
 * do mesmo run dizia `SUCCESS`.
 */
export function isDegradingWarn(event: OutcomeEvent): boolean {
  const context = event.context;
  if (context === null || typeof context !== 'object') return true;

  const warnings = (context as { warnings?: unknown }).warnings;
  if (!Array.isArray(warnings)) return true;

  return warnings.some((warning) =>
    isDegradingFetchWarning(
      warning !== null && typeof warning === 'object' ? (warning as { kind?: unknown }) : {},
    ),
  );
}

/**
 * As etapas cujo `WARN` contou, em ordem crescente e sem repetição.
 *
 * É o campo que faz o `SUCCESS_DEGRADED` ser acionável em vez de decorativo —
 * e o gatilho numérico que a fase cria: três dias seguidos de degradação pela
 * **mesma** etapa. `INFO` e `ERROR` ficam de fora: o `ERROR` já é o `FAILED`,
 * e o enterro do run morto grava um na etapa 0 que não é degradação, é a morte
 * do run.
 */
export function degradedStages(events: OutcomeEvent[]): number[] {
  const stages = new Set<number>();
  for (const event of events) {
    if (event.level === 'WARN' && isDegradingWarn(event)) stages.add(event.stage);
  }
  return [...stages].sort((a, b) => a - b);
}

/**
 * A tabela do §12:
 *
 * ```
 * SUCCESS           — briefing gerado, nenhum WARN que conte, provider primário
 * SUCCESS_DEGRADED  — briefing gerado, mas pelo menos um WARN que conte
 * FAILED            — sem briefing
 * null              — ainda RUNNING: não há desfecho para contar
 * ```
 *
 * "Briefing gerado" é o `status: SUCCESS`, por construção: o `status` só vira
 * `SUCCESS` na etapa 9, depois de o artigo estar gravado na 7. E "provider
 * primário" é o `WARN` da etapa 6 que o item 61 passou a escrever quando o
 * Gemini falha e o Groq entrega — ele conta como qualquer outro.
 */
export function deriveRunOutcome(run: OutcomeRun, events: OutcomeEvent[]): RunOutcome | null {
  if (run.status === 'RUNNING') return null;
  if (run.status === 'FAILED') return 'FAILED';
  return degradedStages(events).length > 0 ? 'SUCCESS_DEGRADED' : 'SUCCESS';
}
