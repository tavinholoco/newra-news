import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      dailyMetric: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  };
});

import { prisma } from '@newranews/database';
import {
  getWeeklyMetrics,
  getMonthlyMetrics,
  getDashboardMetrics,
} from '../../src/services/metrics.service';

const makeDailyMetric = (overrides: Record<string, unknown> = {}) => ({
  id: 'metric-uuid-1',
  date: new Date('2024-01-15T00:00:00Z'),
  newsCollected: 50,
  newsApiCount: 30,
  rssCount: 20,
  articleGenerated: true,
  aiProvider: 'gemini',
  pipelineDuration: 12000,
  pipelineErrors: 0,
  newsByCategory: { TECHNOLOGY: 20, WORLD: 15, ECONOMY: 15 } as Record<string, number>,
  createdAt: new Date('2024-01-15T08:00:00Z'),
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getWeeklyMetrics', () => {
  it('should return aggregated metrics for 7-day window', async () => {
    const rows = [
      makeDailyMetric({ date: new Date('2024-01-14T00:00:00Z'), newsCollected: 40 }),
      makeDailyMetric({ date: new Date('2024-01-15T00:00:00Z'), newsCollected: 60 }),
    ];
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue(rows as never);

    const result = await getWeeklyMetrics(new Date('2024-01-15T12:00:00Z'));

    expect(result.totalDays).toBe(2);
    expect(result.avgNewsPerDay).toBe(50);
    expect(result.totalArticlesGenerated).toBe(2);
    expect(result.pipelineSuccessRate).toBe(1);
    expect(result.avgPipelineDuration).toBe(12000);
    expect(result.newsByCategory).toEqual({ TECHNOLOGY: 40, WORLD: 30, ECONOMY: 30 });
    expect(result.aiProviderUsage).toEqual({ gemini: 2 });
    expect(result.period.start).toBeDefined();
    expect(result.period.end).toBeDefined();
  });

  it('should return zeros when no data exists', async () => {
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue([]);

    const result = await getWeeklyMetrics(new Date('2024-01-15T12:00:00Z'));

    expect(result.totalDays).toBe(0);
    expect(result.avgNewsPerDay).toBe(0);
    expect(result.totalArticlesGenerated).toBe(0);
    expect(result.pipelineSuccessRate).toBe(0);
    expect(result.avgPipelineDuration).toBeNull();
    expect(result.newsByCategory).toEqual({});
    expect(result.aiProviderUsage).toEqual({});
  });

  it('should return null avgPipelineDuration when no rows have duration', async () => {
    const rows = [makeDailyMetric({ pipelineDuration: null })];
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue(rows as never);

    const result = await getWeeklyMetrics(new Date('2024-01-15T12:00:00Z'));

    expect(result.avgPipelineDuration).toBeNull();
  });

  it('should count pipeline errors as failure days', async () => {
    const rows = [
      makeDailyMetric({ pipelineErrors: 0 }),
      makeDailyMetric({ pipelineErrors: 2 }),
    ];
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue(rows as never);

    const result = await getWeeklyMetrics(new Date('2024-01-15T12:00:00Z'));

    expect(result.pipelineSuccessRate).toBe(0.5);
  });

  it('should aggregate aiProviderUsage across rows', async () => {
    const rows = [
      makeDailyMetric({ aiProvider: 'gemini' }),
      makeDailyMetric({ aiProvider: 'groq' }),
      makeDailyMetric({ aiProvider: 'gemini' }),
    ];
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue(rows as never);

    const result = await getWeeklyMetrics(new Date('2024-01-15T12:00:00Z'));

    expect(result.aiProviderUsage).toEqual({ gemini: 2, groq: 1 });
  });
});

describe('getMonthlyMetrics', () => {
  it('should return aggregated metrics for the month', async () => {
    const rows = [
      makeDailyMetric({ newsCollected: 40, newsApiCount: 25, rssCount: 15 }),
      makeDailyMetric({ newsCollected: 60, newsApiCount: 35, rssCount: 25 }),
    ];
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue(rows as never);

    const result = await getMonthlyMetrics(2024, 1);

    expect(result.period.month).toBe('2024-01');
    expect(result.totalNewsCollected).toBe(100);
    expect(result.totalArticlesGenerated).toBe(2);
    expect(result.avgNewsPerDay).toBe(50);
    expect(result.newsApiTotal).toBe(60);
    expect(result.rssTotal).toBe(40);
    expect(result.failureDays).toBe(0);
  });

  it('should sort topCategories by count descending', async () => {
    const rows = [
      makeDailyMetric({ newsByCategory: { SPORTS: 10, TECHNOLOGY: 50, WORLD: 30 } }),
    ];
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue(rows as never);

    const result = await getMonthlyMetrics(2024, 1);

    expect(result.topCategories[0]!.category).toBe('TECHNOLOGY');
    expect(result.topCategories[1]!.category).toBe('WORLD');
    expect(result.topCategories[2]!.category).toBe('SPORTS');
  });

  it('should return zeros when no data exists', async () => {
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue([]);

    const result = await getMonthlyMetrics(2024, 1);

    expect(result.totalNewsCollected).toBe(0);
    expect(result.totalArticlesGenerated).toBe(0);
    expect(result.avgNewsPerDay).toBe(0);
    expect(result.topCategories).toEqual([]);
    expect(result.failureDays).toBe(0);
  });

  it('should count failure days correctly', async () => {
    const rows = [
      makeDailyMetric({ pipelineErrors: 0 }),
      makeDailyMetric({ pipelineErrors: 1 }),
      makeDailyMetric({ pipelineErrors: 3 }),
    ];
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue(rows as never);

    const result = await getMonthlyMetrics(2024, 1);

    expect(result.failureDays).toBe(2);
  });

  it('should pad single-digit months with zero', async () => {
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue([]);

    const result = await getMonthlyMetrics(2024, 3);

    expect(result.period.month).toBe('2024-03');
  });
});

describe('getDashboardMetrics', () => {
  it('should return today=null when no pipeline ran today', async () => {
    vi.mocked(prisma.dailyMetric.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue([]);

    const result = await getDashboardMetrics();

    expect(result.today).toBeNull();
  });

  it('should return today data when pipeline ran today', async () => {
    const todayRow = makeDailyMetric({ newsCollected: 55, aiProvider: 'groq' });
    vi.mocked(prisma.dailyMetric.findFirst).mockResolvedValue(todayRow as never);
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue([todayRow] as never);

    const result = await getDashboardMetrics();

    expect(result.today).not.toBeNull();
    expect(result.today!.newsCollected).toBe(55);
    expect(result.today!.aiProvider).toBe('groq');
    expect(result.today!.articleGenerated).toBe(true);
  });

  it('should include lastWeek and lastMonth summaries', async () => {
    vi.mocked(prisma.dailyMetric.findFirst).mockResolvedValue(null);
    const rows = [
      makeDailyMetric({ newsCollected: 40 }),
      makeDailyMetric({ newsCollected: 60 }),
    ];
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue(rows as never);

    const result = await getDashboardMetrics();

    expect(result.lastWeek).toBeDefined();
    expect(result.lastWeek.totalDays).toBeGreaterThanOrEqual(0);
    expect(result.lastMonth).toBeDefined();
    expect(result.lastMonth.totalNewsCollected).toBe(100);
    expect(result.lastMonth.avgNewsPerDay).toBe(50);
  });
});
