import Fastify from 'fastify';
import { env } from './config/env';

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  // TODO: Register plugins
  // await app.register(corsPlugin);
  // await app.register(helmetPlugin);
  // await app.register(rateLimitPlugin);
  // await app.register(swaggerPlugin);

  // TODO: Register routes
  // await app.register(healthRoutes, { prefix: '/api/health' });
  // await app.register(newsRoutes, { prefix: '/api/news' });
  // await app.register(articlesRoutes, { prefix: '/api/articles' });
  // await app.register(jobsRoutes, { prefix: '/api/jobs' });

  return app;
}
