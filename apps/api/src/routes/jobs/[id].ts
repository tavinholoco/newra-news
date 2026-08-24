import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { prisma } from '@newranews/database';
import { NotFoundError } from '../../utils/errors';
import { assertJobSecret } from '../../utils/job-secret';
import { pipelineStatusResponseSchema, errorResponseSchema } from './schemas';

/**
 * O status do run, e ele exige o mesmo segredo que o disparo.
 *
 * **Era publico ate a revisao da Fase 9**, e devolvia `log.error` — a mensagem
 * crua da falha do pipeline, que carrega o que quer que o provider de IA ou o
 * Prisma tenham dito. E o mesmo vazamento que o error handler do `app.ts`
 * fechou para o 500, por outra porta: ali a mensagem interna sai de um erro
 * nao tratado, aqui ela sai gravada de um dia anterior.
 *
 * Fechar nao custa acesso a ninguem: o `pipelineId` so existe na resposta do
 * `POST /api/jobs/daily-pipeline`, que **ja** exige o `JOB_SECRET`, e nada no
 * browser chama esta rota. O par disparo/status pertence a quem opera.
 */
export async function jobStatusRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:pipelineId',
    {
      schema: {
        params: z.object({ pipelineId: z.string().uuid() }),
        response: {
          200: pipelineStatusResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      assertJobSecret(request);

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
