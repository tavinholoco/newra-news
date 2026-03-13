import type { FastifyInstance } from 'fastify';

export async function articlesRoutes(app: FastifyInstance) {
  // TODO: GET /api/articles — list articles with pagination
  app.get('/', async () => {
    return { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } };
  });

  // TODO: GET /api/articles/latest — get latest article
  app.get('/latest', async () => {
    return { data: null };
  });
}
