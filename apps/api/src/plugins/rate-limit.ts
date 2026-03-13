import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

export async function rateLimitPlugin(app: FastifyInstance) {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
}
