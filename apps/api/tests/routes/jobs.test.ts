import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';
import { triggerPipeline } from '../../src/services/pipeline.service';
import { prisma } from '@newranews/database';

vi.mock('../../src/services/pipeline.service', () => ({
  triggerPipeline: vi.fn().mockResolvedValue({
    outcome: 'started',
    pipelineId: 'aaaaaaaa-0000-0000-0000-000000000001',
    startedAt: '2026-08-25T11:00:00.000Z',
  }),
}));

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      pipelineLog: {
        findUnique: vi.fn(),
      },
    },
  };
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
    it('should return 200 with the outcome and pipelineId when token is valid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/daily-pipeline',
        headers: { authorization: 'Bearer test-secret' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        outcome: string;
        pipelineId: string;
        startedAt: string;
      };
      expect(body.outcome).toBe('started');
      expect(body.pipelineId).toBe('aaaaaaaa-0000-0000-0000-000000000001');
      expect(body.startedAt).toBe('2026-08-25T11:00:00.000Z');
    });

    /**
     * **O schema e o contrato, e ate aqui ele declarava um literal.**
     *
     * `status: z.literal('started')` nao tinha como contar que nada foi
     * disparado — e o `fastify-type-provider-zod` serializa **pelo schema**, de
     * modo que nem o servico saber a diferenca resolveria. Este teste existe
     * para o dia em que alguem simplificar o enum de volta.
     */
    it('should serialise an outcome that is not "started"', async () => {
      vi.mocked(triggerPipeline).mockResolvedValueOnce({
        outcome: 'already-succeeded-today',
        pipelineId: 'bbbbbbbb-0000-0000-0000-000000000002',
        startedAt: '2026-08-25T11:00:00.000Z',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/daily-pipeline',
        headers: { authorization: 'Bearer test-secret' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as { outcome: string; pipelineId: string };
      expect(body.outcome).toBe('already-succeeded-today');
      expect(body.pipelineId).toBe('bbbbbbbb-0000-0000-0000-000000000002');
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

describe('GET /api/jobs/:pipelineId', () => {
  let app: FastifyInstance;

  const mockLog = {
    id: 'bbbbbbbb-0000-0000-0000-000000000002',
    status: 'SUCCESS' as const,
    newsCount: 42,
    articleId: 'cccccccc-0000-0000-0000-000000000003',
    error: null,
    startedAt: new Date('2024-01-01T08:00:00Z'),
    completedAt: new Date('2024-01-01T08:01:30Z'),
  };

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 401 without the job secret', async () => {
    // Era publica ate a revisao da Fase 9, devolvendo `log.error` — a mensagem
    // crua da falha, com o que quer que o provider de IA ou o Prisma tenham
    // dito. Fechar nao custou acesso a ninguem: o `pipelineId` so sai da
    // resposta do disparo, que ja exigia o segredo.
    const res = await app.inject({
      method: 'GET',
      url: '/api/jobs/bbbbbbbb-0000-0000-0000-000000000002',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 200 with pipeline log when found', async () => {
    vi.mocked(prisma.pipelineLog.findUnique).mockResolvedValue(mockLog as never);

    const res = await app.inject({
      method: 'GET',
      url: `/api/jobs/${mockLog.id}`,
      headers: { authorization: 'Bearer test-secret' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: Record<string, unknown> };
    expect(body.data.id).toBe(mockLog.id);
    expect(body.data.status).toBe('SUCCESS');
    expect(body.data.newsCount).toBe(42);
    expect(body.data.articleId).toBe('cccccccc-0000-0000-0000-000000000003');
    expect(body.data.error).toBeNull();
  });

  it('should return 404 when pipeline not found', async () => {
    vi.mocked(prisma.pipelineLog.findUnique).mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/api/jobs/ffffffff-ffff-ffff-ffff-ffffffffffff',
      headers: { authorization: 'Bearer test-secret' },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toBeDefined();
  });

  it('should return 400 for invalid UUID param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/jobs/not-a-uuid',
    });

    expect(res.statusCode).toBe(400);
  });

  it('should include ISO timestamp strings in response', async () => {
    vi.mocked(prisma.pipelineLog.findUnique).mockResolvedValue(mockLog as never);

    const res = await app.inject({
      method: 'GET',
      url: `/api/jobs/${mockLog.id}`,
      headers: { authorization: 'Bearer test-secret' },
    });

    const body = JSON.parse(res.body) as { data: Record<string, unknown> };
    expect(body.data.startedAt).toBe('2024-01-01T08:00:00.000Z');
    expect(body.data.completedAt).toBe('2024-01-01T08:01:30.000Z');
  });
});
