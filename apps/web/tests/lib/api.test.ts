import { describe, it, expect, vi, afterEach } from 'vitest';
import { Category } from '@newranews/types';
import {
  getNews,
  getNewsById,
  getLatestArticle,
  getDashboardMetrics,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  getFavorites,
  addFavorite,
  removeFavorite,
} from '@/lib/api';

const mockNews = {
  id: 'uuid-1',
  title: 'Notícia de Teste',
  description: 'Descrição',
  content: null,
  source: 'G1',
  sourceUrl: 'https://g1.globo.com/x',
  imageUrl: null,
  category: 'TECHNOLOGY',
  publishedAt: '2024-01-01T12:00:00.000Z',
  createdAt: '2024-01-01T12:00:00.000Z',
  updatedAt: '2024-01-01T12:00:00.000Z',
};

function mockFetchJson(payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(payload),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getNews', () => {
  it('should request the news list with default pagination', async () => {
    mockFetchJson({ data: [mockNews], meta: { total: 1 } });
    await getNews();

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('/news?page=1&limit=12');
  });

  it('should include category and search params when provided', async () => {
    mockFetchJson({ data: [mockNews], meta: { total: 1 } });
    await getNews(2, 20, Category.SPORTS, 'futebol');

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('/news?page=2&limit=20');
    expect(url).toContain('category=SPORTS');
    expect(url).toContain('search=futebol');
  });
});

describe('getNewsById', () => {
  it('should return the news item from the API response', async () => {
    mockFetchJson({ data: mockNews });
    const result = await getNewsById('uuid-1');

    expect(result.id).toBe('uuid-1');
    expect(result.title).toBe('Notícia de Teste');
  });
});

describe('getLatestArticle', () => {
  it('should return null when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(getLatestArticle()).resolves.toBeNull();
  });
});

describe('getDashboardMetrics', () => {
  it('should request the dashboard metrics endpoint and return the data', async () => {
    const mockDashboard = {
      today: null,
      lastWeek: {
        period: { start: '2026-08-09T00:00:00.000Z', end: '2026-08-15T23:59:59.999Z' },
        totalDays: 7,
        avgNewsPerDay: 490,
        totalArticlesGenerated: 7,
        pipelineSuccessRate: 1,
        avgPipelineDuration: 26.5,
        newsByCategory: { WORLD: 3484 },
        aiProviderUsage: { gemini: 7 },
      },
      lastMonth: {
        totalNewsCollected: 14800,
        totalArticlesGenerated: 30,
        avgNewsPerDay: 493,
        failureDays: 0,
      },
    };
    mockFetchJson({ data: mockDashboard });

    const result = await getDashboardMetrics();

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('/metrics/dashboard');
    expect(result).toEqual(mockDashboard);
  });
});

describe('subscribeToNewsletter', () => {
  it('should POST the email to the subscribe endpoint', async () => {
    const mockSubscriber = {
      id: 'uuid-1',
      email: 'assinante@test.com',
      status: 'ACTIVE',
      createdAt: '2024-01-01T08:00:00.000Z',
      updatedAt: '2024-01-01T08:00:00.000Z',
    };
    mockFetchJson({ data: mockSubscriber });

    const result = await subscribeToNewsletter('Assinante@Test.com');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/newsletter/subscribe');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ email: 'Assinante@Test.com' });
    expect(result).toEqual(mockSubscriber);
  });
});

describe('unsubscribeFromNewsletter', () => {
  it('should request the unsubscribe endpoint with the token', async () => {
    mockFetchJson({ data: { unsubscribed: true } });

    const result = await unsubscribeFromNewsletter('token-uuid');

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('/newsletter/unsubscribe?token=token-uuid');
    expect(result).toEqual({ unsubscribed: true });
  });
});

describe('favorites client API', () => {
  const favoriteWithNews = {
    id: 'fav-uuid',
    newsId: 'uuid-1',
    createdAt: '2024-01-02T08:00:00.000Z',
    news: mockNews,
  };

  it('should fetch favorites from the same-origin proxy', async () => {
    mockFetchJson({ data: [favoriteWithNews], meta: { total: 1 } });

    const result = await getFavorites();

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toBe('/api/favorites?page=1&limit=100');
    expect(result.data[0]?.news.title).toBe('Notícia de Teste');
  });

  it('should POST the newsId to add a favorite', async () => {
    mockFetchJson({
      data: { id: 'fav-uuid', userId: 'user-1', newsId: 'uuid-1', createdAt: '2024-01-02T08:00:00.000Z' },
    });

    const result = await addFavorite('uuid-1');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/favorites');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ newsId: 'uuid-1' });
    expect(result.newsId).toBe('uuid-1');
  });

  it('should DELETE the newsId to remove a favorite', async () => {
    mockFetchJson({ data: { removed: true } });

    const result = await removeFavorite('uuid-1');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/favorites/uuid-1');
    expect(init.method).toBe('DELETE');
    expect(result).toEqual({ removed: true });
  });
});
