import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getArticleByDate } from '../../services/article.service';
import { articleDateParamsSchema, getArticleResponseSchema, errorResponseSchema } from './schemas';
import { NotFoundError } from '../../utils/errors';
import { serializeArticle } from './serialize';

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
      return { data: serializeArticle(article) };
    },
  );
}
