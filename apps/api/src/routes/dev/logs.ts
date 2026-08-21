import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  getDevLogDetail,
  getDevLogs,
} from '../../services/pipeline-event.service';
import { NotFoundError } from '../../utils/errors';
import { assertJobSecret } from '../../utils/job-secret';
import {
  devLogDetailResponseSchema,
  devLogsQuerySchema,
  devLogsResponseSchema,
  errorResponseSchema,
} from './schemas';

export async function devLogsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/logs',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        querystring: devLogsQuerySchema,
        response: {
          200: devLogsResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) => {
      assertJobSecret(request);

      const { status, since, limit } = request.query;
      const logs = await getDevLogs({ status, sinceDays: since, limit });

      return {
        data: { runs: logs.runs, recentErrors: logs.recentErrors },
        meta: { total: logs.total },
      };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/logs/:pipelineId',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        params: z.object({ pipelineId: z.string().uuid() }),
        response: {
          200: devLogDetailResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      assertJobSecret(request);

      const { pipelineId } = request.params;
      const detail = await getDevLogDetail(pipelineId);
      if (!detail) throw new NotFoundError('Pipeline');

      return { data: detail };
    },
  );
}
