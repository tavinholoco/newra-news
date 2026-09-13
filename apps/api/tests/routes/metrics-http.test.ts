import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { SignJWT } from 'jose';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@newranews/database';
import { buildTestApp } from '../helpers/test-server';
import { RENDER_FREE_MEMORY_BYTES } from '../../src/services/saturation.service';
import { RENDER_FREE_PLAN_HOURS } from '../../src/services/uptime.service';
import { EVENT_LOOP_RESOLUTION_MS } from '../../src/plugins/observability';

/**
 * **O quarto sinal sai pela porta dos outros três** (§3.1 do plano de
 * observabilidade, 5b).
 *
 * `GET /api/metrics/http` nunca teve suíte própria — a matriz de autorização
 * cobria a porta e o `observability.test.ts` cobria a conta. O que a Fase 5
 * acrescentou é o bloco `saturation`, e ele é a única parte da resposta que
 * vai ao banco (`DailyUptime`), então a rota passou a merecer a sua.
 */

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      dailyUptime: {
        aggregate: vi.fn(),
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

interface HttpMetricsBody {
  data: {
    since: string;
    totalRequests: number;
    routes: unknown[];
    saturation: {
      memory: { rssBytes: number; limitBytes: number; ratio: number };
      eventLoop: {
        resolutionMs: number;
        samples: number;
        lagMs: { p50: number; p95: number; p99: number; max: number };
      };
      plan: {
        month: string;
        monthStart: string;
        secondsUsed: number;
        hoursUsed: number;
        limitHours: number;
        ratio: number;
      };
    };
  };
}

let app: FastifyInstance;
let admin: string;

beforeAll(async () => {
  app = await buildTestApp();
  admin = await signToken({ sub: 'u-admin', email: 'admin@newranews.com', role: 'ADMIN' });
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  vi.mocked(prisma.dailyUptime.aggregate)
    .mockReset()
    .mockResolvedValue({ _sum: { seconds: 1_098_000 } } as never);
});

describe('GET /api/metrics/http — saturação', () => {
  it('answers 401 without a session and 403 without the role', async () => {
    const anonymous = await app.inject({ method: 'GET', url: '/api/metrics/http' });
    expect(anonymous.statusCode).toBe(401);

    const reader = await signToken({ sub: 'u', email: 'r@newranews.com', role: 'USER' });
    const forbidden = await app.inject({
      method: 'GET',
      url: '/api/metrics/http',
      headers: { authorization: `Bearer ${reader}` },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(prisma.dailyUptime.aggregate).not.toHaveBeenCalled();
  });

  it('carries the three saturation measures next to the other three signals', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/http',
      headers: { authorization: `Bearer ${admin}` },
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json() as HttpMetricsBody;

    // Os três de sempre continuam lá.
    expect(typeof data.since).toBe('string');
    expect(Array.isArray(data.routes)).toBe(true);

    // Memória: o processo de teste tem RSS > 0, e o teto é o do plano.
    expect(data.saturation.memory.rssBytes).toBeGreaterThan(0);
    expect(data.saturation.memory.limitBytes).toBe(RENDER_FREE_MEMORY_BYTES);
    expect(data.saturation.memory.ratio).toBeCloseTo(
      data.saturation.memory.rssBytes / RENDER_FREE_MEMORY_BYTES,
      3,
    );

    // Event loop: o histograma está ligado pelo plugin, e o lag já vem sem a
    // resolução — em regime, p50 perto de zero.
    expect(data.saturation.eventLoop.resolutionMs).toBe(EVENT_LOOP_RESOLUTION_MS);
    expect(data.saturation.eventLoop.lagMs.p50).toBeGreaterThanOrEqual(0);
    expect(data.saturation.eventLoop.lagMs.max).toBeGreaterThanOrEqual(
      data.saturation.eventLoop.lagMs.p99,
    );
  });

  it('reads the plan hours from the DailyUptime of the calendar month', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/http',
      headers: { authorization: `Bearer ${admin}` },
    });

    const { data } = res.json() as HttpMetricsBody;
    expect(data.saturation.plan.secondsUsed).toBe(1_098_000);
    expect(data.saturation.plan.hoursUsed).toBe(305);
    expect(data.saturation.plan.limitHours).toBe(RENDER_FREE_PLAN_HOURS);
    expect(data.saturation.plan.ratio).toBeCloseTo(305 / 750, 3);
    expect(data.saturation.plan.month).toMatch(/^\d{4}-\d{2}$/);
    expect(data.saturation.plan.monthStart.endsWith('-01T00:00:00.000Z')).toBe(true);

    const [arg] = vi.mocked(prisma.dailyUptime.aggregate).mock.calls[0] as [
      { where: { date: { gte: Date } } },
    ];
    expect(arg.where.date.gte.getUTCDate()).toBe(1);
  });

  it('answers zero hours for a month without a single heartbeat', async () => {
    vi.mocked(prisma.dailyUptime.aggregate).mockResolvedValueOnce({
      _sum: { seconds: null },
    } as never);

    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/http',
      headers: { authorization: `Bearer ${admin}` },
    });

    const { data } = res.json() as HttpMetricsBody;
    expect(data.saturation.plan).toMatchObject({ secondsUsed: 0, hoursUsed: 0, ratio: 0 });
  });
});
