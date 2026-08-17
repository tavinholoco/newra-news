import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  sendDailyNewsletter,
} from '../../src/services/newsletter.service';

vi.mock('../../src/services/newsletter.service', () => ({
  subscribeToNewsletter: vi.fn(),
  unsubscribeFromNewsletter: vi.fn(),
  sendDailyNewsletter: vi.fn(),
}));

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
    RESEND_API_KEY: 'test-resend-key',
    SITE_URL: 'http://localhost:3000',
    NEWSLETTER_FROM: 'Newra News <news@test.com>',
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const mockSubscriber = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  email: 'assinante@test.com',
  status: 'ACTIVE',
  createdAt: new Date('2024-01-01T08:00:00Z'),
  updatedAt: new Date('2024-01-01T08:00:00Z'),
};

describe('POST /api/newsletter/subscribe', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with the subscriber for a valid email', async () => {
    vi.mocked(subscribeToNewsletter).mockResolvedValue(mockSubscriber as never);

    const res = await app.inject({
      method: 'POST',
      url: '/api/newsletter/subscribe',
      payload: { email: 'assinante@test.com' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: Record<string, unknown> };
    expect(body.data.email).toBe('assinante@test.com');
    expect(body.data.status).toBe('ACTIVE');
    expect(body.data.createdAt).toBe('2024-01-01T08:00:00.000Z');
  });

  it('should return 400 for an invalid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/newsletter/subscribe',
      payload: { email: 'nao-e-um-email' },
    });

    expect(res.statusCode).toBe(400);
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });

  it('should return 400 when the body is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/newsletter/subscribe',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/newsletter/unsubscribe', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with unsubscribed true when the token is valid', async () => {
    vi.mocked(unsubscribeFromNewsletter).mockResolvedValue(true);

    const res = await app.inject({
      method: 'GET',
      url: '/api/newsletter/unsubscribe?token=token-uuid-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { unsubscribed: boolean } };
    expect(body.data.unsubscribed).toBe(true);
  });

  it('should return 200 with unsubscribed false for an unknown token', async () => {
    vi.mocked(unsubscribeFromNewsletter).mockResolvedValue(false);

    const res = await app.inject({
      method: 'GET',
      url: '/api/newsletter/unsubscribe?token=token-invalido',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { unsubscribed: boolean } };
    expect(body.data.unsubscribed).toBe(false);
  });

  it('should return 400 when the token is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/newsletter/unsubscribe',
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /api/newsletter/send', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 401 without a token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/newsletter/send',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 with a wrong token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/newsletter/send',
      headers: { authorization: 'Bearer wrong-token' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 200 with send results when authorized', async () => {
    vi.mocked(sendDailyNewsletter).mockResolvedValue({
      total: 3,
      sent: 2,
      failed: 1,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/newsletter/send',
      headers: { authorization: 'Bearer test-secret' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { total: number; sent: number; failed: number };
    };
    expect(body.data).toEqual({ total: 3, sent: 2, failed: 1 });
    expect(sendDailyNewsletter).toHaveBeenCalledTimes(1);
  });
});

describe('OpenAPI documentation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should document the newsletter routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const spec = JSON.parse(res.body) as { paths: Record<string, unknown> };

    expect(spec.paths['/api/newsletter/subscribe']).toBeDefined();
    expect(spec.paths['/api/newsletter/unsubscribe']).toBeDefined();
    expect(spec.paths['/api/newsletter/send']).toBeDefined();
  });
});
