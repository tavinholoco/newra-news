import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { SignJWT } from 'jose';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/test-server';
import { getErrorSummary } from '../../src/services/error-summary.service';
import { listAuditEvents } from '../../src/services/audit.service';

/**
 * As duas portas da aba de segurança (§9 do plano de observabilidade, 5b):
 * `GET /api/admin/errors` e `GET /api/admin/audit`.
 *
 * O que se mede aqui é a **porta e o fio**: que a proteção do grupo alcança as
 * duas rotas novas (401 sem sessão, 403 sem papel), que a query chega ao
 * serviço validada, e que a resposta sai inteira pelo schema — porque o
 * serializador descarta o que o schema não declara, sem erro. A soma em si é
 * testada em `services/error-summary.service.test.ts`.
 */

vi.mock('../../src/services/error-summary.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/error-summary.service')>();
  return { ...actual, getErrorSummary: vi.fn() };
});

vi.mock('../../src/services/audit.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/audit.service')>();
  return { ...actual, listAuditEvents: vi.fn() };
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

const summary = {
  window: {
    key: '24h' as const,
    hours: 24,
    since: '2026-09-11T15:30:00.000Z',
    until: '2026-09-12T15:30:00.000Z',
  },
  total: 40,
  distinctFingerprints: 1,
  byCategory: [
    { category: 'upstream', count: 0 },
    { category: 'database', count: 0 },
    { category: 'validation', count: 0 },
    { category: 'authorization', count: 40 },
    { category: 'contract', count: 0 },
    { category: 'internal', count: 0 },
  ],
  bySeverity: [
    { severity: 'WARN' as const, count: 40 },
    { severity: 'ERROR' as const, count: 0 },
    { severity: 'FATAL' as const, count: 0 },
  ],
  byOrigin: [
    { origin: 'API' as const, count: 40 },
    { origin: 'PIPELINE' as const, count: 0 },
    { origin: 'WEB' as const, count: 0 },
    { origin: 'INVARIANT' as const, count: 0 },
  ],
  groups: [
    {
      fingerprint: 'API:WARN:AUTH_TOKEN_INVALID:/api/account',
      origin: 'API' as const,
      severity: 'WARN' as const,
      code: 'AUTH_TOKEN_INVALID',
      category: 'authorization',
      route: '/api/account',
      statusCode: 401,
      message: 'Invalid or missing token',
      count: 40,
      hours: 3,
      firstSeenAt: '2026-09-12T12:05:00.000Z',
      lastSeenAt: '2026-09-12T14:55:00.000Z',
      lastRequestId: 'req-last',
      pipelineLogId: null,
    },
  ],
  truncated: false,
};

const trail = {
  window: { days: 30, since: '2026-08-13T15:00:00.000Z' },
  total: 2,
  events: [
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000009',
      actorId: 'aaaaaaaa-0000-0000-0000-000000000001',
      action: 'pipeline.triggered',
      targetId: 'bbbbbbbb-0000-0000-0000-000000000002',
      outcome: 'started',
      requestId: 'req-1',
      context: { pipelineId: 'bbbbbbbb-0000-0000-0000-000000000002' },
      createdAt: '2026-09-12T15:00:00.000Z',
    },
  ],
};

let app: FastifyInstance;
let admin: string;
let reader: string;

beforeAll(async () => {
  app = await buildTestApp();
  admin = await signToken({ sub: 'u-admin', email: 'admin@newranews.com', role: 'ADMIN' });
  reader = await signToken({ sub: 'u-reader', email: 'reader@newranews.com', role: 'USER' });
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.mocked(getErrorSummary).mockReset().mockResolvedValue(summary);
  vi.mocked(listAuditEvents).mockReset().mockResolvedValue(trail);
});

describe('GET /api/admin/errors', () => {
  it('answers 401 without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/errors' });

    expect(res.statusCode).toBe(401);
    expect(getErrorSummary).not.toHaveBeenCalled();
  });

  it('answers 403 for a session without the ADMIN role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/errors',
      headers: { authorization: `Bearer ${reader}` },
    });

    expect(res.statusCode).toBe(403);
    expect(getErrorSummary).not.toHaveBeenCalled();
  });

  it('defaults to the 24 h window and serialises the whole summary', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/errors',
      headers: { authorization: `Bearer ${admin}` },
    });

    expect(res.statusCode).toBe(200);
    expect(getErrorSummary).toHaveBeenCalledWith('24h');
    // Igualdade profunda de propósito: campo que o schema não declara é campo
    // que o serializador apaga, e `toMatchObject` não veria a ausência.
    expect(res.json()).toEqual({ data: summary });
  });

  it('honours the 7 d window', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/errors?window=7d',
      headers: { authorization: `Bearer ${admin}` },
    });

    expect(res.statusCode).toBe(200);
    expect(getErrorSummary).toHaveBeenCalledWith('7d');
  });

  it('rejects a window the table does not offer', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/errors?window=30d',
      headers: { authorization: `Bearer ${admin}` },
    });

    expect(res.statusCode).toBe(400);
    expect(getErrorSummary).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/audit', () => {
  it('answers 401 without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/audit' });

    expect(res.statusCode).toBe(401);
    expect(listAuditEvents).not.toHaveBeenCalled();
  });

  it('answers 403 for a session without the ADMIN role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/audit',
      headers: { authorization: `Bearer ${reader}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('defaults to 30 days and 50 rows, and serialises the whole trail', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/audit',
      headers: { authorization: `Bearer ${admin}` },
    });

    expect(res.statusCode).toBe(200);
    expect(listAuditEvents).toHaveBeenCalledWith({ days: 30, limit: 50 });
    expect(res.json()).toEqual({ data: trail });
  });

  it('coerces the query and caps it at the retention and the page ceiling', async () => {
    const ok = await app.inject({
      method: 'GET',
      url: '/api/admin/audit?days=365&limit=200',
      headers: { authorization: `Bearer ${admin}` },
    });
    expect(ok.statusCode).toBe(200);
    expect(listAuditEvents).toHaveBeenCalledWith({ days: 365, limit: 200 });

    const tooFar = await app.inject({
      method: 'GET',
      url: '/api/admin/audit?days=366',
      headers: { authorization: `Bearer ${admin}` },
    });
    expect(tooFar.statusCode).toBe(400);

    const tooMany = await app.inject({
      method: 'GET',
      url: '/api/admin/audit?limit=201',
      headers: { authorization: `Bearer ${admin}` },
    });
    expect(tooMany.statusCode).toBe(400);
  });
});
