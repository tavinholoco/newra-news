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
      },
    },
  };
});

import { prisma } from '@newranews/database';
import { listNews, getNewsById } from '../../src/services/news.service';

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
