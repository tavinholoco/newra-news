import type { FastifyInstance } from 'fastify';

export async function articleDateRoutes(app: FastifyInstance) {
  // TODO: GET /api/articles/:date — get article by date
  app.get('/:date', async () => {
    return { data: null };
  });
}
