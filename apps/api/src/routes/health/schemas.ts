import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
  uptime: z.number(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * As horas desta API no Render — P7 do plano de ação de 11/11/2026. Quem lê é
 * o Heartbeat (`scripts/heartbeat.ts`), que não importa nada do projeto; os
 * dias são UTC (`YYYY-MM-DD`), e os segundos, a soma do `DailyUptime`.
 */
export const healthHoursResponseSchema = z.object({
  data: z.object({
    yesterday: z.object({ date: z.string(), seconds: z.number().int().nonnegative() }),
    month: z.object({ start: z.string(), seconds: z.number().int().nonnegative() }),
    checkedAt: z.string().datetime(),
  }),
});

export const providerStatusSchema = z.enum(['ok', 'invalid', 'not_configured']);

/**
 * A resposta da sonda do par de JWT (13.7). O que importa é o status — 200 é
 * "a API aceita o que a Vercel assina"; o corpo é a confirmação.
 */
export const healthAuthResponseSchema = z.object({
  data: z.object({ accepted: z.literal(true) }),
});

export const providersHealthResponseSchema = z.object({
  newsdata: providerStatusSchema,
  gemini: providerStatusSchema,
  groq: providerStatusSchema,
});

export type ProvidersHealthResponse = z.infer<typeof providersHealthResponseSchema>;
