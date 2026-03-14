import { prisma } from '@newranews/database';
import type { Category } from '@newranews/database';

interface ListNewsFilters {
  category?: Category;
  search?: string;
  date?: string;
}

interface ListNewsPagination {
  page: number;
  limit: number;
}

export async function listNews(filters: ListNewsFilters, pagination: ListNewsPagination) {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;
  const startDate = filters.date ? new Date(filters.date) : undefined;

  const where = {
    ...(filters.category && { category: filters.category }),
    ...(filters.search && {
      OR: [
        { title: { contains: filters.search, mode: 'insensitive' as const } },
        { description: { contains: filters.search, mode: 'insensitive' as const } },
      ],
    }),
    ...(startDate && {
      publishedAt: {
        gte: startDate,
        lt: new Date(startDate.getTime() + 86_400_000),
      },
    }),
  };

  const [data, total] = await Promise.all([
    prisma.news.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.news.count({ where }),
  ]);

  return { data, total };
}

export async function getNewsById(id: string) {
  return prisma.news.findUnique({ where: { id } });
}
