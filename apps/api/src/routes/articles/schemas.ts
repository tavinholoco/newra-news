import { z } from 'zod';

export const listArticlesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export const articleDateParamsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

export const articleItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  summary: z.string(),
  date: z.string().datetime(),
  newsCount: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const listArticlesResponseSchema = z.object({
  data: z.array(articleItemSchema),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const getArticleResponseSchema = z.object({
  data: articleItemSchema,
});

export type ListArticlesQuery = z.infer<typeof listArticlesQuerySchema>;
export type ListArticlesResponse = z.infer<typeof listArticlesResponseSchema>;
export type ArticleDateParams = z.infer<typeof articleDateParamsSchema>;
export type GetArticleResponse = z.infer<typeof getArticleResponseSchema>;

export { errorResponseSchema } from '../../utils/schemas';
