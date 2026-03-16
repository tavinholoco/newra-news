import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';
import { triggerPipeline } from '../../src/services/pipeline.service';

vi.mock('../../src/services/pipeline.service', () => ({
  triggerPipeline: vi.fn().mockResolvedValue('aaaaaaaa-0000-0000-0000-000000000001'),
}));

vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3001,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test',
    NEWSAPI_KEY: 'test-key',
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-1.5-flash',
    GROQ_API_KEY: 'test-key',
    GROQ_MODEL: 'llama-3.1-8b-instant',
    JOB_SECRET: 'test-secret',
    CORS_ORIGIN: 'http://localhost:3000',
    CRON_SCHEDULE: '0 8 * * *',
    CRON_TIMEZONE: 'America/Sao_Paulo',
  },
}));

describe('POST /api/jobs/daily-pipeline', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/daily-pipeline',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body) as { error: string };
      expect(body.error).toBeDefined();
    });

    it('should return 401 when token is wrong', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/daily-pipeline',
        headers: { authorization: 'Bearer wrong-token' },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body) as { error: string };
      expect(body.error).toBeDefined();
    });

    it('should return 401 when format is invalid (no Bearer prefix)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/daily-pipeline',
        headers: { authorization: 'Token test-secret' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('success', () => {
    it('should return 200 with status and pipelineId when token is valid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/daily-pipeline',
        headers: { authorization: 'Bearer test-secret' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as { status: string; pipelineId: string };
      expect(body.status).toBe('started');
      expect(body.pipelineId).toBe('aaaaaaaa-0000-0000-0000-000000000001');
    });

    it('should return a UUID as pipelineId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/daily-pipeline',
        headers: { authorization: 'Bearer test-secret' },
      });

      const body = JSON.parse(res.body) as { pipelineId: string };
      expect(body.pipelineId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('should call triggerPipeline exactly once per request', async () => {
      vi.mocked(triggerPipeline).mockClear();

      await app.inject({
        method: 'POST',
        url: '/api/jobs/daily-pipeline',
        headers: { authorization: 'Bearer test-secret' },
      });

      expect(triggerPipeline).toHaveBeenCalledTimes(1);
    });
  });

  describe('documentation', () => {
    it('should be documented in OpenAPI spec', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
      const spec = JSON.parse(res.body) as { paths: Record<string, unknown> };
      expect(spec.paths['/api/jobs/daily-pipeline']).toBeDefined();
    });
  });
});
