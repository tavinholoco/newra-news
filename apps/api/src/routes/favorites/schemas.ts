import { z } from 'zod';
import { newsItemSchema } from '../news/schemas';

export const listFavoritesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const favoriteParamsSchema = z.object({
  newsId: z.string().uuid(),
});

export const addFavoriteBodySchema = z.object({
  newsId: z.string().uuid(),
});

export const favoriteItemSchema = z.object({
  id: z.string().uuid(),
  newsId: z.string().uuid(),
  createdAt: z.string().datetime(),
  news: newsItemSchema,
});

export const listFavoritesResponseSchema = z.object({
  data: z.array(favoriteItemSchema),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const addFavoriteResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    newsId: z.string().uuid(),
    createdAt: z.string().datetime(),
  }),
});

export const removeFavoriteResponseSchema = z.object({
  data: z.object({
    removed: z.boolean(),
  }),
});

export type ListFavoritesQuery = z.infer<typeof listFavoritesQuerySchema>;
export type FavoriteParams = z.infer<typeof favoriteParamsSchema>;
export type AddFavoriteBody = z.infer<typeof addFavoriteBodySchema>;

export { errorResponseSchema } from '../../utils/schemas';
