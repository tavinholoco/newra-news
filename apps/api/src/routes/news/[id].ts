import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getNewsById } from '../../services/news.service';
import { newsParamsSchema, getNewsByIdResponseSchema, errorResponseSchema } from './schemas';
import { NotFoundError } from '../../utils/errors';

export async function newsDetailRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id',
    {
      schema: {
        params: newsParamsSchema,
        response: { 200: getNewsByIdResponseSchema, 404: errorResponseSchema },
      },
    },
    async (request) => {
      const news = await getNewsById(request.params.id);
      if (!news) throw new NotFoundError('News');
      return {
        data: {
          ...news,
          publishedAt: news.publishedAt.toISOString(),
          createdAt: news.createdAt.toISOString(),
          updatedAt: news.updatedAt.toISOString(),
        },
      };
    },
  );
}
