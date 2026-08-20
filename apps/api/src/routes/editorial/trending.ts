import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getTrending } from '../../services/trending.service';
import { withEditorialCache } from '../../utils/cache';
import { trendingQuerySchema, editorialStoryListSchema } from './schemas';

/**
 * Trending — etapa 1 (§4 dos contratos): recencia + favoritos.
 *
 * Cliques e compartilhamentos dependem da camada de analytics da §27, que nao
 * existe. O que este endpoint devolve hoje e "recentes mais favoritadas", e o
 * comentario do servico explica por que isso precisa estar dito em voz alta.
 */
export async function trendingRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: trendingQuerySchema,
        response: { 200: editorialStoryListSchema },
      },
    },
    async (request, reply) => {
      const { limit, window } = request.query;
      const data = await getTrending({ limit, window });
      withEditorialCache(reply);
      return { data };
    },
  );
}
