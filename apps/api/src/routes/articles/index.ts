import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { listArticles, getLatestArticle } from '../../services/article.service';
import {
  listArticlesQuerySchema,
  listArticlesResponseSchema,
  getArticleResponseSchema,
  errorResponseSchema,
} from './schemas';
import { NotFoundError } from '../../utils/errors';
import { serializeArticle } from './serialize';

export async function articlesRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/',
    {
      schema: {
        querystring: listArticlesQuerySchema,
        response: { 200: listArticlesResponseSchema },
      },
    },
    async (request) => {
      const { page, limit } = request.query;
      const { data, total } = await listArticles({ page, limit });

      return {
        data: data.map(serializeArticle),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
  );

  typed.get(
    '/latest',
    {
      schema: {
        response: { 200: getArticleResponseSchema, 404: errorResponseSchema },
      },
    },
    async () => {
      const article = await getLatestArticle();
      if (!article) throw new NotFoundError('Article');
      return { data: serializeArticle(article) };
    },
  );
}
