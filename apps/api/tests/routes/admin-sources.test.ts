import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { SignJWT } from 'jose';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/test-server';
import { getSourceHealthReport } from '../../src/services/source-health.service';

/**
 * A porta da saúde por fonte (§15 do plano de observabilidade, 11b):
 * `GET /api/admin/sources`.
 *
 * O que se mede aqui é a **porta e o fio**: que a proteção do grupo alcança a
 * rota nova (401 sem sessão, 403 sem papel), que a query chega ao serviço
 * validada e com o teto da retenção, e que a resposta sai inteira pelo schema
 * — porque o serializador descarta o que o schema não declara, sem erro. A
 * agregação em si está em `services/source-health.test.ts`.
 */

vi.mock('../../src/services/source-health.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/source-health.service')>();
  return { ...actual, getSourceHealthReport: vi.fn() };
});

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return { ...actual, prisma: {} };
});

vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3001,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test',
    NEWSDATA_API_KEY: 'test-key',
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-2.5-flash',
    GROQ_API_KEY: 'test-key',
    GROQ_MODEL: 'openai/gpt-oss-20b',
    JOB_SECRET: 'test-secret',
    CORS_ORIGIN: 'http://localhost:3000',
    CRON_SCHEDULE: '0 8 * * *',
    CRON_TIMEZONE: 'America/Sao_Paulo',
    AUTH_JWT_SECRET: 'test-jwt-secret',
    ADMIN_EMAILS: 'admin@newranews.com',
  },
}));

const SECRET = new TextEncoder().encode('test-jwt-secret');

async function signToken(payload: Record<string, string>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(SECRET);
}

const report = {
  window: {
    days: 30,
    since: '2026-08-17T00:00:00.000Z',
    until: '2026-09-15T00:00:00.000Z',
  },
  sources: [
    {
      source: 'Superinteressante',
      kind: 'RSS' as const,
      days: [
        {
          day: '2026-09-15T00:00:00.000Z',
          outcome: 'FAILED' as const,
          fetched: 0,
          kept: 0,
          latencyMs: 30_000,
          failureReason: 'fetch failed: ETIMEDOUT',
          pipelineLogId: 'run-1',
        },
      ],
    },
    {
      source: 'newsdata',
      kind: 'AGGREGATOR' as const,
      days: [
        {
          day: '2026-09-15T00:00:00.000Z',
          outcome: 'OK' as const,
          fetched: 62,
          kept: 43,
          latencyMs: 740,
          failureReason: null,
          pipelineLogId: 'run-1',
        },
      ],
    },
  ],
};

let app: FastifyInstance;
let adminToken: string;
let userToken: string;

beforeAll(async () => {
  app = await buildTestApp();
  adminToken = await signToken({ sub: 'admin-1', email: 'admin@newranews.com', role: 'ADMIN' });
  userToken = await signToken({ sub: 'user-1', email: 'user@test.com', role: 'USER' });
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.mocked(getSourceHealthReport).mockReset();
  vi.mocked(getSourceHealthReport).mockResolvedValue(report);
});

describe('GET /api/admin/sources', () => {
  it('rejects without a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admin/sources' });

    expect(response.statusCode).toBe(401);
    expect(getSourceHealthReport).not.toHaveBeenCalled();
  });

  it('rejects a session without the ADMIN role', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/sources',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(getSourceHealthReport).not.toHaveBeenCalled();
  });

  it('returns the report whole — every field the schema declares survives the serializer', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/sources',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: report });
  });

  it('defaults the window to 30 days', async () => {
    await app.inject({
      method: 'GET',
      url: '/api/admin/sources',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(getSourceHealthReport).toHaveBeenCalledWith({ days: 30 });
  });

  it('passes the window through, coerced', async () => {
    await app.inject({
      method: 'GET',
      url: '/api/admin/sources?days=7',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(getSourceHealthReport).toHaveBeenCalledWith({ days: 7 });
  });

  it('caps the window at the retention — 91 days would read a day the purge already emptied', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/sources?days=91',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(400);
    expect(getSourceHealthReport).not.toHaveBeenCalled();
  });

  it('accepts the full retention window', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/sources?days=90',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(getSourceHealthReport).toHaveBeenCalledWith({ days: 90 });
  });

  it('rejects a window of zero days', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/sources?days=0',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(400);
  });
});
