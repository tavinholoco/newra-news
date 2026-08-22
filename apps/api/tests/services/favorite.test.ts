import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@newranews/database';
import {
  addFavorite,
  countFavorites,
  listFavoriteIds,
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
      article: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      favorite: {
        findMany: vi.fn(),
        groupBy: vi.fn(),
        findUnique: vi.fn(),
        upsert: vi.fn(),
        delete: vi.fn(),
      },
    },
  };
});

const USER_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const NEWS_ID = 'cccccccc-0000-0000-0000-000000000001';
const ARTICLE_ID = 'eeeeeeee-0000-0000-0000-000000000001';

const makeNews = (id: string, publishedAt = new Date('2024-01-01T08:00:00Z')) => ({
  id,
  title: `Notícia ${id}`,
  description: 'Descrição',
  content: null,
  source: 'Fonte',
  sourceUrl: `https://example.com/${id}`,
  imageUrl: null,
  category: 'WORLD' as const,
  publishedAt,
  createdAt: publishedAt,
  updatedAt: publishedAt,
});

const makeArticle = (id: string, date = new Date('2024-01-03T00:00:00Z')) => ({
  id,
  title: `Briefing ${id}`,
  summary: 'Resumo',
  date,
  newsCount: 15,
});

const makeFavorite = (
  itemId: string,
  createdAt: Date,
  itemType: 'NEWS' | 'ARTICLE' = 'NEWS',
) => ({
  id: `fav-${itemId}`,
  userId: USER_ID,
  itemType,
  itemId,
  createdAt,
});

/**
 * A listagem chama `news.findMany` duas vezes por motivos diferentes: uma para
 * saber **quais** favoritos o filtro alcança (com `select`), outra para trazer
 * o conteúdo **da página**. O mock responde pelo formato do argumento em vez de
 * pela ordem — assim o teste não quebra quando uma das duas deixa de ser
 * necessária.
 */
function mockContent(news: ReturnType<typeof makeNews>[], articles: ReturnType<typeof makeArticle>[] = []) {
  vi.mocked(prisma.news.findMany).mockImplementation((async (args: {
    select?: unknown;
  }) =>
    args.select
      ? news.map((item) => ({ id: item.id, publishedAt: item.publishedAt }))
      : news) as never);

  vi.mocked(prisma.article.findMany).mockImplementation((async (args: {
    select?: { title?: boolean };
  }) =>
    args.select && !args.select.title
      ? articles.map((item) => ({ id: item.id, date: item.date }))
      : articles) as never);
}

