import type { FastifyInstance } from 'fastify';

export async function newsDetailRoutes(app: FastifyInstance) {
  // TODO: GET /api/news/:id — get news by ID
  app.get('/:id', async () => {
    return { data: null };
  });
}
