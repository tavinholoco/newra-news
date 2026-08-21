import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      news: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        groupBy: vi.fn(),
      },
    },
  };
});

import { prisma } from '@newranews/database';
import {
  listNews,
  getNewsById,
  getNewsFacets,
  buildNewsWhere,
} from '../../src/services/news.service';

const mockNewsItem = {
  id: 'news-uuid-1',
  title: 'Test News',
  description: 'Description text',
  content: null,
  source: 'G1',
  sourceUrl: 'https://g1.com/test',
  imageUrl: null,
  category: 'TECHNOLOGY' as const,
  publishedAt: new Date('2024-01-15T10:00:00Z'),
  createdAt: new Date('2024-01-15T10:05:00Z'),
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.news.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.news.count).mockResolvedValue(0);
  vi.mocked(prisma.news.groupBy).mockResolvedValue([] as never);
});

describe('listNews', () => {
  it('should query with empty where when no filters provided', async () => {
    await listNews({}, { page: 1, limit: 10 });

    expect(prisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('should filter by category', async () => {
    await listNews({ category: 'TECHNOLOGY' as const }, { page: 1, limit: 10 });

    expect(prisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'TECHNOLOGY' }),
      }),
    );
  });

  it('should filter by search with case-insensitive OR on title and description', async () => {
    await listNews({ search: 'brazil' }, { page: 1, limit: 10 });

    expect(prisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { title: { contains: 'brazil', mode: 'insensitive' } },
            { description: { contains: 'brazil', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('should filter by date with a 24-hour window', async () => {
    await listNews({ date: '2024-01-15' }, { page: 1, limit: 10 });

    const startDate = new Date('2024-01-15');
    const endDate = new Date(startDate.getTime() + 86_400_000);

    expect(prisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          publishedAt: { gte: startDate, lt: endDate },
        }),
      }),
    );
  });

  it('should combine category and search filters', async () => {
    await listNews(
      { category: 'WORLD' as const, search: 'economy' },
      { page: 1, limit: 10 },
    );

    expect(prisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: 'WORLD',
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('should apply pagination with correct skip and take', async () => {
    await listNews({}, { page: 3, limit: 5 });

    expect(prisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
  });

  it('should return data and total count', async () => {
    vi.mocked(prisma.news.findMany).mockResolvedValue([mockNewsItem] as never);
    vi.mocked(prisma.news.count).mockResolvedValue(1);

    const result = await listNews({}, { page: 1, limit: 10 });

    expect(result.data).toEqual([mockNewsItem]);
    expect(result.total).toBe(1);
  });
});

describe('getNewsById', () => {
  it('should return the news item when found', async () => {
    vi.mocked(prisma.news.findUnique).mockResolvedValue(mockNewsItem as never);

    const result = await getNewsById('news-uuid-1');

    expect(result).toEqual(mockNewsItem);
    expect(prisma.news.findUnique).toHaveBeenCalledWith({
      where: { id: 'news-uuid-1' },
    });
  });

  it('should return null when news item is not found', async () => {
    vi.mocked(prisma.news.findUnique).mockResolvedValue(null);

    const result = await getNewsById('nonexistent-id');

    expect(result).toBeNull();
  });
});

describe('listNews — filtros e ordenação da Fase 4', () => {
  it('should order by publishedAt desc by default', async () => {
    await listNews({}, { page: 1, limit: 10 });

    expect(prisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { publishedAt: 'desc' } }),
    );
  });

  it('should order by publishedAt asc when sort is oldest', async () => {
    await listNews({}, { page: 1, limit: 10, sort: 'oldest' });

    expect(prisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { publishedAt: 'asc' } }),
    );
  });

  it('should filter by source, case-insensitively', async () => {
    await listNews({ source: 'g1' }, { page: 1, limit: 10 });

    expect(prisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: { equals: 'g1', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('should filter by an open-ended period', async () => {
    await listNews({ from: '2024-01-15T00:00:00.000Z' }, { page: 1, limit: 10 });

    expect(prisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          publishedAt: { gte: new Date('2024-01-15T00:00:00.000Z') },
        }),
      }),
    );
  });

  it('should let the period win over the single-day filter', async () => {
    // Os dois chegam juntos quando `?date=` sobrou na URL e o leitor mexeu no
    // controle de período. O controle que ele acabou de usar é que vale.
    await listNews(
      { date: '2024-01-15T00:00:00.000Z', from: '2024-02-01T00:00:00.000Z' },
      { page: 1, limit: 10 },
    );

    expect(prisma.news.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          publishedAt: { gte: new Date('2024-02-01T00:00:00.000Z') },
        }),
      }),
    );
  });
});

describe('buildNewsWhere', () => {
  it('should drop the omitted dimension and keep the others', () => {
    const where = buildNewsWhere(
      { category: 'SPORTS' as const, source: 'G1', search: 'copa' },
      'category',
    );

    expect(where.category).toBeUndefined();
    expect(where.source).toEqual({ equals: 'G1', mode: 'insensitive' });
    expect(where.OR).toBeDefined();
  });
});

describe('getNewsFacets', () => {
  it('should count categories ignoring the category filter', async () => {
    // O ponto da faceta: com SPORTS selecionado, as outras sete categorias
    // ainda precisam mostrar quantas matérias têm — senão o leitor não tem
    // como saber para onde trocar.
    await getNewsFacets({ category: 'SPORTS' as const, search: 'copa' });

    const [categoryCall] = vi
      .mocked(prisma.news.groupBy)
      .mock.calls.filter(
        (call) => (call[0] as { by: string[] }).by[0] === 'category',
      );

    const where = (categoryCall[0] as { where: Record<string, unknown> }).where;
    expect(where.category).toBeUndefined();
    expect(where.OR).toBeDefined();
  });

  it('should count sources ignoring the source filter but keeping the category', async () => {
    await getNewsFacets({ category: 'SPORTS' as const, source: 'G1' });

    const [sourceCall] = vi
      .mocked(prisma.news.groupBy)
      .mock.calls.filter(
        (call) => (call[0] as { by: string[] }).by[0] === 'source',
      );

    const where = (sourceCall[0] as { where: Record<string, unknown> }).where;
    expect(where.source).toBeUndefined();
    expect(where.category).toBe('SPORTS');
  });

  it('should not count the slice a second time', async () => {
    // Esse número é o `meta.total` da listagem. Um segundo total por outro
    // caminho são duas respostas para a mesma pergunta.
    vi.mocked(prisma.news.count).mockClear();
    await getNewsFacets({ category: 'SPORTS' as const });

    expect(prisma.news.count).not.toHaveBeenCalled();
  });

  it('should return categories sorted by count, descending', async () => {
    vi.mocked(prisma.news.groupBy).mockImplementation((async (args: {
      by: string[];
    }) => {
      if (args.by[0] === 'category') {
        return [
          { category: 'WORLD', _count: { _all: 3 } },
          { category: 'SPORTS', _count: { _all: 11 } },
        ];
      }
      return [{ source: 'G1', _count: { _all: 7 } }];
    }) as never);

    const facets = await getNewsFacets({});

    expect(facets.categories).toEqual([
      { category: 'SPORTS', count: 11 },
      { category: 'WORLD', count: 3 },
    ]);
    expect(facets.sources).toEqual([{ source: 'G1', count: 7 }]);
  });
});
