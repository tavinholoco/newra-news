import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getDashboardMetrics } from '../../services/metrics.service';
import { ForbiddenError } from '../../utils/errors';
import { authPlugin } from '../../plugins/auth';
import { dashboardMetricsResponseSchema, errorResponseSchema } from './schemas';

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
      if (request.user?.role !== 'ADMIN') {
        throw new ForbiddenError('Admin access required');
      }

      const data = await getDashboardMetrics();
      return { data };
    },
  );
}
