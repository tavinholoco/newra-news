import type { FastifyInstance } from 'fastify';
import { getNewsById } from '../../services/news.service';
import {
  newsParamsJsonSchema,
  getNewsByIdResponseJsonSchema,
  errorResponseJsonSchema,
  type NewsParams,
  type GetNewsByIdResponse,
} from './schemas';
import { NotFoundError } from '../../utils/errors';

export async function newsDetailRoutes(app: FastifyInstance) {
  app.get<{ Params: NewsParams; Reply: GetNewsByIdResponse }>(
    '/:id',
    {
      schema: {
        params: newsParamsJsonSchema,
        response: { 200: getNewsByIdResponseJsonSchema, 404: errorResponseJsonSchema },
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
        },
      };
    },
  );
}
