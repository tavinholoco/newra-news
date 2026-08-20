import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { getWeeklyMetrics, getMonthlyMetrics } from '../../services/metrics.service';
import {
  weeklyQuerySchema,
  monthlyQuerySchema,
  weeklyMetricsResponseSchema,
  monthlyMetricsResponseSchema,
} from './schemas';

export async function metricsRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/weekly',
    {
      schema: {
        querystring: weeklyQuerySchema,
        response: { 200: weeklyMetricsResponseSchema },
      },
    },
    async (request) => {
      const { date } = request.query;
      const referenceDate = date ? new Date(date) : new Date();
      const data = await getWeeklyMetrics(referenceDate);
      return { data };
    },
  );

  typed.get(
    '/monthly',
    {
      schema: {
        querystring: monthlyQuerySchema,
        response: { 200: monthlyMetricsResponseSchema },
      },
    },
    async (request) => {
      const { month } = request.query;
      const now = new Date();
      const year = month ? parseInt(month.split('-')[0]!, 10) : now.getFullYear();
      const monthNum = month ? parseInt(month.split('-')[1]!, 10) : now.getMonth() + 1;
      const data = await getMonthlyMetrics(year, monthNum);
      return { data };
    },
  );
}
