import { z } from 'zod';

export const jobTriggerResponseSchema = z.object({
  status: z.literal('started'),
  pipelineId: z.string().uuid(),
});

export type JobTriggerResponse = z.infer<typeof jobTriggerResponseSchema>;

export const pipelineStatusResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    status: z.enum(['RUNNING', 'SUCCESS', 'FAILED']),
    newsCount: z.number().int(),
    articleId: z.string().uuid().nullable(),
    error: z.string().nullable(),
    startedAt: z.string(),
    completedAt: z.string().nullable(),
  }),
});

export type PipelineStatusResponse = z.infer<typeof pipelineStatusResponseSchema>;

export { errorResponseSchema } from '../../utils/schemas';
