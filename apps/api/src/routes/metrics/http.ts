import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { authPlugin, requireAdmin } from '../../plugins/auth';
import { getHttpMetrics } from '../../plugins/observability';
import { errorResponseSchema, httpMetricsResponseSchema } from './schemas';

/**
 * As duas metricas tecnicas da §26 — **error rate** e **API latency** — na
 * unica forma em que elas existem hoje: a janela do processo que esta no ar.
 *
 * **Admin, e nao publica.** A lista de rotas com contagem e um mapa do que o
 * produto tem e de quanto cada coisa e usada; e a mesma razao pela qual a
 * `/metrics/product` e admin.
 */
export async function metricsHttpRoutes(app: FastifyInstance) {
  await app.register(authPlugin);

  app.withTypeProvider<ZodTypeProvider>().get(
    '/http',
    {
      schema: {
        summary: 'In-process HTTP error rate and latency',
        tags: ['metrics'],
        response: {
          200: httpMetricsResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request) => {
      requireAdmin(request);

      return { data: getHttpMetrics() };
    },
  );
}
