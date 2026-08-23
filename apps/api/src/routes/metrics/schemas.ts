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

/**
 * Métricas de produto. **O schema é o contrato** — campo que o serviço carrega e
 * o schema não declara é buscado e descartado na serialização, sem erro nenhum
 * (foi assim que a auditoria do briefing ficou invisível por um dia).
 */
const productMetricsSchema = z.object({
  period: z.object({
    start: z.string(),
    end: z.string(),
    days: z.number().int(),
  }),
  audience: z.object({
    sessions: z.number().int(),
    newsletterSubscribers: z.number().int(),
    accounts: z.number().int(),
  }),
  byDay: z.array(
    z.object({
      date: z.string(),
      sessions: z.number().int(),
      events: z.number().int(),
    }),
  ),
  byType: z.array(z.object({ type: z.string(), count: z.number().int() })),
  storyOpensBySource: z.array(
    z.object({ source: z.string(), count: z.number().int() }),
  ),
  categoryViews: z.array(
    z.object({ category: z.string(), count: z.number().int() }),
  ),
  readingDepth: z.object({
    opened: z.number().int(),
    scroll25: z.number().int(),
    scroll50: z.number().int(),
    scroll90: z.number().int(),
  }),
  searchesWithoutResults: z.array(
    z.object({ query: z.string(), count: z.number().int() }),
  ),
});

export const productMetricsResponseSchema = z.object({
  data: productMetricsSchema,
});

export const productQuerySchema = z.object({
  // 90 é a retenção do evento cru: pedir mais devolveria uma janela que o
  // expurgo já esvaziou, e a tela mostraria queda onde houve apagamento.
  days: z.coerce.number().int().min(1).max(90).default(30),
});

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

/**
 * Metricas de HTTP do processo (§9.5).
 *
 * `since` e `uptimeSeconds` nao sao enfeite: sao o que diz **de quanto tempo**
 * a janela fala. Sem eles, um `errorRate: 0` logo depois de um deploy pareceria
 * saude e seria so ausencia de amostra.
 */
const httpMetricsRouteSchema = z.object({
  route: z.string(),
  count: z.number(),
  errorRate: z.number(),
  avgMs: z.number(),
  p95Ms: z.number(),
  maxMs: z.number(),
});

export const httpMetricsSchema = z.object({
  since: z.string(),
  uptimeSeconds: z.number(),
  totalRequests: z.number(),
  errorRate: z.number(),
  clientErrorRate: z.number(),
  latencyMs: z.object({
    avg: z.number(),
    p50: z.number(),
    p95: z.number(),
    p99: z.number(),
    max: z.number(),
  }),
  routes: z.array(httpMetricsRouteSchema),
});

export const httpMetricsResponseSchema = z.object({ data: httpMetricsSchema });

export { errorResponseSchema } from '../../utils/schemas';
