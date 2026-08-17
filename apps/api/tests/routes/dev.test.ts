import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';
import {
  getDevLogDetail,
  getDevLogs,
} from '../../src/services/pipeline-event.service';
import { checkAllProviders } from '../../src/services/health.service';

vi.mock('../../src/services/pipeline-event.service', () => ({
  getDevLogs: vi.fn(),
  getDevLogDetail: vi.fn(),
  extractErrorDetail: vi.fn(),
  logPipelineEvent: vi.fn(),
}));

vi.mock('../../src/services/health.service', () => ({
  checkAllProviders: vi.fn().mockResolvedValue({
    newsdata: 'ok',
    gemini: 'ok',
    groq: 'ok',
  }),
}));

vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3001,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test',
    NEWSDATA_API_KEY: 'test-newsdata-key',
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_MODEL: 'gemini-2.5-flash',
    GROQ_API_KEY: 'test-groq-key',
    GROQ_MODEL: 'openai/gpt-oss-20b',
    JOB_SECRET: 'test-secret',
    CORS_ORIGIN: 'http://localhost:3000',
    CRON_SCHEDULE: '0 8 * * *',
    CRON_TIMEZONE: 'America/Sao_Paulo',
  },
}));

const RUN_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

const mockSummary = {
  id: RUN_ID,
  status: 'SUCCESS',
  newsCount: 42,
  articleId: null,
  error: null,
  errorStage: null,
  errorDetail: null,
  startedAt: '2026-08-16T08:00:00.000Z',
  completedAt: '2026-08-16T08:01:30.000Z',
  durationSeconds: 90,
  eventCount: 5,
};

const mockFailedSummary = {
  ...mockSummary,
  id: 'bbbbbbbb-0000-0000-0000-000000000002',
  status: 'FAILED',
  error: 'Gemini API error 500: boom',
  errorStage: 6,
  errorDetail: { message: 'Gemini API error 500: boom', provider: 'gemini', statusCode: 500 },
};

describe('GET /api/dev/logs', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    vi.mocked(getDevLogs).mockResolvedValue({
      runs: [mockSummary, mockFailedSummary],
      recentErrors: [mockFailedSummary],
      total: 2,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('authentication', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/dev/logs' });

      expect(res.statusCode).toBe(401);
      expect(getDevLogs).not.toHaveBeenCalled();
    });

    it('should return 401 when token is wrong', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/dev/logs',
        headers: { authorization: 'Bearer wrong-token' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 when format is invalid (no Bearer prefix)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/dev/logs',
        headers: { authorization: 'Token test-secret' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('success', () => {
    it('should return runs, recent errors and total when authorized', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/dev/logs',
        headers: { authorization: 'Bearer test-secret' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        data: { runs: Array<Record<string, unknown>>; recentErrors: Array<Record<string, unknown>> };
        meta: { total: number };
      };
      expect(body.meta.total).toBe(2);
      expect(body.data.runs).toHaveLength(2);
      expect(body.data.runs[0]).toEqual(
        expect.objectContaining({ id: RUN_ID, status: 'SUCCESS', durationSeconds: 90 }),
      );
      expect(body.data.recentErrors).toHaveLength(1);
      expect(body.data.recentErrors[0].status).toBe('FAILED');
    });

    it('should forward status, since and limit query params', async () => {
      vi.mocked(getDevLogs).mockClear();

      await app.inject({
        method: 'GET',
        url: '/api/dev/logs?status=FAILED&since=7&limit=10',
        headers: { authorization: 'Bearer test-secret' },
      });

      expect(getDevLogs).toHaveBeenCalledWith({
        status: 'FAILED',
        sinceDays: 7,
        limit: 10,
      });
    });

    it('should return 400 for an invalid status filter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/dev/logs?status=INVALID',
        headers: { authorization: 'Bearer test-secret' },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});

describe('GET /api/dev/logs/:pipelineId', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 401 when the token is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/dev/logs/${RUN_ID}`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return the log with events when found', async () => {
    vi.mocked(getDevLogDetail).mockResolvedValue({
      log: mockSummary,
      events: [
        {
          id: 'cccccccc-0000-0000-0000-000000000003',
          stage: 1,
          level: 'INFO',
          message: 'News collected',
          context: { total: 50 },
          createdAt: '2026-08-16T08:00:01.000Z',
        },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/dev/logs/${RUN_ID}`,
      headers: { authorization: 'Bearer test-secret' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { log: Record<string, unknown>; events: Array<Record<string, unknown>> };
    };
    expect(body.data.log.id).toBe(RUN_ID);
    expect(body.data.events).toHaveLength(1);
    expect(body.data.events[0]).toEqual(
      expect.objectContaining({ stage: 1, level: 'INFO', message: 'News collected' }),
    );
    expect(getDevLogDetail).toHaveBeenCalledWith(RUN_ID);
  });

  it('should return 404 when the pipeline does not exist', async () => {
    vi.mocked(getDevLogDetail).mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: `/api/dev/logs/${RUN_ID}`,
      headers: { authorization: 'Bearer test-secret' },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toBe('Pipeline not found');
  });

  it('should return 400 for an invalid UUID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/dev/logs/not-a-uuid',
      headers: { authorization: 'Bearer test-secret' },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /dev/dashboard', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    vi.mocked(getDevLogs).mockResolvedValue({
      runs: [mockSummary, mockFailedSummary],
      recentErrors: [mockFailedSummary],
      total: 2,
    });
    vi.mocked(checkAllProviders).mockResolvedValue({
      newsdata: 'ok',
      gemini: 'invalid',
      groq: 'ok',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 401 without any secret', async () => {
    const res = await app.inject({ method: 'GET', url: '/dev/dashboard' });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 with a wrong secret', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/dev/dashboard?secret=wrong-secret',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should render the HTML dashboard when the secret is passed as query param', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/dev/dashboard?secret=test-secret',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Dev Dashboard');
    expect(res.body).toContain('newsdata');
    expect(res.body).toContain('gemini');
    expect(res.body).toContain('SUCCESS');
    expect(res.body).toContain('FAILED');
    expect(res.body).toContain('Gemini API error 500: boom');
  });

  it('should also accept the secret via Authorization header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/dev/dashboard',
      headers: { authorization: 'Bearer test-secret' },
    });

    expect(res.statusCode).toBe(200);
  });

  it('should escape error messages in the HTML', async () => {
    vi.mocked(getDevLogs).mockResolvedValue({
      runs: [
        {
          ...mockFailedSummary,
          error: 'Bad <script>alert(1)</script> & "quote"',
        },
      ],
      recentErrors: [],
      total: 1,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/dev/dashboard?secret=test-secret',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('<script>alert(1)</script>');
    expect(res.body).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('should have rate limit headers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/dev/dashboard?secret=test-secret',
    });

    expect(res.headers['x-ratelimit-limit']).toBeDefined();
  });
});

describe('OpenAPI docs', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should document the dev logs endpoints', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = JSON.parse(res.body) as { paths: Record<string, unknown> };
    expect(spec.paths['/api/dev/logs']).toBeDefined();
    expect(spec.paths['/api/dev/logs/{pipelineId}']).toBeDefined();
  });
});
