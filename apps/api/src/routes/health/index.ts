import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { checkAllProviders } from '../../services/health.service';
import { assertJobSecret } from '../../utils/job-secret';
import { errorResponseSchema } from '../../utils/schemas';
import { healthResponseSchema, providersHealthResponseSchema } from './schemas';

export async function healthRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async () => ({
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/providers',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        response: {
          200: providersHealthResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) => {
      // Era uma quarta cópia da conferência do `JOB_SECRET`, com `!==` — a
      // comparação que sai no primeiro byte diferente e vaza o prefixo correto
      // para quem consegue medir. `assertJobSecret` é o único lugar que compara
      // este segredo, compara em tempo constante, e agora carrega o
      // `JOB_SECRET_INVALID` da taxonomia.
      assertJobSecret(request);
      return checkAllProviders();
    },
  );
}