describe('favorite.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listFavorites', () => {
    it('should join favorites with their content in saved-desc order', async () => {
      const older = makeFavorite('news-1', new Date('2024-01-01T08:00:00Z'));
      const newer = makeFavorite('news-2', new Date('2024-01-02T08:00:00Z'));
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([newer, older] as never);
      mockContent([makeNews('news-1'), makeNews('news-2')]);

      const { data, total } = await listFavorites(USER_ID, {}, { page: 1, limit: 20 });

      expect(total).toBe(2);
      expect(data).toHaveLength(2);
      expect(data[0].itemId).toBe('news-2');
      expect(data[0].itemType).toBe('NEWS');
      expect(data[0].itemType === 'NEWS' && data[0].news.title).toBe('Notícia news-2');
    });

    it('should mix news and briefings in a single list ordered by when they were saved', async () => {
      const news = makeFavorite('news-1', new Date('2024-01-01T08:00:00Z'));
      const article = makeFavorite('article-1', new Date('2024-01-05T08:00:00Z'), 'ARTICLE');
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([article, news] as never);
      mockContent([makeNews('news-1')], [makeArticle('article-1')]);

      const { data, total } = await listFavorites(USER_ID, {}, { page: 1, limit: 20 });

      expect(total).toBe(2);
      expect(data.map((item) => item.itemType)).toEqual(['ARTICLE', 'NEWS']);
      expect(data[0].itemType === 'ARTICLE' && data[0].article.title).toBe(
        'Briefing article-1',
      );
    });

    it('should filter with the archive predicate, so "saved only" matches /news', async () => {
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([
        makeFavorite('news-1', new Date('2024-01-01T08:00:00Z')),
      ] as never);
      mockContent([makeNews('news-1')]);

      await listFavorites(USER_ID, { category: 'WORLD', search: 'clima' }, {
        page: 1,
        limit: 20,
      });

      expect(prisma.news.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['news-1'] },
            category: 'WORLD',
            OR: [
              { title: { contains: 'clima', mode: 'insensitive' } },
              { description: { contains: 'clima', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should leave briefings out when the filter has a news-only dimension', async () => {
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([
        makeFavorite('article-1', new Date('2024-01-05T08:00:00Z'), 'ARTICLE'),
      ] as never);
      mockContent([], [makeArticle('article-1')]);

      const { data, total } = await listFavorites(USER_ID, { category: 'WORLD' }, {
        page: 1,
        limit: 20,
      });

      expect(total).toBe(0);
      expect(data).toHaveLength(0);
      expect(prisma.article.findMany).not.toHaveBeenCalled();
    });

    it('should search briefings by title and summary', async () => {
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([
        makeFavorite('article-1', new Date('2024-01-05T08:00:00Z'), 'ARTICLE'),
      ] as never);
      mockContent([], [makeArticle('article-1')]);

      await listFavorites(USER_ID, { search: 'clima' }, { page: 1, limit: 20 });

      expect(prisma.article.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['article-1'] },
            OR: [
              { title: { contains: 'clima', mode: 'insensitive' } },
              { summary: { contains: 'clima', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('should order by content date when sort is not "saved"', async () => {
      // Salvos na ordem inversa da publicação: só a ordenação por conteúdo
      // separa as duas coisas.
      const first = makeFavorite('news-old', new Date('2024-02-10T08:00:00Z'));
      const second = makeFavorite('news-new', new Date('2024-02-01T08:00:00Z'));
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([first, second] as never);
      mockContent([
        makeNews('news-old', new Date('2024-01-01T08:00:00Z')),
        makeNews('news-new', new Date('2024-01-20T08:00:00Z')),
      ]);

      const { data } = await listFavorites(
        USER_ID,
        {},
        { page: 1, limit: 20, sort: 'recent' },
      );

      expect(data.map((item) => item.itemId)).toEqual(['news-new', 'news-old']);
    });

    it('should restrict to one type when asked', async () => {
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([] as never);

      await listFavorites(USER_ID, { type: 'ARTICLE' }, { page: 1, limit: 20 });

      expect(prisma.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: USER_ID, itemType: 'ARTICLE' },
        }),
      );
    });

    it('should not count favorites whose content was deleted', async () => {
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([
        makeFavorite('news-1', new Date('2024-01-01T08:00:00Z')),
      ] as never);
      mockContent([]);

      const { data, total } = await listFavorites(USER_ID, {}, { page: 1, limit: 20 });

      expect(data).toHaveLength(0);
      // O total promete o que a lista mostra — contar a linha do favorito
      // prometeria um card que o cleanup do Stage 8 já levou.
      expect(total).toBe(0);
    });

    it('should paginate the matched set', async () => {
      const favorites = Array.from({ length: 5 }, (_, index) =>
        makeFavorite(`news-${index}`, new Date(2024, 0, 10 - index)),
      );
      vi.mocked(prisma.favorite.findMany).mockResolvedValue(favorites as never);
      mockContent(favorites.map((favorite) => makeNews(favorite.itemId)));

      const { data, total } = await listFavorites(USER_ID, {}, { page: 2, limit: 2 });

      expect(total).toBe(5);
      expect(data.map((item) => item.itemId)).toEqual(['news-2', 'news-3']);
    });

    it('should not touch the content tables when there are no favorites', async () => {
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([] as never);

      const { data, total } = await listFavorites(USER_ID, {}, { page: 1, limit: 20 });

      expect(data).toHaveLength(0);
      expect(total).toBe(0);
      expect(prisma.news.findMany).not.toHaveBeenCalled();
      expect(prisma.article.findMany).not.toHaveBeenCalled();
    });
  });

  describe('listFavoriteIds', () => {
    it('should split the ids by type', async () => {
      vi.mocked(prisma.favorite.findMany).mockResolvedValue([
        { itemType: 'NEWS', itemId: 'news-1' },
        { itemType: 'ARTICLE', itemId: 'article-1' },
        { itemType: 'NEWS', itemId: 'news-2' },
      ] as never);

      const ids = await listFavoriteIds(USER_ID);

      expect(ids).toEqual({ news: ['news-1', 'news-2'], articles: ['article-1'] });
    });
  });

  describe('countFavorites', () => {
    it('should report zero for a type with no rows', async () => {
      vi.mocked(prisma.favorite.groupBy).mockResolvedValue([
        { itemType: 'NEWS', _count: { _all: 3 } },
      ] as never);

      expect(await countFavorites(USER_ID)).toEqual({ news: 3, articles: 0 });
    });
  });

  describe('addFavorite', () => {
    it('should return null when the news does not exist', async () => {
      vi.mocked(prisma.news.findUnique).mockResolvedValue(null);

      const result = await addFavorite(USER_ID, 'NEWS', NEWS_ID);

      expect(result).toBeNull();
      expect(prisma.favorite.upsert).not.toHaveBeenCalled();
    });

    it('should return null when the article does not exist', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(null);

      const result = await addFavorite(USER_ID, 'ARTICLE', ARTICLE_ID);

      expect(result).toBeNull();
      expect(prisma.news.findUnique).not.toHaveBeenCalled();
      expect(prisma.favorite.upsert).not.toHaveBeenCalled();
    });

    it('should upsert on the composite unique when the content exists', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue({ id: ARTICLE_ID } as never);
      vi.mocked(prisma.favorite.upsert).mockResolvedValue(
        makeFavorite(ARTICLE_ID, new Date('2024-01-02T08:00:00Z'), 'ARTICLE') as never,
      );

      const result = await addFavorite(USER_ID, 'ARTICLE', ARTICLE_ID);

      expect(result?.itemId).toBe(ARTICLE_ID);
      expect(prisma.favorite.upsert).toHaveBeenCalledWith({
        where: {
          userId_itemType_itemId: {
            userId: USER_ID,
            itemType: 'ARTICLE',
            itemId: ARTICLE_ID,
          },
        },
        create: { userId: USER_ID, itemType: 'ARTICLE', itemId: ARTICLE_ID },
        update: {},
      });
    });
  });

  describe('removeFavorite', () => {
    it('should return false when the favorite does not exist', async () => {
      vi.mocked(prisma.favorite.findUnique).mockResolvedValue(null);

      const result = await removeFavorite(USER_ID, 'NEWS', NEWS_ID);

      expect(result).toBe(false);
      expect(prisma.favorite.delete).not.toHaveBeenCalled();
    });

    it('should delete the row of that type only', async () => {
      vi.mocked(prisma.favorite.findUnique).mockResolvedValue(
        makeFavorite(NEWS_ID, new Date('2024-01-02T08:00:00Z')) as never,
      );
      vi.mocked(prisma.favorite.delete).mockResolvedValue({} as never);

      const result = await removeFavorite(USER_ID, 'NEWS', NEWS_ID);

      expect(result).toBe(true);
      expect(prisma.favorite.findUnique).toHaveBeenCalledWith({
        where: {
          userId_itemType_itemId: { userId: USER_ID, itemType: 'NEWS', itemId: NEWS_ID },
        },
      });
      expect(prisma.favorite.delete).toHaveBeenCalledWith({
        where: { id: `fav-${NEWS_ID}` },
      });
    });
  });
});
