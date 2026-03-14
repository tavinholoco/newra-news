import type { FastifyInstance } from 'fastify';
import { listArticles, getLatestArticle } from '../../services/article.service';
import {
  listArticlesQueryJsonSchema,
  listArticlesResponseJsonSchema,
  getArticleResponseJsonSchema,
  errorResponseJsonSchema,
  type ListArticlesQuery,
  type ListArticlesResponse,
  type GetArticleResponse,
} from './schemas';
import { NotFoundError } from '../../utils/errors';

export async function articlesRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ListArticlesQuery; Reply: ListArticlesResponse }>(
    '/',
    {
      schema: {
        querystring: listArticlesQueryJsonSchema,
        response: { 200: listArticlesResponseJsonSchema },
      },
    },
    async (request) => {
      const { page, limit } = request.query;
      const { data, total } = await listArticles({ page, limit });

      return {
        data: data.map((item) => ({
          ...item,
          date: item.date.toISOString(),
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
  );

  app.get<{ Reply: GetArticleResponse }>(
    '/latest',
    {
      schema: {
        response: { 200: getArticleResponseJsonSchema, 404: errorResponseJsonSchema },
      },
    },
    async () => {
      const article = await getLatestArticle();
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
