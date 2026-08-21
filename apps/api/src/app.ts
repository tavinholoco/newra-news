import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { env } from './config/env';
import { corsPlugin } from './plugins/cors';
import { helmetPlugin } from './plugins/helmet';
import { rateLimitPlugin } from './plugins/rate-limit';
import { swaggerPlugin } from './plugins/swagger';
import { healthRoutes } from './routes/health';
import { newsRoutes } from './routes/news';
import { newsFacetsRoutes } from './routes/news/facets';
import { newsDetailRoutes } from './routes/news/[id]';
import { newsAdminRoutes } from './routes/news/admin';
import { newsRelatedRoutes } from './routes/news/related';
import { homeRoutes } from './routes/editorial/home';
import { trendingRoutes } from './routes/editorial/trending';
import { articlesRoutes } from './routes/articles';
import { articleDateRoutes } from './routes/articles/[date]';
import { jobsRoutes } from './routes/jobs';
import { jobStatusRoutes } from './routes/jobs/[id]';
import { renormalizeJobRoutes } from './routes/jobs/renormalize';
import { metricsRoutes } from './routes/metrics';
import { metricsAdminRoutes } from './routes/metrics/admin';
import { newsletterRoutes } from './routes/newsletter';
import { authRoutes } from './routes/auth';
import { favoritesRoutes } from './routes/favorites';
import { devLogsRoutes } from './routes/dev/logs';
import { devDashboardRoutes } from './routes/dev/dashboard';
import { AppError } from './utils/errors';

export async function buildApp() {
  const app = Fastify({
    logger: env.NODE_ENV !== 'test',
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Rate-limit primeiro: usa onRoute hook que precisa estar ativo antes das rotas serem registradas
  await app.register(rateLimitPlugin);
  // Swagger depois: suas rotas herdam o rate-limit
  await app.register(swaggerPlugin);
  await app.register(corsPlugin);
  await app.register(helmetPlugin);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    return reply.status(error.statusCode ?? 500).send({ error: error.message });
  });

  await app.register(healthRoutes, { prefix: '/api/health' });

  await app.register(newsRoutes, { prefix: '/api/news' });
  await app.register(newsFacetsRoutes, { prefix: '/api/news' });
  await app.register(newsDetailRoutes, { prefix: '/api/news' });
  await app.register(newsAdminRoutes, { prefix: '/api/news' });
  await app.register(newsRelatedRoutes, { prefix: '/api/news' });

  // Editorial (contratos da Fase 0, §3 e §4) — consumidos pela Home da V2.
  await app.register(homeRoutes, { prefix: '/api/home' });
  await app.register(trendingRoutes, { prefix: '/api/trending' });

  await app.register(articlesRoutes, { prefix: '/api/articles' });
  await app.register(articleDateRoutes, { prefix: '/api/articles' });

  await app.register(jobsRoutes, { prefix: '/api/jobs' });
  await app.register(jobStatusRoutes, { prefix: '/api/jobs' });
  await app.register(renormalizeJobRoutes, { prefix: '/api/jobs' });

  await app.register(metricsRoutes, { prefix: '/api/metrics' });
  await app.register(metricsAdminRoutes, { prefix: '/api/metrics' });

  await app.register(newsletterRoutes, { prefix: '/api/newsletter' });

  await app.register(authRoutes, { prefix: '/api/auth' });

  await app.register(favoritesRoutes, { prefix: '/api/favorites' });

  // Observabilidade (dev-only) — protegida por JOB_SECRET, sem exposição pública
  await app.register(devLogsRoutes, { prefix: '/api/dev' });
  await app.register(devDashboardRoutes, { prefix: '/dev' });

  return app;
}
