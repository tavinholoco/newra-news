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

/**
 * As dimensões de filtro da §7 do plano V2, compartilhadas entre a listagem e
 * as facetas — os dois precisam interpretar `?search=` e `?from=` do mesmo
 * jeito, senão a contagem do chip não bate com a lista que ele abre.
 *
 * `date` (dia exato) veio da V1 e continua valendo; `from`/`to` é o período que
 * o filtro novo escreve. Todos são opcionais: `/api/news` sem query nenhuma
 * responde o mesmo que respondia antes.
 */
export const newsFilterQuerySchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  search: z.string().optional(),
  date: z.string().datetime().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  source: z.string().min(1).max(200).optional(),
});

export const listNewsQuerySchema = newsFilterQuerySchema.extend({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['recent', 'oldest']).default('recent'),
});

export const newsFacetsQuerySchema = newsFilterQuerySchema;

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

/**
 * Facetas do acervo (§7): quantas matérias cada categoria e cada fonte têm
 * **dentro do recorte atual**.
 *
 * É o que permite ao `category-nav` mostrar contagem sem disparar uma consulta
 * por categoria. `total` já leva todos os filtros; as duas listas ignoram a
 * própria dimensão — ver `getNewsFacets`.
 */
export const newsFacetsResponseSchema = z.object({
  data: z.object({
    total: z.number().int(),
    categories: z.array(
      z.object({
        category: z.enum(CATEGORIES),
        count: z.number().int(),
      }),
    ),
    sources: z.array(
      z.object({
        source: z.string(),
        count: z.number().int(),
      }),
    ),
  }),
});

export const deleteNewsResponseSchema = z.object({
  data: z.object({
    deleted: z.boolean(),
    id: z.string().uuid(),
  }),
});

export type ListNewsQuery = z.infer<typeof listNewsQuerySchema>;
export type ListNewsResponse = z.infer<typeof listNewsResponseSchema>;
export type NewsFacetsQuery = z.infer<typeof newsFacetsQuerySchema>;
export type NewsFacetsResponse = z.infer<typeof newsFacetsResponseSchema>;
export type NewsParams = z.infer<typeof newsParamsSchema>;
export type GetNewsByIdResponse = z.infer<typeof getNewsByIdResponseSchema>;

export { errorResponseSchema } from '../../utils/schemas';
