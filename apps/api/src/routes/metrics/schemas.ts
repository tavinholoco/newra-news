import { z } from 'zod';
import type { ApiResponse, DashboardMetrics, HttpMetrics, ProductMetrics } from '@newranews/types';
import { assertContract } from '../../utils/contract';

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

/**
 * O bloco `today` é **uma linha do `DailyMetric`**, e por isso é ele que o
 * `response-schema-contract.test.ts` compara com as colunas do modelo.
 */
export const dashboardTodaySchema = z.object({
  newsCollected: z.number().int(),
  articleGenerated: z.boolean(),
  aiProvider: z.string().nullable(),
  pipelineDuration: z.number().int().nullable(),
  pipelineErrors: z.number().int(),
  /**
   * **As três colunas órfãs entraram na Fase 5.** O `DailyMetric` as grava
   * desde a V1 e este schema nunca as declarou — o serializador as
   * descartava em silêncio, e a rosquinha "ingestão por fonte" da §4.3 não
   * tinha de onde sair. O `response-schema-contract.test.ts` cobre o
   * `DailyMetric` desde então, e é ele que impede a quarta.
   */
  newsApiCount: z.number().int(),
  rssCount: z.number().int(),
  cleanupCount: z.number().int(),
});

const dashboardMetricsSchema = z.object({
  today: dashboardTodaySchema.nullable(),
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

/**
 * Saturação — o quarto sinal (§3.1). Cada medida traz teto e razão já
 * calculados; a tela desenha o arco sem conhecer o plano do Render.
 */
const saturationSchema = z.object({
  memory: z.object({
    rssBytes: z.number(),
    heapUsedBytes: z.number(),
    heapTotalBytes: z.number(),
    limitBytes: z.number(),
    ratio: z.number(),
  }),
  eventLoop: z.object({
    resolutionMs: z.number(),
    samples: z.number(),
    lagMs: z.object({ p50: z.number(), p95: z.number(), p99: z.number(), max: z.number() }),
  }),
  plan: z.object({
    month: z.string(),
    monthStart: z.string(),
    secondsUsed: z.number(),
    hoursUsed: z.number(),
    limitHours: z.number(),
    ratio: z.number(),
  }),
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
  saturation: saturationSchema,
});

export const httpMetricsResponseSchema = z.object({ data: httpMetricsSchema });

/**
 * As duas telas de admin. A `/weekly` está coberta de graça: o
 * `weeklyMetricsSchema` é reusado dentro do dashboard, que é o que a tela lê.
 *
 * A `/http` **deixou de ser exceção na Fase 5**: enquanto só o operador a lia
 * no `curl`, o motivo escrito era "sem tela"; no instante em que a saturação
 * passou a existir para ser desenhada (5c), o shape virou contrato e ganhou
 * tipo em `packages/types`. A `/monthly` continua de fora **com motivo
 * escrito** — a lista de exceções vive em
 * `tests/routes/shared-type-contract.test.ts`, e é ela que impede que "sem tipo
 * compartilhado" vire o default silencioso.
 */
assertContract<typeof dashboardMetricsResponseSchema, ApiResponse<DashboardMetrics>>(true);
assertContract<typeof productMetricsResponseSchema, ApiResponse<ProductMetrics>>(true);
assertContract<typeof httpMetricsResponseSchema, ApiResponse<HttpMetrics>>(true);

export { errorResponseSchema } from '../../utils/schemas';
