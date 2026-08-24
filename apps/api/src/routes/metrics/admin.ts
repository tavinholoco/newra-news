import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getDashboardMetrics } from '../../services/metrics.service';
import { getProductMetrics } from '../../services/product-metrics.service';
import { authPlugin, requireAdmin } from '../../plugins/auth';
import {
  dashboardMetricsResponseSchema,
  productMetricsResponseSchema,
  productQuerySchema,
  errorResponseSchema,
} from './schemas';

export async function metricsAdminRoutes(app: FastifyInstance) {
  // authPlugin encapsulado aqui: `/weekly` e `/monthly` seguem públicos em
  // routes/metrics/index.ts, fora deste contexto.
  await app.register(authPlugin);

  app.withTypeProvider<ZodTypeProvider>().get(
    '/dashboard',
    {
      schema: {
        response: {
          200: dashboardMetricsResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request) => {
      // O JWT é assinado pelo frontend com o role vindo da sessão (que segue
      // ADMIN_EMAILS). Mesmo desenho do DELETE /news/:id.
      requireAdmin(request);

      const data = await getDashboardMetrics();
      return { data };
    },
  );

  /**
   * Métricas de **produto** — comportamento de gente, não saúde de máquina.
   *
   * Mesmo guarda do `/dashboard`: JWT com role ADMIN. O que ela devolve inclui
   * termo de busca digitado por leitor (já higienizado na origem), e isso só
   * sai para quem administra.
   */
  app.withTypeProvider<ZodTypeProvider>().get(
    '/product',
    {
      schema: {
        summary: 'Product analytics for the admin dashboard',
        tags: ['metrics'],
        querystring: productQuerySchema,
        response: {
          200: productMetricsResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request) => {
      requireAdmin(request);

      return { data: await getProductMetrics(request.query.days) };
    },
  );

}
