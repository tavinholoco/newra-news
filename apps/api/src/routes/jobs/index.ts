import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env';
import { triggerPipeline } from '../../services/pipeline.service';
import { UnauthorizedError } from '../../utils/errors';
import {
  jobTriggerHeadersJsonSchema,
  jobTriggerResponseJsonSchema,
  errorResponseJsonSchema,
  type JobTriggerHeaders,
  type JobTriggerResponse,
} from './schemas';

export async function jobsRoutes(app: FastifyInstance) {
  app.post<{ Headers: JobTriggerHeaders; Reply: JobTriggerResponse }>(
    '/daily-pipeline',
    {
      schema: {
        headers: jobTriggerHeadersJsonSchema,
        response: {
          200: jobTriggerResponseJsonSchema,
          401: errorResponseJsonSchema,
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
      return { status: 'started', pipelineId };
    },
  );
}
