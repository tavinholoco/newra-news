import type { FastifyInstance } from 'fastify';

export async function jobsRoutes(app: FastifyInstance) {
  // TODO: POST /api/jobs/daily-pipeline — trigger the daily pipeline
  app.post('/daily-pipeline', async () => {
    return { status: 'started', pipelineId: '' };
  });
}
