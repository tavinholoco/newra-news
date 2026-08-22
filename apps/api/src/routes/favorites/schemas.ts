import { z } from 'zod';
import { newsFilterQuerySchema, newsItemSchema } from '../news/schemas';

export const favoriteItemTypeSchema = z.enum(['NEWS', 'ARTICLE']);

/**
 * A listagem de salvos aceita **as mesmas dimensões do acervo** — o
 * `newsFilterQuerySchema` é o mesmo objeto, não uma cópia. É o que faz o
 * "somente salvos" da `/news` filtrar igual à `/news`: quando os dois lados
 * leem `?source=` do mesmo jeito, não há como a lista discordar do controle
 * que a abriu.
 *
 * `sort=saved` (padrão) ordena por quando o leitor salvou; `recent`/`oldest`
 * ordenam pela data do conteúdo, que é o que o seletor do acervo promete.
 */
export const listFavoritesQuerySchema = newsFilterQuerySchema.extend({
  type: favoriteItemTypeSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['saved', 'recent', 'oldest']).default('saved'),
});

/**
 * O tipo vem minúsculo na URL (`/favorites/news/<uuid>`) e sobe para o enum do
 * banco aqui — a rota é para ser lida por gente, o enum é para o Postgres.
 */
export const favoriteParamsSchema = z.object({
  itemType: z
    .enum(['news', 'article'])
    .transform((value) => value.toUpperCase() as 'NEWS' | 'ARTICLE'),
  itemId: z.string().uuid(),
});

export const addFavoriteBodySchema = z.object({
  itemType: favoriteItemTypeSchema.default('NEWS'),
  itemId: z.string().uuid(),
});

/** O briefing como ele aparece num card de salvos — sem o corpo inteiro. */
export const favoriteArticleSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  summary: z.string(),
  date: z.string().datetime(),
  newsCount: z.number().int(),
});

const favoriteBaseShape = {
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  createdAt: z.string().datetime(),
};

/**
 * União discriminada: o item traz `news` **ou** `article`, nunca os dois.
 *
 * Com schema de resposta declarado, o schema é o contrato — campo que o
 * serviço carrega e ele não declara é buscado e descartado em silêncio.
 */
export const favoriteItemSchema = z.discriminatedUnion('itemType', [
  z.object({
    ...favoriteBaseShape,
    itemType: z.literal('NEWS'),
    news: newsItemSchema,
  }),
  z.object({
    ...favoriteBaseShape,
    itemType: z.literal('ARTICLE'),
    article: favoriteArticleSchema,
  }),
]);

export const listFavoritesResponseSchema = z.object({
  data: z.array(favoriteItemSchema),
  meta: z.object({
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const favoriteIdsResponseSchema = z.object({
  data: z.object({
    news: z.array(z.string().uuid()),
    articles: z.array(z.string().uuid()),
  }),
});

export const addFavoriteResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    itemType: favoriteItemTypeSchema,
    itemId: z.string().uuid(),
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
