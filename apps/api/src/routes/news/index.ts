import type { FastifyInstance } from 'fastify';

export async function newsRoutes(app: FastifyInstance) {
  // TODO: GET /api/news — list news with pagination and filters
  app.get('/', async () => {
    return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
  });
}
