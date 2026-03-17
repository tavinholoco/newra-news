import { prisma } from '@newranews/database';

export interface WeeklyMetrics {
  period: { start: string; end: string };
  totalDays: number;
  avgNewsPerDay: number;
  totalArticlesGenerated: number;
  pipelineSuccessRate: number;
  avgPipelineDuration: number | null;
  newsByCategory: Record<string, number>;
  aiProviderUsage: Record<string, number>;
}

export interface MonthlyMetrics {
  period: { month: string };
  totalNewsCollected: number;
  totalArticlesGenerated: number;
  avgNewsPerDay: number;
  topCategories: Array<{ category: string; count: number }>;
  failureDays: number;
  newsApiTotal: number;
  rssTotal: number;
}

export interface DashboardMetrics {
  today: {
    newsCollected: number;
    articleGenerated: boolean;
    aiProvider: string | null;
    pipelineDuration: number | null;
    pipelineErrors: number;
  } | null;
  lastWeek: WeeklyMetrics;
  lastMonth: {
    totalNewsCollected: number;
    totalArticlesGenerated: number;
    avgNewsPerDay: number;
    failureDays: number;
  };
}

export async function getWeeklyMetrics(referenceDate: Date): Promise<WeeklyMetrics> {
  const end = new Date(referenceDate);
  end.setUTCHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.dailyMetric.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
  });

  const totalDays = rows.length;
  const totalNews = rows.reduce((sum, r) => sum + r.newsCollected, 0);
  const totalArticles = rows.filter((r) => r.articleGenerated).length;
  const successDays = rows.filter((r) => r.pipelineErrors === 0).length;
  const durRows = rows.filter((r) => r.pipelineDuration !== null);
  const avgDuration =
    durRows.length > 0
      ? durRows.reduce((sum, r) => sum + (r.pipelineDuration ?? 0), 0) / durRows.length
      : null;

  const newsByCategory: Record<string, number> = {};
  for (const row of rows) {
    const cats = row.newsByCategory as Record<string, number>;
    for (const [cat, count] of Object.entries(cats)) {
      newsByCategory[cat] = (newsByCategory[cat] ?? 0) + count;
    }
  }

  const aiProviderUsage: Record<string, number> = {};
  for (const row of rows) {
    if (row.aiProvider) {
      aiProviderUsage[row.aiProvider] = (aiProviderUsage[row.aiProvider] ?? 0) + 1;
    }
  }

  return {
    period: { start: start.toISOString(), end: end.toISOString() },
    totalDays,
    avgNewsPerDay: totalDays > 0 ? totalNews / totalDays : 0,
    totalArticlesGenerated: totalArticles,
    pipelineSuccessRate: totalDays > 0 ? successDays / totalDays : 0,
    avgPipelineDuration: avgDuration,
    newsByCategory,
    aiProviderUsage,
  };
}

export async function getMonthlyMetrics(year: number, month: number): Promise<MonthlyMetrics> {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const rows = await prisma.dailyMetric.findMany({
    where: { date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
  });

  const totalNews = rows.reduce((sum, r) => sum + r.newsCollected, 0);
  const totalArticles = rows.filter((r) => r.articleGenerated).length;
  const failureDays = rows.filter((r) => r.pipelineErrors > 0).length;
  const newsApiTotal = rows.reduce((sum, r) => sum + r.newsApiCount, 0);
  const rssTotal = rows.reduce((sum, r) => sum + r.rssCount, 0);

  const categoryTotals: Record<string, number> = {};
  for (const row of rows) {
    const cats = row.newsByCategory as Record<string, number>;
    for (const [cat, count] of Object.entries(cats)) {
      categoryTotals[cat] = (categoryTotals[cat] ?? 0) + count;
    }
  }

  const topCategories = Object.entries(categoryTotals)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const daysInMonth = rows.length;
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  return {
    period: { month: monthStr },
    totalNewsCollected: totalNews,
    totalArticlesGenerated: totalArticles,
    avgNewsPerDay: daysInMonth > 0 ? totalNews / daysInMonth : 0,
    topCategories,
    failureDays,
    newsApiTotal,
    rssTotal,
  };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

  const [todayRow, allRows, weekMetrics] = await Promise.all([
    prisma.dailyMetric.findFirst({ where: { date: { gte: todayStart, lte: todayEnd } } }),
    prisma.dailyMetric.findMany({ where: { date: { gte: thirtyDaysAgo } } }),
    getWeeklyMetrics(now),
  ]);

  const totalNews30 = allRows.reduce((sum, r) => sum + r.newsCollected, 0);
  const totalArticles30 = allRows.filter((r) => r.articleGenerated).length;
  const failureDays30 = allRows.filter((r) => r.pipelineErrors > 0).length;

  return {
    today: todayRow
      ? {
          newsCollected: todayRow.newsCollected,
          articleGenerated: todayRow.articleGenerated,
          aiProvider: todayRow.aiProvider,
          pipelineDuration: todayRow.pipelineDuration,
          pipelineErrors: todayRow.pipelineErrors,
        }
      : null,
    lastWeek: weekMetrics,
    lastMonth: {
      totalNewsCollected: totalNews30,
      totalArticlesGenerated: totalArticles30,
      avgNewsPerDay: allRows.length > 0 ? totalNews30 / allRows.length : 0,
      failureDays: failureDays30,
    },
  };
}
