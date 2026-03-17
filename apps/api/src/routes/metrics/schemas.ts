import { z } from 'zod';

const weeklyMetricsSchema = z.object({
  period: z.object({ start: z.string(), end: z.string() }),
  totalDays: z.number().int(),
  avgNewsPerDay: z.number(),
  totalArticlesGenerated: z.number().int(),
  pipelineSuccessRate: z.number(),
  avgPipelineDuration: z.number().nullable(),
  newsByCategory: z.record(z.number()),
  aiProviderUsage: z.record(z.number()),
});

export const weeklyMetricsResponseSchema = z.object({ data: weeklyMetricsSchema });
export type WeeklyMetricsResponse = z.infer<typeof weeklyMetricsResponseSchema>;

const monthlyMetricsSchema = z.object({
  period: z.object({ month: z.string() }),
  totalNewsCollected: z.number().int(),
  totalArticlesGenerated: z.number().int(),
  avgNewsPerDay: z.number(),
  topCategories: z.array(z.object({ category: z.string(), count: z.number().int() })),
  failureDays: z.number().int(),
  newsApiTotal: z.number().int(),
  rssTotal: z.number().int(),
});

export const monthlyMetricsResponseSchema = z.object({ data: monthlyMetricsSchema });
export type MonthlyMetricsResponse = z.infer<typeof monthlyMetricsResponseSchema>;

const dashboardMetricsSchema = z.object({
  today: z
    .object({
      newsCollected: z.number().int(),
      articleGenerated: z.boolean(),
      aiProvider: z.string().nullable(),
      pipelineDuration: z.number().int().nullable(),
      pipelineErrors: z.number().int(),
    })
    .nullable(),
  lastWeek: weeklyMetricsSchema,
  lastMonth: z.object({
    totalNewsCollected: z.number().int(),
    totalArticlesGenerated: z.number().int(),
    avgNewsPerDay: z.number(),
    failureDays: z.number().int(),
  }),
});

export const dashboardMetricsResponseSchema = z.object({ data: dashboardMetricsSchema });
export type DashboardMetricsResponse = z.infer<typeof dashboardMetricsResponseSchema>;

export const weeklyQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
});

export const monthlyQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format')
    .optional(),
});

export { errorResponseSchema } from '../../utils/schemas';
