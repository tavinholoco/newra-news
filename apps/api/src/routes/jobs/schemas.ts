import { z } from 'zod';

export const jobTriggerHeadersSchema = z.object({
  authorization: z.string().startsWith('Bearer '),
});

export const pipelineIdParamsSchema = z.object({
  pipelineId: z.string().uuid(),
});
