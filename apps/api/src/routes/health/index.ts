import type { FastifyInstance } from 'fastify';
import { healthResponseJsonSchema, type HealthResponse } from './schemas';

export async function healthRoutes(app: FastifyInstance) {
  app.get<{ Reply: HealthResponse }>(
    '/',
    {
      schema: {
        response: {
          200: healthResponseJsonSchema,
        },
      },
    },
    async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
  );
}
