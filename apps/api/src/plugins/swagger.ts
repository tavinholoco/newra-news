import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export const swaggerPlugin = fp(async function swaggerPlugin(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Newra News API',
        description: 'API do portal de notícias Newra News',
        version: '1.0.0',
      },
      servers: [{ url: 'http://localhost:3001' }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/api/docs',
  });
});
