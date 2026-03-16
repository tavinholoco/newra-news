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

export { errorResponseSchema } from '../../utils/schemas';
