import Fastify from 'fastify';
import { env } from './config/env';
import { corsPlugin } from './plugins/cors';
import { helmetPlugin } from './plugins/helmet';
import { rateLimitPlugin } from './plugins/rate-limit';
import { swaggerPlugin } from './plugins/swagger';
import { healthRoutes } from './routes/health';
import { newsRoutes } from './routes/news';

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  // Rate-limit primeiro: usa onRoute hook que precisa estar ativo antes das rotas serem registradas
  await app.register(rateLimitPlugin);
  // Swagger depois: suas rotas herdam o rate-limit
  await app.register(swaggerPlugin);
  await app.register(corsPlugin);
  await app.register(helmetPlugin);

  await app.register(healthRoutes, { prefix: '/api/health' });

  await app.register(newsRoutes, { prefix: '/api/news' });

  // TODO: Register routes
  // await app.register(articlesRoutes, { prefix: '/api/articles' });
  // await app.register(jobsRoutes, { prefix: '/api/jobs' });

  return app;
}
