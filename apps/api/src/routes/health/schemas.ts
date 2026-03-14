import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
  uptime: z.number(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const healthResponseJsonSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok'] },
    timestamp: { type: 'string', format: 'date-time' },
    uptime: { type: 'number' },
  },
  required: ['status', 'timestamp', 'uptime'],
} as const;
