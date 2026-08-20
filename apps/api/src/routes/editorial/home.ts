import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getHome } from '../../services/home.service';
import { withEditorialCache } from '../../utils/cache';
import { homeQuerySchema, homeResponseSchema } from './schemas';

/**
 * Resposta agregada da Home (§3 dos contratos).
 *
 * Existe porque a Home da V2 tem hero, briefing, top stories, trending, secoes
 * por categoria e newsletter: composta bloco a bloco, seriam 6+ chamadas em
 * sequencia a partir de um Server Component. A da V1 fazia 2.
 */
export async function homeRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: homeQuerySchema,
        response: { 200: homeResponseSchema },
      },
    },
    async (request, reply) => {
      const data = await getHome({ categories: request.query.categories });
      withEditorialCache(reply);
      return { data };
    },
  );
}
