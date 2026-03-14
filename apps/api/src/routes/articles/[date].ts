import type { FastifyInstance } from 'fastify';
import { getArticleByDate } from '../../services/article.service';
import {
  articleDateParamsJsonSchema,
  getArticleResponseJsonSchema,
  errorResponseJsonSchema,
  type ArticleDateParams,
  type GetArticleResponse,
} from './schemas';
import { NotFoundError } from '../../utils/errors';

export async function articleDateRoutes(app: FastifyInstance) {
  app.get<{ Params: ArticleDateParams; Reply: GetArticleResponse }>(
    '/:date',
    {
      schema: {
        params: articleDateParamsJsonSchema,
        response: { 200: getArticleResponseJsonSchema, 404: errorResponseJsonSchema },
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
