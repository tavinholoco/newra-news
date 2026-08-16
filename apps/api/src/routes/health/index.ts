import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { env } from '../../config/env';
import { checkAllProviders } from '../../services/health.service';
import { UnauthorizedError } from '../../utils/errors';
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
      const auth = request.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        throw new UnauthorizedError('Invalid or missing token');
      }
      const token = auth.slice(7);
      if (token !== env.JOB_SECRET) {
        throw new UnauthorizedError('Invalid or missing token');
      }
      return checkAllProviders();
    },
  );
}
