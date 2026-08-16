import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildTestApp } from '../../helpers/test-server';
import type { FastifyInstance } from 'fastify';
import { checkAllProviders } from '../../../src/services/health.service';

vi.mock('../../../src/services/health.service', () => ({
  checkAllProviders: vi.fn().mockResolvedValue({
    newsdata: 'ok',
    gemini: 'ok',
    groq: 'ok',
  }),
}));

vi.mock('../../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3001,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test',
    NEWSDATA_API_KEY: 'test-newsdata-key',
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_MODEL: 'gemini-2.5-flash',
    GROQ_API_KEY: 'test-groq-key',
    GROQ_MODEL: 'llama-3.1-8b-instant',
    JOB_SECRET: 'test-secret',
    CORS_ORIGIN: 'http://localhost:3000',
    CRON_SCHEDULE: '0 8 * * *',
    CRON_TIMEZONE: 'America/Sao_Paulo',
  },
}));

describe('GET /api/health/providers', () => {
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
        method: 'GET',
        url: '/api/health/providers',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 when token is wrong', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/health/providers',
        headers: { authorization: 'Bearer wrong-token' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 when format is invalid (no Bearer prefix)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/health/providers',
        headers: { authorization: 'Token test-secret' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('success', () => {
    it('should return 200 with provider statuses when token is valid', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/health/providers',
        headers: { authorization: 'Bearer test-secret' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as Record<string, string>;
      expect(body.newsdata).toBe('ok');
      expect(body.gemini).toBe('ok');
      expect(body.groq).toBe('ok');
    });

    it('should report invalid statuses returned by the checks', async () => {
      vi.mocked(checkAllProviders).mockResolvedValueOnce({
        newsdata: 'invalid',
        gemini: 'ok',
        groq: 'not_configured',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/health/providers',
        headers: { authorization: 'Bearer test-secret' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as Record<string, string>;
      expect(body.newsdata).toBe('invalid');
      expect(body.groq).toBe('not_configured');
    });

    it('should call checkAllProviders exactly once per request', async () => {
      vi.mocked(checkAllProviders).mockClear();

      await app.inject({
        method: 'GET',
        url: '/api/health/providers',
        headers: { authorization: 'Bearer test-secret' },
      });

      expect(checkAllProviders).toHaveBeenCalledTimes(1);
    });
  });

  describe('documentation', () => {
    it('should be documented in OpenAPI spec', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
      const spec = JSON.parse(res.body) as { paths: Record<string, unknown> };
      expect(spec.paths['/api/health/providers']).toBeDefined();
    });
  });

  describe('rate limit', () => {
    it('should include rate limit headers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/health/providers',
        headers: { authorization: 'Bearer test-secret' },
      });

      expect(res.headers['x-ratelimit-limit']).toBeDefined();
    });
  });
});
