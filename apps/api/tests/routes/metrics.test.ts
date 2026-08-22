import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { SignJWT } from 'jose';
import { buildTestApp } from '../helpers/test-server';
import { getProductMetrics } from '../../src/services/product-metrics.service';
import type { FastifyInstance } from 'fastify';

vi.mock('../../src/services/metrics.service', () => ({
  getWeeklyMetrics: vi.fn(),
  getMonthlyMetrics: vi.fn(),
  getDashboardMetrics: vi.fn(),
}));

vi.mock('../../src/services/product-metrics.service', () => ({
  getProductMetrics: vi.fn(),
  DEFAULT_WINDOW_DAYS: 30,
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

import { getWeeklyMetrics, getMonthlyMetrics, getDashboardMetrics } from '../../src/services/metrics.service';

const mockWeekly = {
  period: { start: '2024-01-01T00:00:00.000Z', end: '2024-01-07T23:59:59.999Z' },
  totalDays: 7,
  avgNewsPerDay: 45.3,
  totalArticlesGenerated: 6,
  pipelineSuccessRate: 0.857,
  avgPipelineDuration: 12000,
  newsByCategory: { TECHNOLOGY: 90, WORLD: 60 },
  aiProviderUsage: { gemini: 5, groq: 1 },
};

const mockMonthly = {
  period: { month: '2024-01' },
  totalNewsCollected: 1400,
  totalArticlesGenerated: 29,
  avgNewsPerDay: 45.2,
  topCategories: [{ category: 'TECHNOLOGY', count: 350 }],
  failureDays: 2,
  newsApiTotal: 700,
  rssTotal: 700,
};

const mockDashboard = {
  today: {
    newsCollected: 50,
    articleGenerated: true,
    aiProvider: 'gemini',
    pipelineDuration: 11000,
    pipelineErrors: 0,
  },
  lastWeek: mockWeekly,
  lastMonth: {
    totalNewsCollected: 1400,
    totalArticlesGenerated: 29,
    avgNewsPerDay: 45.2,
    failureDays: 2,
  },
};

describe('GET /api/metrics/weekly', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with weekly metrics', async () => {
    vi.mocked(getWeeklyMetrics).mockResolvedValue(mockWeekly);

    const res = await app.inject({ method: 'GET', url: '/api/metrics/weekly' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: typeof mockWeekly };
    expect(body.data.totalDays).toBe(7);
    expect(body.data.pipelineSuccessRate).toBe(0.857);
  });

  it('should accept a date query param', async () => {
    vi.mocked(getWeeklyMetrics).mockResolvedValue(mockWeekly);

    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/weekly?date=2024-01-07',
    });

    expect(res.statusCode).toBe(200);
    expect(getWeeklyMetrics).toHaveBeenCalledWith(expect.any(Date));
  });

  it('should return 400 for invalid date format', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/weekly?date=not-a-date',
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/metrics/monthly', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with monthly metrics', async () => {
    vi.mocked(getMonthlyMetrics).mockResolvedValue(mockMonthly);

    const res = await app.inject({ method: 'GET', url: '/api/metrics/monthly' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: typeof mockMonthly };
    expect(body.data.totalNewsCollected).toBe(1400);
    expect(body.data.topCategories).toHaveLength(1);
  });

  it('should accept a month query param', async () => {
    vi.mocked(getMonthlyMetrics).mockResolvedValue(mockMonthly);

    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/monthly?month=2024-01',
    });

    expect(res.statusCode).toBe(200);
    expect(getMonthlyMetrics).toHaveBeenCalledWith(2024, 1);
  });

  it('should return 400 for invalid month format', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/monthly?month=2024/01',
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /api/metrics/dashboard (admin)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 401 without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/metrics/dashboard' });

    expect(res.statusCode).toBe(401);
    expect(getDashboardMetrics).not.toHaveBeenCalled();
  });

  it('should return 401 with an invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/dashboard',
      headers: { authorization: 'Bearer not-a-jwt' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 403 for an authenticated non-admin user', async () => {
    const token = await signToken({
      sub: 'bbbbbbbb-0000-0000-0000-000000000002',
      email: 'user@test.com',
      role: 'USER',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body) as { error: string };
    expect(body.error).toBe('Admin access required');
    expect(getDashboardMetrics).not.toHaveBeenCalled();
  });

  it('should return 200 with dashboard metrics for an ADMIN', async () => {
    vi.mocked(getDashboardMetrics).mockResolvedValue(mockDashboard);
    const token = await signToken({
      sub: 'aaaaaaaa-0000-0000-0000-000000000001',
      email: 'admin@test.com',
      role: 'ADMIN',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: typeof mockDashboard };
    expect(body.data.today?.newsCollected).toBe(50);
    expect(body.data.today?.articleGenerated).toBe(true);
    expect(body.data.lastWeek.totalDays).toBe(7);
    expect(body.data.lastMonth.totalNewsCollected).toBe(1400);
  });

  it('should handle null today when no pipeline ran today', async () => {
    vi.mocked(getDashboardMetrics).mockResolvedValue({ ...mockDashboard, today: null });
    const token = await signToken({
      sub: 'aaaaaaaa-0000-0000-0000-000000000001',
      email: 'admin@test.com',
      role: 'ADMIN',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/dashboard',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { today: null } };
    expect(body.data).toBeDefined();
    expect(body.data.today).toBeNull();
  });
});

/**
 * Métricas de produto — mesmo guarda do `/dashboard`, e mais uma razão para
 * ele: a resposta inclui **termo de busca digitado por leitor**. Já sai
 * higienizado da origem, e ainda assim só deve chegar a quem administra.
 */
describe('GET /api/metrics/product (admin)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const mockProduct = {
    period: {
      start: '2026-07-23T00:00:00.000Z',
      end: '2026-08-22T00:00:00.000Z',
      days: 30,
    },
    audience: { sessions: 12, newsletterSubscribers: 42, accounts: 7 },
    byDay: [{ date: '2026-08-22', sessions: 3, events: 9 }],
    byType: [{ type: 'homepage_view', count: 9 }],
    storyOpensBySource: [{ source: 'hero', count: 4 }],
    categoryViews: [{ category: 'HEALTH', count: 2 }],
    readingDepth: { opened: 6, scroll25: 4, scroll50: 3, scroll90: 1 },
    searchesWithoutResults: [{ query: 'eclipse', count: 2 }],
  };

  it('should return 401 without a token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/product',
    });

    expect(res.statusCode).toBe(401);
  });

  it('should return 403 for an authenticated non-admin user', async () => {
    const token = await signToken({
      sub: 'bbbbbbbb-0000-0000-0000-000000000002',
      email: 'user@test.com',
      role: 'USER',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/product',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(getProductMetrics).not.toHaveBeenCalled();
  });

  it('should return 200 with product metrics for an ADMIN', async () => {
    vi.mocked(getProductMetrics).mockResolvedValue(mockProduct);
    const token = await signToken({
      sub: 'aaaaaaaa-0000-0000-0000-000000000001',
      email: 'admin@test.com',
      role: 'ADMIN',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/product',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: typeof mockProduct };
    expect(body.data.audience.newsletterSubscribers).toBe(42);
    expect(body.data.storyOpensBySource[0]?.source).toBe('hero');
    // O schema é o contrato: campo que ele não declara é descartado na
    // serialização, sem erro nenhum.
    expect(body.data.searchesWithoutResults[0]?.query).toBe('eclipse');
    expect(body.data.readingDepth.scroll90).toBe(1);
  });

  it('should honour the requested window', async () => {
    vi.mocked(getProductMetrics).mockResolvedValue(mockProduct);
    const token = await signToken({
      sub: 'aaaaaaaa-0000-0000-0000-000000000001',
      email: 'admin@test.com',
      role: 'ADMIN',
    });

    await app.inject({
      method: 'GET',
      url: '/api/metrics/product?days=7',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(getProductMetrics).toHaveBeenCalledWith(7);
  });

  it('should reject a window beyond the raw-event retention', async () => {
    // 90 dias é quando o expurgo apaga o evento cru: uma janela maior mostraria
    // queda onde houve apagamento.
    const token = await signToken({
      sub: 'aaaaaaaa-0000-0000-0000-000000000001',
      email: 'admin@test.com',
      role: 'ADMIN',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/metrics/product?days=365',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(400);
  });
});
