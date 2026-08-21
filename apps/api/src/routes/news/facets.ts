import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getNewsFacets } from '../../services/news.service';
import { withEditorialCache } from '../../utils/cache';
import { newsFacetsQuerySchema, newsFacetsResponseSchema } from './schemas';

/**
 * `GET /api/news/facets` — contagem por categoria e por fonte do acervo (§7).
 *
 * **Por que uma rota e não um campo em `/api/news`.** A listagem é paginada e
 * as facetas não: elas descrevem o acervo inteiro sob o recorte atual. Emiti-las
 * junto faria toda página de resultado recarregar dois `groupBy` que não mudam
 * ao virar a página. Separadas, cada uma tem a sua chave de cache — no CDN e no
 * TanStack Query.
 *
 * A rota é estática e o roteador do Fastify prioriza segmento literal sobre
 * paramétrico, então `/facets` nunca cai no `/:id` (que exige UUID e devolveria
 * 400).
 */
export async function newsFacetsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/facets',
    {
      schema: {
        querystring: newsFacetsQuerySchema,
        response: { 200: newsFacetsResponseSchema },
      },
    },
    async (request, reply) => {
      const data = await getNewsFacets(request.query);

      withEditorialCache(reply);
      return { data };
    },
  );
}
