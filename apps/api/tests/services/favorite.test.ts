import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@newranews/database';
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from '../../src/services/favorite.service';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      news: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      favorite: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

const USER_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const NEWS_ID = 'cccccccc-0000-0000-0000-000000000001';

const makeNews = (id: string) => ({
  id,
  title: `Notícia ${id}`,
  description: 'Descrição',
  content: null,
  source: 'Fonte',
  sourceUrl: `https://example.com/${id}`,
  imageUrl: null,
  category: 'WORLD' as const,
  publishedAt: new Date('2024-01-01T08:00:00Z'),
  createdAt: new Date('2024-01-01T08:00:00Z'),
  updatedAt: new Date('2024-01-01T08:00:00Z'),
});

const makeFavorite = (newsId: string, createdAt: Date) => ({
  id: `fav-${newsId}`,
  userId: USER_ID,
  newsId,
  createdAt,
});

describe('favorite.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listFavorites', () => {
    it('should join favorites with their news in createdAt desc order', async () => {
      const older = makeFavorite('news-1', new Date('2024-01-01T08:00:00Z'));
      const newer = makeFavorite('news-2', new Date('2024-01-02T08:00:00Z'));
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([newer, older] as never);
      vi.mocked(prisma.favorite.count).mockResolvedValue(2);
      vi.mocked(prisma.news.findMany).mockResolvedValue([
        makeNews('news-1'),
        makeNews('news-2'),
      ] as never);

      const { data, total } = await listFavorites(USER_ID, { page: 1, limit: 20 });

      expect(total).toBe(2);
      expect(data).toHaveLength(2);
      expect(data[0].newsId).toBe('news-2');
      expect(data[0].news.title).toBe('Notícia news-2');
      expect(prisma.news.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['news-2', 'news-1'] } },
      });
    });

    it('should omit favorites whose news was deleted', async () => {
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([
        makeFavorite('news-1', new Date('2024-01-01T08:00:00Z')),
      ] as never);
      vi.mocked(prisma.favorite.count).mockResolvedValue(1);
      vi.mocked(prisma.news.findMany).mockResolvedValue([] as never);

      const { data } = await listFavorites(USER_ID, { page: 1, limit: 20 });

      expect(data).toHaveLength(0);
    });

    it('should return empty data when there are no favorites', async () => {
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([] as never);
      vi.mocked(prisma.favorite.count).mockResolvedValue(0);

      const { data, total } = await listFavorites(USER_ID, { page: 1, limit: 20 });

      expect(data).toHaveLength(0);
      expect(total).toBe(0);
      expect(prisma.news.findMany).not.toHaveBeenCalled();
    });
  });

  describe('addFavorite', () => {
    it('should return null when the news does not exist', async () => {
      vi.mocked(prisma.news.findUnique).mockResolvedValue(null);

      const result = await addFavorite(USER_ID, NEWS_ID);

      expect(result).toBeNull();
      expect(prisma.favorite.upsert).not.toHaveBeenCalled();
    });

    it('should upsert the favorite when the news exists', async () => {
      vi.mocked(prisma.news.findUnique).mockResolvedValue(makeNews(NEWS_ID) as never);
      vi.mocked(prisma.favorite.upsert).mockResolvedValue(
        makeFavorite(NEWS_ID, new Date('2024-01-02T08:00:00Z')) as never,
      );

      const result = await addFavorite(USER_ID, NEWS_ID);

      expect(result?.newsId).toBe(NEWS_ID);
      expect(prisma.favorite.upsert).toHaveBeenCalledWith({
        where: { userId_newsId: { userId: USER_ID, newsId: NEWS_ID } },
        create: { userId: USER_ID, newsId: NEWS_ID },
        update: {},
      });
    });
  });

  describe('removeFavorite', () => {
    it('should return false when the favorite does not exist', async () => {
      vi.mocked(prisma.favorite.findUnique).mockResolvedValue(null);

      const result = await removeFavorite(USER_ID, NEWS_ID);

      expect(result).toBe(false);
      expect(prisma.favorite.delete).not.toHaveBeenCalled();
    });

    it('should delete and return true when the favorite exists', async () => {
      vi.mocked(prisma.favorite.findUnique).mockResolvedValue(
        makeFavorite(NEWS_ID, new Date('2024-01-02T08:00:00Z')) as never,
      );
      vi.mocked(prisma.favorite.delete).mockResolvedValue({} as never);

      const result = await removeFavorite(USER_ID, NEWS_ID);

      expect(result).toBe(true);
      expect(prisma.favorite.delete).toHaveBeenCalledWith({
        where: { id: `fav-${NEWS_ID}` },
      });
    });
  });
});
