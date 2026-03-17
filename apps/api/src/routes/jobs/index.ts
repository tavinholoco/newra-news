import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { env } from '../../config/env';
import { triggerPipeline } from '../../services/pipeline.service';
import { UnauthorizedError } from '../../utils/errors';
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
      const auth = request.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        throw new UnauthorizedError('Invalid or missing token');
      }
      const token = auth.slice(7);
      if (token !== env.JOB_SECRET) {
        throw new UnauthorizedError('Invalid or missing token');
      }
      const pipelineId = await triggerPipeline();
      return { status: 'started' as const, pipelineId };
    },
  );
}
