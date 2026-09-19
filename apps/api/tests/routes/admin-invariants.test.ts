import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { SignJWT } from 'jose';
import type { FastifyInstance } from 'fastify';
import type { InvariantReport } from '@newranews/types';
import { buildTestApp } from '../helpers/test-server';
import { getLatestInvariantReport } from '../../src/services/invariants.service';
import { AppError } from '../../src/utils/errors';

/**
 * A porta das invariantes (§10 do plano de observabilidade, Fase 6):
 * `GET /api/admin/invariants`.
 *
 * O que se mede aqui é a **porta e o fio**: que a proteção do grupo alcança a
 * rota nova (401 sem sessão, 403 sem papel), que a resposta sai inteira pelo
 * schema — o serializador descarta o que o schema não declara, sem erro —, e
 * que `null` atravessa como `null`: "nenhuma verificação ainda" é estado, e
 * um serializador que o trocasse por `{}` deixaria a tela sem saber dizê-lo.
 * A suíte em si está em `services/invariants.service.test.ts`.
 */

vi.mock('../../src/services/invariants.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/invariants.service')>();
  return { ...actual, getLatestInvariantReport: vi.fn() };
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

const report: InvariantReport = {
  checkedAt: '2026-09-16T11:01:02.000Z',
  pipelineLogId: 'run-1',
  checked: 12,
  violated: 1,
  errored: 0,
  durationMs: 61,
  budgetMs: 2_000,
  results: [
    {
      id: 'retention.news',
      status: 'VIOLATED',
      measure: 'oldest',
      observed: '2026-07-01T09:00:00.000Z',
      expected: '2026-08-16T11:01:00.000Z',
      detail: null,
      error: null,
      durationMs: 5,
    },
    {
      id: 'metrics.day_recorded',
      status: 'OK',
      measure: 'count',
      observed: 0,
      expected: 0,
      detail: null,
      error: null,
      durationMs: 7,
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
  vi.mocked(getLatestInvariantReport).mockReset();
  vi.mocked(getLatestInvariantReport).mockResolvedValue(report);
});

describe('GET /api/admin/invariants', () => {
  it('rejects without a session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admin/invariants' });

    expect(response.statusCode).toBe(401);
    expect(getLatestInvariantReport).not.toHaveBeenCalled();
  });

  it('rejects a session without the ADMIN role', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/invariants',
      headers: { authorization: `Bearer ${userToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(getLatestInvariantReport).not.toHaveBeenCalled();
  });

  it('returns the report whole — every field the schema declares survives the serializer', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/invariants',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: report });
  });

  it('answers null, not an empty object, before the first run with the stage', async () => {
    vi.mocked(getLatestInvariantReport).mockResolvedValue(null);

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/invariants',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: null });
  });

  it('is a 500 with the fixed message when the stored report does not parse', async () => {
    vi.mocked(getLatestInvariantReport).mockRejectedValue(
      new AppError('Invariant report is malformed', 500, { category: 'contract' }),
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/invariants',
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(response.statusCode).toBe(500);
    // O 500 não conta o interior do servidor: a mensagem do `AppError` sai
    // porque o servidor a escolheu, e nada além dela.
    expect(response.json()).toEqual({ error: 'Invariant report is malformed' });
  });
});
