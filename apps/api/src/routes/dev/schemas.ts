import { z } from 'zod';
import type {
  ApiResponse,
  PipelineRunDetail,
  PipelineRunsResponse,
} from '@newranews/types';
import { assertContract } from '../../utils/contract';

export const pipelineEventLevelSchema = z.enum(['INFO', 'WARN', 'ERROR']);

export const pipelineErrorDetailSchema = z.object({
  message: z.string(),
  provider: z.string().optional(),
  statusCode: z.number().int().optional(),
});

export const devLogSummarySchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['RUNNING', 'SUCCESS', 'FAILED']),
  newsCount: z.number().int(),
  articleId: z.string().uuid().nullable(),
  error: z.string().nullable(),
  errorStage: z.number().nullable(),
  errorDetail: z.record(z.string(), z.unknown()).nullable(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  eventCount: z.number().int(),
});

export const devLogsResponseSchema = z.object({
  data: z.object({
    runs: z.array(devLogSummarySchema),
    recentErrors: z.array(devLogSummarySchema),
  }),
  meta: z.object({ total: z.number().int() }),
});

/**
 * **Os dois schemas abaixo deixaram de ser "painel dev" na Fase 2.**
 *
 * Eles nasceram servindo o /dev/dashboard, atrás do JOB_SECRET, e por isso o
 * `shared-type-contract.test.ts` os isentava de contrato compartilhado com o
 * motivo `'painel dev, fora do produto'`. Desde que `/api/admin/pipeline/runs`
 * devolve exatamente esta forma para uma tela do produto, o motivo deixou de
 * ser verdade — e a guarda estava dizendo o que fazer.
 *
 * A forma é uma só de propósito: **duas portas, um contrato.** Duplicar o
 * schema para a porta nova seria criar dois lugares para descrever o mesmo
 * `PipelineLog`, e eles divergem no primeiro campo que alguém acrescentar de um
 * lado.
 */
assertContract<typeof devLogsResponseSchema, PipelineRunsResponse>(true);

export const devLogsQuerySchema = z.object({
  status: z.enum(['RUNNING', 'SUCCESS', 'FAILED']).optional(),
  since: z.coerce.number().int().min(1).max(90).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const pipelineEventSchema = z.object({
  id: z.string().uuid(),
  stage: z.number(),
  level: pipelineEventLevelSchema,
  message: z.string(),
  context: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});

export const devLogDetailResponseSchema = z.object({
  data: z.object({
    log: devLogSummarySchema,
    events: z.array(pipelineEventSchema),
  }),
});

assertContract<typeof devLogDetailResponseSchema, ApiResponse<PipelineRunDetail>>(
  true,
);

export { errorResponseSchema } from '../../utils/schemas';
