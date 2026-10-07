import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { SignJWT } from 'jose';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from '../helpers/test-server';
import {
  MAX_WORKSPACE_HOURS,
  recordPlanHoursReading,
} from '../../src/services/plan-hours.service';
import { AppError } from '../../src/utils/errors';

/**
 * A porta da leitura do Billing (§23 do plano de observabilidade, 13b):
 * `POST /api/admin/plan-hours`.
 *
 * O que se mede aqui é **a porta e o fio**: a proteção do grupo alcança a rota
 * nova, o corpo chega validado ao serviço com o ator da sessão, e a recusa do
 * serviço sai como 400 pelo handler global. A conta — as duas pontas do mesmo
 * instante, a leitura abaixo desta API — é de
 * `services/plan-hours.service.test.ts`.
 */

vi.mock('../../src/services/plan-hours.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/plan-hours.service')>();
  return { ...actual, recordPlanHoursReading: vi.fn() };
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
const ADMIN_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

async function signToken(payload: Record<string, string>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(SECRET);
}

const reading = {
  readAt: '2026-10-06T00:10:01.000Z',
  workspaceHours: 124.27,
  apiHours: 34.9,
};

let app: FastifyInstance;
let admin: string;
let reader: string;

beforeAll(async () => {
  app = await buildTestApp();
  admin = await signToken({ sub: ADMIN_ID, email: 'admin@newranews.com', role: 'ADMIN' });
  reader = await signToken({ sub: 'bbbbbbbb-0000-0000-0000-000000000002', email: 'r@x.com' });
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.mocked(recordPlanHoursReading).mockReset().mockResolvedValue(reading);
});

function post(body: unknown, token: string | null = admin) {
  return app.inject({
    method: 'POST',
    url: '/api/admin/plan-hours',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: body as Record<string, unknown>,
  });
}

describe('POST /api/admin/plan-hours', () => {
  it('201 com a leitura, e o ator é quem está na sessão', async () => {
    const res = await post({ workspaceHours: 124.27 });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ data: reading });

    expect(recordPlanHoursReading).toHaveBeenCalledTimes(1);
    const [input] = vi.mocked(recordPlanHoursReading).mock.calls[0]!;
    expect(input).toMatchObject({ actorId: ADMIN_ID, workspaceHours: 124.27 });
    // O `x-request-id` da requisição, que acha a linha de log da ação.
    expect(typeof input.requestId).toBe('string');
  });

  it('401 sem sessão e 403 sem papel — a proteção do grupo alcança a rota', async () => {
    expect((await post({ workspaceHours: 1 }, null)).statusCode).toBe(401);
    expect((await post({ workspaceHours: 1 }, reader)).statusCode).toBe(403);
    expect(recordPlanHoursReading).not.toHaveBeenCalled();
  });

  it.each([
    ['negativa', { workspaceHours: -1 }],
    ['acima do teto', { workspaceHours: MAX_WORKSPACE_HOURS + 1 }],
    ['em texto, com vírgula', { workspaceHours: '124,27' }],
    ['ausente', {}],
  ])('400 para uma leitura %s, sem chegar ao serviço', async (_label, body) => {
    const res = await post(body);

    expect(res.statusCode).toBe(400);
    expect(recordPlanHoursReading).not.toHaveBeenCalled();
  });

  it('a recusa do serviço (abaixo desta API) sai como 400, com a frase dele', async () => {
    vi.mocked(recordPlanHoursReading).mockRejectedValueOnce(
      new AppError('The reading is below the hours this API already recorded this month (34.9 h)', 400, {
        code: 'PLAN_READING_BELOW_API',
        category: 'validation',
      }),
    );

    const res = await post({ workspaceHours: 12 });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('34.9 h');
  });
});
