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

export interface MonthlyMetricsSummary {
  totalNewsCollected: number;
  totalArticlesGenerated: number;
  avgNewsPerDay: number;
  failureDays: number;
}

export interface DashboardToday {
  newsCollected: number;
  articleGenerated: boolean;
  aiProvider: string | null;
  pipelineDuration: number | null;
  pipelineErrors: number;
}

export interface DashboardMetrics {
  today: DashboardToday | null;
  lastWeek: WeeklyMetrics;
  lastMonth: MonthlyMetricsSummary;
}
