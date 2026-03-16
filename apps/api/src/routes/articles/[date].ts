import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getArticleByDate } from '../../services/article.service';
import { articleDateParamsSchema, getArticleResponseSchema, errorResponseSchema } from './schemas';
import { NotFoundError } from '../../utils/errors';

export async function articleDateRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:date',
    {
      schema: {
        params: articleDateParamsSchema,
        response: { 200: getArticleResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request) => {
      const article = await getArticleByDate(request.params.date);
      if (!article) throw new NotFoundError('Article');
      return {
        data: {
          ...article,
          date: article.date.toISOString(),
          createdAt: article.createdAt.toISOString(),
          updatedAt: article.updatedAt.toISOString(),
        },
      };
    },
  );
}
