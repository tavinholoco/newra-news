import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/test-server';
import { renormalizeStoredNews } from '../../src/services/news-renormalizer.service';

vi.mock('../../src/services/news-renormalizer.service', () => ({
  renormalizeStoredNews: vi.fn(),
  CLASSIFIER_OWNED_SOURCES: ['G1'],
}));

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return { ...actual, prisma: { pipelineLog: { findUnique: vi.fn() } } };
});

vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3001,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test',
    NEWSDATA_API_KEY: 'test-key',
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-1.5-flash',
    GROQ_API_KEY: 'test-key',
    GROQ_MODEL: 'openai/gpt-oss-20b',
    JOB_SECRET: 'test-secret',
    CORS_ORIGIN: 'http://localhost:3000',
    CRON_SCHEDULE: '0 8 * * *',
    CRON_TIMEZONE: 'America/Sao_Paulo',
  },
}));

const emptyReport = {
  dryRun: true,
  scanned: 0,
  textChanged: 0,
  categoryChanged: 0,
  transitions: [],
  sample: [],
};

describe('POST /api/jobs/renormalize-news', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.mocked(renormalizeStoredNews).mockReset().mockResolvedValue(emptyReport);
  });

  describe('authentication', () => {
    it('should return 401 without an Authorization header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/renormalize-news',
        payload: {},
      });

      expect(res.statusCode).toBe(401);
      expect(renormalizeStoredNews).not.toHaveBeenCalled();
    });

    it('should return 401 with the wrong token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/renormalize-news',
        headers: { authorization: 'Bearer wrong-token' },
        payload: {},
      });

      expect(res.statusCode).toBe(401);
      expect(renormalizeStoredNews).not.toHaveBeenCalled();
    });
  });

  describe('dry run is the default', () => {
    // A garantia que importa: nenhuma forma de pedir sem dizer nada pode
    // acabar gravando.
    it.each([
      ['corpo vazio', {}],
      ['sem a chave dryRun', { limit: 10 }],
    ])('should ask for a dry run with %s', async (_label, payload) => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/renormalize-news',
        headers: { authorization: 'Bearer test-secret' },
        payload,
      });

      expect(res.statusCode).toBe(200);
      expect(renormalizeStoredNews).toHaveBeenCalledWith(
        expect.objectContaining({ dryRun: true }),
      );
    });

    it('should write only when dryRun is explicitly false', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/jobs/renormalize-news',
        headers: { authorization: 'Bearer test-secret' },
        payload: { dryRun: false },
      });

      expect(renormalizeStoredNews).toHaveBeenCalledWith(
        expect.objectContaining({ dryRun: false }),
      );
    });
  });

  describe('report', () => {
    it('should return the transitions and the sample under { data }', async () => {
      vi.mocked(renormalizeStoredNews).mockResolvedValue({
        dryRun: true,
        scanned: 400,
        textChanged: 380,
        categoryChanged: 16,
        transitions: [{ from: 'TECHNOLOGY', to: 'WORLD', count: 14 }],
        sample: [
          {
            id: 'aaaaaaaa-0000-0000-0000-000000000001',
            title: 'Polícia prende suspeito',
            from: 'TECHNOLOGY',
            to: 'WORLD',
          },
        ],
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/renormalize-news',
        headers: { authorization: 'Bearer test-secret' },
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        data: { scanned: number; transitions: unknown[]; sample: unknown[] };
      };
      expect(body.data.scanned).toBe(400);
      expect(body.data.transitions).toHaveLength(1);
      expect(body.data.sample).toHaveLength(1);
    });

    it('should forward limit and sources', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/jobs/renormalize-news',
        headers: { authorization: 'Bearer test-secret' },
        payload: { limit: 100, sources: ['Reuters'] },
      });

      expect(renormalizeStoredNews).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100, sources: ['Reuters'] }),
      );
    });

    it('should reject a limit outside the allowed range', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/renormalize-news',
        headers: { authorization: 'Bearer test-secret' },
        payload: { limit: 999_999 },
      });

      expect(res.statusCode).toBe(400);
      expect(renormalizeStoredNews).not.toHaveBeenCalled();
    });
  });
});
