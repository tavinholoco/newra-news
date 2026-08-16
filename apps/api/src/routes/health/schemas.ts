import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
  uptime: z.number(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const providerStatusSchema = z.enum(['ok', 'invalid', 'not_configured']);

export const providersHealthResponseSchema = z.object({
  newsdata: providerStatusSchema,
  gemini: providerStatusSchema,
  groq: providerStatusSchema,
});

export type ProvidersHealthResponse = z.infer<typeof providersHealthResponseSchema>;
