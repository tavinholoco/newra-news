import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { triggerPipeline } from '../../services/pipeline.service';
import { assertJobSecret } from '../../utils/job-secret';
import { jobTriggerResponseSchema, errorResponseSchema } from './schemas';

export async function jobsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/daily-pipeline',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        response: {
          200: jobTriggerResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) => {
      assertJobSecret(request);
      const pipelineId = await triggerPipeline();
      return { status: 'started' as const, pipelineId };
    },
  );
}
