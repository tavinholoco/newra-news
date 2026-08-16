import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { addFavorite, listFavorites, removeFavorite } from '../../services/favorite.service';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';
import { authPlugin } from '../../plugins/auth';
import {
  addFavoriteBodySchema,
  addFavoriteResponseSchema,
  favoriteParamsSchema,
  listFavoritesQuerySchema,
  listFavoritesResponseSchema,
  removeFavoriteResponseSchema,
} from './schemas';

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
      const { page, limit } = request.query;
      const { data, total } = await listFavorites(userIdOf(request.user?.sub), { page, limit });

      return {
        data: data.map((item) => ({
          id: item.id,
          newsId: item.newsId,
          createdAt: item.createdAt.toISOString(),
          news: {
            ...item.news!,
            publishedAt: item.news!.publishedAt.toISOString(),
            createdAt: item.news!.createdAt.toISOString(),
            updatedAt: item.news!.updatedAt.toISOString(),
          },
        })),
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
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
      const favorite = await addFavorite(userIdOf(request.user?.sub), request.body.newsId);
      if (!favorite) throw new NotFoundError('News');

      return {
        data: {
          id: favorite.id,
          userId: favorite.userId,
          newsId: favorite.newsId,
          createdAt: favorite.createdAt.toISOString(),
        },
      };
    },
  );

  app.withTypeProvider<ZodTypeProvider>().delete(
    '/:newsId',
    {
      schema: {
        params: favoriteParamsSchema,
        response: { 200: removeFavoriteResponseSchema },
      },
    },
    async (request) => {
      const removed = await removeFavorite(userIdOf(request.user?.sub), request.params.newsId);
      if (!removed) throw new NotFoundError('Favorite');

      return { data: { removed: true } };
    },
  );
}
