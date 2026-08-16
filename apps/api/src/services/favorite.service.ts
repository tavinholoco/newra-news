import { prisma } from '@newranews/database';

interface Pagination {
  page: number;
  limit: number;
}

/**
 * Lista os favoritos do usuário (mais recentes primeiro) com a notícia embutida.
 * O join é manual (2 queries): o schema do projeto não usa FKs/relações
 * explícitas — mesmo padrão dos demais models (campos + índices).
 */
export async function listFavorites(userId: string, { page, limit }: Pagination) {
  const skip = (page - 1) * limit;

  const [favorites, total] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.favorite.count({ where: { userId } }),
  ]);

  const newsIds = favorites.map((favorite) => favorite.newsId);
  const news = newsIds.length
    ? await prisma.news.findMany({ where: { id: { in: newsIds } } })
    : [];
  const newsById = new Map(news.map((item) => [item.id, item]));

  // Proteção contra notícia removida: favorito sem notícia é omitido
  const data = favorites
    .map((favorite) => ({ ...favorite, news: newsById.get(favorite.newsId) }))
    .filter((item) => item.news !== undefined);

  return { data, total };
}

/**
 * Adiciona um favorito. Retorna null se a notícia não existe (rota → 404).
 * Idempotente: se o favorito já existe, retorna o existente.
 */
export async function addFavorite(userId: string, newsId: string) {
  const news = await prisma.news.findUnique({ where: { id: newsId } });
  if (!news) return null;

  return prisma.favorite.upsert({
    where: { userId_newsId: { userId, newsId } },
    create: { userId, newsId },
    update: {},
  });
}

/**
 * Remove um favorito. Retorna false se não existia (rota → 404).
 */
export async function removeFavorite(userId: string, newsId: string) {
  const existing = await prisma.favorite.findUnique({
    where: { userId_newsId: { userId, newsId } },
  });
  if (!existing) return false;

  await prisma.favorite.delete({ where: { id: existing.id } });
  return true;
}
