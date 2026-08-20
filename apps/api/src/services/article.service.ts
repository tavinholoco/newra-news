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

/**
 * As fontes acompanham só os endpoints de detalhe. Na listagem seriam 15 linhas
 * por artigo sem nada as exibindo — peso morto na resposta.
 */
const withSources = {
  sources: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      position: true,
      title: true,
      source: true,
      sourceUrl: true,
      newsId: true,
    },
  },
} as const;

export async function getLatestArticle() {
  return prisma.article.findFirst({
    orderBy: { date: 'desc' },
    include: withSources,
  });
}

export async function getArticleByDate(date: string) {
  return prisma.article.findUnique({
    where: { date: new Date(date) },
    include: withSources,
  });
}
