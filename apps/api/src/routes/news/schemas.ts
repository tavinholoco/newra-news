import { z } from 'zod';

const CATEGORIES = [
  'TECHNOLOGY',
  'POLITICS',
  'ECONOMY',
  'SPORTS',
  'SCIENCE',
  'ENTERTAINMENT',
  'WORLD',
  'HEALTH',
] as const;

export const listNewsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: z.enum(CATEGORIES).optional(),
  search: z.string().optional(),
  date: z.string().datetime().optional(),
});

export const newsParamsSchema = z.object({
  id: z.string().uuid(),
});

export const newsItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  content: z.string().nullable(),
  source: z.string(),
  sourceUrl: z.string(),
  imageUrl: z.string().nullable(),
  category: z.enum(CATEGORIES),
  publishedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const listNewsResponseSchema = z.object({
  data: z.array(newsItemSchema),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const getNewsByIdResponseSchema = z.object({
  data: newsItemSchema,
});

export type ListNewsQuery = z.infer<typeof listNewsQuerySchema>;
export type ListNewsResponse = z.infer<typeof listNewsResponseSchema>;
export type NewsParams = z.infer<typeof newsParamsSchema>;
export type GetNewsByIdResponse = z.infer<typeof getNewsByIdResponseSchema>;

export { errorResponseSchema } from '../../utils/schemas';
