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

export type ListArticlesQuery = z.infer<typeof listArticlesQuerySchema>;
export type ListArticlesResponse = z.infer<typeof listArticlesResponseSchema>;
export type ArticleDateParams = z.infer<typeof articleDateParamsSchema>;
export type GetArticleResponse = { data: z.infer<typeof articleItemSchema> };

export const listArticlesQueryJsonSchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
  },
} as const;

export const articleItemJsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    content: { type: 'string' },
    summary: { type: 'string' },
    date: { type: 'string', format: 'date-time' },
    newsCount: { type: 'integer' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'title', 'content', 'summary', 'date', 'newsCount', 'createdAt', 'updatedAt'],
} as const;

export const articleDateParamsJsonSchema = {
  type: 'object',
  properties: {
    date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  },
  required: ['date'],
} as const;

export const getArticleResponseJsonSchema = {
  type: 'object',
  properties: {
    data: articleItemJsonSchema,
  },
  required: ['data'],
} as const;

export { errorResponseJsonSchema } from '../../utils/schemas';

export const listArticlesResponseJsonSchema = {
  type: 'object',
  properties: {
    data: { type: 'array', items: articleItemJsonSchema },
    meta: {
      type: 'object',
      properties: {
        total: { type: 'integer' },
        page: { type: 'integer' },
        limit: { type: 'integer' },
        totalPages: { type: 'integer' },
      },
      required: ['total', 'page', 'limit', 'totalPages'],
    },
  },
  required: ['data', 'meta'],
} as const;
