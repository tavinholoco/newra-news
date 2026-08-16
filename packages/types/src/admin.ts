/**
 * Resultado do trigger manual do pipeline (reusa a rota /api/cron/daily-news).
 * Sucesso: { success: true, data, revalidated: true }.
 * Falha: { success: false, error, detail? }.
 */
export interface RunPipelineResult {
  success: boolean;
  data?: unknown;
  revalidated?: boolean;
  error?: string;
  detail?: string;
}

export interface DeleteNewsResult {
  deleted: boolean;
  id: string;
}
