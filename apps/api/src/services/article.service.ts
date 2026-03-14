import { prisma } from '@newranews/database';

interface ListArticlesPagination {
  page: number;
  limit: number;
}

export async function listArticles(pagination: ListArticlesPagination) {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.article.findMany({
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.article.count(),
  ]);

  return { data, total };
}

export async function getLatestArticle() {
  return prisma.article.findFirst({ orderBy: { date: 'desc' } });
}

export async function getArticleByDate(date: string) {
  return prisma.article.findUnique({ where: { date: new Date(date) } });
}
