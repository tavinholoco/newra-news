import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildTestApp } from '../helpers/test-server';
import type { FastifyInstance } from 'fastify';

vi.mock('../../src/services/metrics.service', () => ({
  getWeeklyMetrics: vi.fn(),
  getMonthlyMetrics: vi.fn(),
  getDashboardMetrics: vi.fn(),
}));

vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3001,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test',
    NEWSAPI_KEY: 'test-key',
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-1.5-flash',
    GROQ_API_KEY: 'test-key',
    GROQ_MODEL: 'llama-3.1-8b-instant',
    JOB_SECRET: 'test-secret',
    CORS_ORIGIN: 'http://localhost:3000',
    CRON_SCHEDULE: '0 8 * * *',
    CRON_TIMEZONE: 'America/Sao_Paulo',
  },
}));

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

describe('GET /api/metrics/dashboard', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 with dashboard metrics', async () => {
    vi.mocked(getDashboardMetrics).mockResolvedValue(mockDashboard);

    const res = await app.inject({ method: 'GET', url: '/api/metrics/dashboard' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: typeof mockDashboard };
    expect(body.data.today?.newsCollected).toBe(50);
    expect(body.data.today?.articleGenerated).toBe(true);
    expect(body.data.lastWeek.totalDays).toBe(7);
    expect(body.data.lastMonth.totalNewsCollected).toBe(1400);
  });

  it('should handle null today when no pipeline ran today', async () => {
    vi.mocked(getDashboardMetrics).mockResolvedValue({ ...mockDashboard, today: null });

    const res = await app.inject({ method: 'GET', url: '/api/metrics/dashboard' });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: { today: null } };
    expect(body.data.today).toBeNull();
  });
});
