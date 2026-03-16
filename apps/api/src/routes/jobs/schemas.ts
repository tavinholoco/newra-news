import { z } from 'zod';

export const jobTriggerHeadersSchema = z.object({
  authorization: z.string().startsWith('Bearer '),
});

export type JobTriggerHeaders = z.infer<typeof jobTriggerHeadersSchema>;

export const jobTriggerResponseSchema = z.object({
  status: z.literal('started'),
  pipelineId: z.string().uuid(),
});

export type JobTriggerResponse = z.infer<typeof jobTriggerResponseSchema>;

export const jobTriggerHeadersJsonSchema = {
  type: 'object',
  properties: {
    authorization: { type: 'string', description: 'Bearer <JOB_SECRET>' },
  },
} as const;

export const jobTriggerResponseJsonSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['started'] },
    pipelineId: { type: 'string', format: 'uuid' },
  },
  required: ['status', 'pipelineId'],
} as const;

export { errorResponseJsonSchema } from '../../utils/schemas';
