import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getRelatedNews } from '../../services/related.service';
import { NotFoundError } from '../../utils/errors';
import { withEditorialCache } from '../../utils/cache';
import {
  relatedQuerySchema,
  editorialStoryListSchema,
  errorResponseSchema,
} from '../editorial/schemas';
import { newsParamsSchema } from './schemas';

/**
 * Relacionadas de uma noticia (§5 dos contratos).
 *
 * Vive sob `/api/news` e nao em `editorial/` porque a URL e um sub-recurso da
 * noticia: `/api/news/:id/related`. Fora deste contexto o `:id` nao teria dono.
 */
export async function newsRelatedRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/:id/related',
    {
      schema: {
        params: newsParamsSchema,
        querystring: relatedQuerySchema,
        response: {
          200: editorialStoryListSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const data = await getRelatedNews(request.params.id, request.query.limit);
      if (data === null) throw new NotFoundError('News');

      withEditorialCache(reply);
      return { data };
    },
  );
}
