import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '@newranews/database';
import { NotFoundError } from '../../utils/errors';
import { pipelineStatusResponseSchema, errorResponseSchema } from './schemas';

export async function jobStatusRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:pipelineId',
    {
      schema: {
        params: z.object({ pipelineId: z.string().uuid() }),
        response: {
          200: pipelineStatusResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const { pipelineId } = request.params;

      const log = await prisma.pipelineLog.findUnique({ where: { id: pipelineId } });
      if (!log) throw new NotFoundError('Pipeline');

      return {
        data: {
          id: log.id,
          status: log.status,
          newsCount: log.newsCount,
          articleId: log.articleId,
          error: log.error,
          startedAt: log.startedAt.toISOString(),
          completedAt: log.completedAt?.toISOString() ?? null,
        },
      };
    },
  );
}
