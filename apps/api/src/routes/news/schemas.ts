import { z } from 'zod';

export const listNewsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: z
    .enum([
      'TECHNOLOGY',
      'POLITICS',
      'ECONOMY',
      'SPORTS',
      'SCIENCE',
      'ENTERTAINMENT',
      'WORLD',
      'HEALTH',
    ])
    .optional(),
  search: z.string().optional(),
  date: z.string().datetime().optional(),
});

export const newsParamsSchema = z.object({
  id: z.string().uuid(),
});
