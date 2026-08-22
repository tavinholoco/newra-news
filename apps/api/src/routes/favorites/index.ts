import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  addFavorite,
  listFavoriteIds,
  listFavorites,
  removeFavorite,
  type FavoriteItem,
} from '../../services/favorite.service';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';
import { authPlugin } from '../../plugins/auth';
import {
  addFavoriteBodySchema,
  addFavoriteResponseSchema,
  favoriteIdsResponseSchema,
  favoriteParamsSchema,
  listFavoritesQuerySchema,
  listFavoritesResponseSchema,
  removeFavoriteResponseSchema,
} from './schemas';

/**
 * Resposta **por usuário** — por isso nenhuma rota daqui passa pelo
 * `withEditorialCache`. Um `s-maxage` num proxy compartilhado aqui serviria o
 * recorte de um leitor para o próximo.
 */
function serializeFavorite(item: FavoriteItem) {
  const base = {
    id: item.id,
    itemId: item.itemId,
    createdAt: item.createdAt.toISOString(),
  };

  if (item.itemType === 'NEWS') {
    return {
      ...base,
      itemType: 'NEWS' as const,
      news: {
        ...item.news,
        publishedAt: item.news.publishedAt.toISOString(),
        createdAt: item.news.createdAt.toISOString(),
        updatedAt: item.news.updatedAt.toISOString(),
      },
    };
  }

  return {
    ...base,
    itemType: 'ARTICLE' as const,
    article: {
      ...item.article,
      date: item.article.date.toISOString(),
    },
  };
}

export async function favoritesRoutes(app: FastifyInstance) {
  await app.register(authPlugin);

  const userIdOf = (sub?: string): string => {
    if (!sub) throw new UnauthorizedError('Invalid or missing token');
    return sub;
  };

  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        querystring: listFavoritesQuerySchema,
        response: { 200: listFavoritesResponseSchema },
      },
    },
    async (request) => {
      const { page, limit, sort, type, ...filters } = request.query;
      const { data, total } = await listFavorites(
        userIdOf(request.user?.sub),
        { ...filters, type },
        { page, limit, sort },
      );

      return {
        data: data.map(serializeFavorite),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/ids',
    { schema: { response: { 200: favoriteIdsResponseSchema } } },
    async (request) => {
      const data = await listFavoriteIds(userIdOf(request.user?.sub));
      return { data };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().post(
    '/',
    {
      schema: {
        body: addFavoriteBodySchema,
        response: { 200: addFavoriteResponseSchema },
      },
    },
    async (request) => {
      const { itemType, itemId } = request.body;
      const favorite = await addFavorite(userIdOf(request.user?.sub), itemType, itemId);
      if (!favorite) throw new NotFoundError(itemType === 'NEWS' ? 'News' : 'Article');

      return {
        data: {
          id: favorite.id,
          userId: favorite.userId,
          itemType: favorite.itemType,
          itemId: favorite.itemId,
          createdAt: favorite.createdAt.toISOString(),
        },
      };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:itemType/:itemId',
    {
      schema: {
        params: favoriteParamsSchema,
        response: { 200: removeFavoriteResponseSchema },
      },
    },
    async (request) => {
      const { itemType, itemId } = request.params;
      const removed = await removeFavorite(userIdOf(request.user?.sub), itemType, itemId);
      if (!removed) throw new NotFoundError('Favorite');

      return { data: { removed: true } };
    },
  );
}
