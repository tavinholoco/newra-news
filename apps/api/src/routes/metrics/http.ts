import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { authPlugin, requireAdmin } from '../../plugins/auth';
import { getHttpMetrics } from '../../plugins/observability';
import { getSaturation } from '../../services/saturation.service';
import { errorResponseSchema, httpMetricsResponseSchema } from './schemas';

/**
 * Os quatro sinais de ouro (§3.1 do plano de observabilidade): **latência,
 * tráfego e erro** na janela do processo que está no ar, e — desde a Fase 5 —
 * **saturação**: memória residente, atraso do event loop e as horas do plano
 * no mês. Os três primeiros existiam desde a Fase 9 sem tela; o quarto não
 * existia em lugar nenhum, e é o que faltava nos três incidentes.
 *
 * **A saturação é a única parte que vai ao banco**, e só ao `DailyUptime`
 * (um `aggregate` sobre o mês). O resto continua em memória, pelo motivo
 * escrito em `plugins/observability.ts`.
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
        summary: 'The four golden signals: latency, traffic, errors and saturation',
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

      const now = new Date();
      return { data: { ...getHttpMetrics(now), saturation: await getSaturation(now) } };
    },
  );
}
