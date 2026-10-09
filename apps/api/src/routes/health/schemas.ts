import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
  uptime: z.number(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

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
