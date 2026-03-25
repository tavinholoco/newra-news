import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { listNews } from '../../services/news.service';
import { listNewsQuerySchema, listNewsResponseSchema } from './schemas';

export async function newsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: listNewsQuerySchema,
        response: { 200: listNewsResponseSchema },
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
}
