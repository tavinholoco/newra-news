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

export type ListNewsQuery = z.infer<typeof listNewsQuerySchema>;
export type ListNewsResponse = z.infer<typeof listNewsResponseSchema>;
export type NewsParams = z.infer<typeof newsParamsSchema>;
export type GetNewsByIdResponse = { data: z.infer<typeof newsItemSchema> };

export const listNewsQueryJsonSchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    category: { type: 'string', enum: CATEGORIES },
    search: { type: 'string' },
    date: { type: 'string', format: 'date-time' },
  },
} as const;

export const newsItemJsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    description: { type: 'string' },
    content: { type: 'string', nullable: true },
    source: { type: 'string' },
    sourceUrl: { type: 'string' },
    imageUrl: { type: 'string', nullable: true },
    category: { type: 'string', enum: CATEGORIES },
    publishedAt: { type: 'string', format: 'date-time' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'title', 'description', 'content', 'source', 'sourceUrl', 'imageUrl', 'category', 'publishedAt', 'createdAt'],
} as const;

export const newsParamsJsonSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
  },
  required: ['id'],
} as const;

export const getNewsByIdResponseJsonSchema = {
  type: 'object',
  properties: {
    data: newsItemJsonSchema,
  },
  required: ['data'],
} as const;

export const listNewsResponseJsonSchema = {
  type: 'object',
  properties: {
    data: { type: 'array', items: newsItemJsonSchema },
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
