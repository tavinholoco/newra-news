import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      article: {
        findMany: vi.fn(),
        count: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
      },
    },
  };
});

import { prisma } from '@newranews/database';
import { listArticles, getLatestArticle, getArticleByDate } from '../../src/services/article.service';

const mockArticle = {
  id: 'article-uuid-1',
  date: new Date('2024-01-15'),
  title: 'Test Article',
  summary: 'Summary text',
  content: 'Content text',
  provider: 'gemini',
  createdAt: new Date('2024-01-15T08:00:00Z'),
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('listArticles', () => {
  it('should return data and total count', async () => {
    vi.mocked(prisma.article.findMany).mockResolvedValue([mockArticle] as never);
    vi.mocked(prisma.article.count).mockResolvedValue(1);

    const result = await listArticles({ page: 1, limit: 10 });

    expect(result.data).toEqual([mockArticle]);
    expect(result.total).toBe(1);
  });

  it('should calculate skip=0 for page 1', async () => {
    vi.mocked(prisma.article.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.article.count).mockResolvedValue(0);

    await listArticles({ page: 1, limit: 10 });

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
  });

  it('should calculate skip correctly for page 2', async () => {
    vi.mocked(prisma.article.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.article.count).mockResolvedValue(25);

    await listArticles({ page: 2, limit: 10 });

    expect(prisma.article.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it('should return empty data and zero total when no articles exist', async () => {
    vi.mocked(prisma.article.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.article.count).mockResolvedValue(0);

    const result = await listArticles({ page: 1, limit: 10 });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe('getLatestArticle', () => {
  it('should return the most recent article', async () => {
    vi.mocked(prisma.article.findFirst).mockResolvedValue(mockArticle as never);

    const result = await getLatestArticle();

    expect(result).toEqual(mockArticle);
    expect(prisma.article.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { date: 'desc' } }),
    );
  });

  it('should return null when no articles exist', async () => {
    vi.mocked(prisma.article.findFirst).mockResolvedValue(null);

    const result = await getLatestArticle();

    expect(result).toBeNull();
  });
});

describe('getArticleByDate', () => {
  it('should return article matching the given date', async () => {
    vi.mocked(prisma.article.findUnique).mockResolvedValue(mockArticle as never);

    const result = await getArticleByDate('2024-01-15');

    expect(result).toEqual(mockArticle);
  });

  it('should return null when no article matches the date', async () => {
    vi.mocked(prisma.article.findUnique).mockResolvedValue(null);

    const result = await getArticleByDate('2024-01-15');

    expect(result).toBeNull();
  });

  it('should pass a Date object converted from the string to findUnique', async () => {
    vi.mocked(prisma.article.findUnique).mockResolvedValue(null);

    await getArticleByDate('2024-01-15');

    expect(prisma.article.findUnique).toHaveBeenCalledWith({
      where: { date: new Date('2024-01-15') },
    });
  });
});
