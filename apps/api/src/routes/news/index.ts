import type { FastifyInstance } from 'fastify';
import { listNews } from '../../services/news.service';
import {
  listNewsQueryJsonSchema,
  listNewsResponseJsonSchema,
  type ListNewsQuery,
  type ListNewsResponse,
} from './schemas';

export async function newsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ListNewsQuery; Reply: ListNewsResponse }>(
    '/',
    {
      schema: {
        querystring: listNewsQueryJsonSchema,
        response: { 200: listNewsResponseJsonSchema },
      },
    },
    async (request) => {
      const { page, limit, category, search, date } = request.query;
      const { data, total } = await listNews({ category, search, date }, { page, limit });

      return {
        data: data.map((item) => ({
          ...item,
          publishedAt: item.publishedAt.toISOString(),
          createdAt: item.createdAt.toISOString(),
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
}
