/**
 * O que o disparo do pipeline **de fato** fez.
 *
 * **Existe porque as três respostas eram a mesma, e uma delas mentia.** O
 * `triggerPipeline` é idempotente por dia: se já houver um run de hoje com
 * `SUCCESS` ou `RUNNING`, ele devolve o id **daquele** run e não dispara nada.
 * A rota respondia `200 { status: 'started' }` nos três casos, o BFF traduzia
 * para `success: true`, e o painel imprimia "Pipeline disparado com sucesso".
 *
 * Medido em 25/08/2026: o botão do painel foi clicado às ~16:25 UTC, o painel
 * disse que havia disparado, e nada aconteceu — o run das 11:00 UTC já tinha
 * fechado em `SUCCESS`. O `generatedAt` do briefing continuou 11:00:10, o
 * acervo continuou em 6.669 linhas, e a higiene de texto da Fase 12 não
 * alcançou o banco. Custou uma rodada inteira de investigação para descobrir
 * que a tela tinha dito mais do que sabia.
 */
export type PipelineTriggerOutcome =
  /** Este chamado criou o run, e ele está correndo agora. */
  | 'started'
  /** Já havia um run de hoje em andamento. Nada foi disparado. */
  | 'already-running'
  /** O run de hoje já fechou com sucesso. Nada foi disparado. */
  | 'already-succeeded-today';

/** A resposta de `POST /api/jobs/daily-pipeline`. */
export interface PipelineTrigger {
  outcome: PipelineTriggerOutcome;
  pipelineId: string;
  /** Quando o run **referido** começou: o criado agora, ou o que já existia. */
  startedAt: string;
}

/**
 * Resultado do trigger manual do pipeline (reusa a rota /api/cron/daily-news).
 * Sucesso: { success: true, data, revalidated }.
 * Falha: { success: false, error, detail? }.
 *
 * `revalidated` é `false` quando nada foi disparado — invalidar o cache de um
 * run que não aconteceu joga fora uma página quente para regenerar a mesma.
 */
export interface RunPipelineResult {
  success: boolean;
  data?: PipelineTrigger;
  revalidated?: boolean;
  error?: string;
  detail?: string;
}

export interface DeleteNewsResult {
  deleted: boolean;
  id: string;
}
