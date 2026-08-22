import { describe, it, expect, vi, afterEach } from 'vitest';
import { Category } from '@newranews/types';
import {
  getNews,
  getNewsFacets,
  prefetch,
  getNewsById,
  getLatestArticle,
  getDashboardMetrics,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  getFavorites,
  getFavoriteIds,
  addFavorite,
  removeFavorite,
  runDailyPipeline,
  deleteNewsAdmin,
  getHome,
  getTrending,
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

  it('should include every filter dimension when provided', async () => {
    mockFetchJson({ data: [mockNews], meta: { total: 1 } });
    await getNews(2, 20, {
      category: Category.SPORTS,
      search: 'futebol',
      source: 'G1',
      from: '2024-01-01T00:00:00.000Z',
      sort: 'oldest',
    });

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('page=2&limit=20');
    expect(url).toContain('category=SPORTS');
    expect(url).toContain('search=futebol');
    expect(url).toContain('source=G1');
    expect(url).toContain('from=2024-01-01');
    expect(url).toContain('sort=oldest');
  });

  it('should leave the default sort out of the URL', async () => {
    // `recent` já é o default do backend: mandá-lo criaria uma segunda chave
    // de cache para a mesma resposta.
    mockFetchJson({ data: [mockNews], meta: { total: 1 } });
    await getNews(1, 12, { sort: 'recent' });

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).not.toContain('sort=');
  });

  it('should leave an empty search out of the URL', async () => {
    mockFetchJson({ data: [mockNews], meta: { total: 1 } });
    await getNews(1, 12, { search: '' });

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).not.toContain('search=');
  });
});

describe('getNewsFacets', () => {
  it('should unwrap the data envelope', async () => {
    const facets = {
      total: 3,
      categories: [{ category: 'SPORTS', count: 3 }],
      sources: [{ source: 'G1', count: 3 }],
    };
    mockFetchJson({ data: facets });

    const result = await getNewsFacets({ category: Category.SPORTS });

    expect(result).toEqual(facets);
  });

  it('should request facets without pagination params', async () => {
    mockFetchJson({ data: { total: 0, categories: [], sources: [] } });
    await getNewsFacets({ search: 'copa' });

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('/news/facets?search=copa');
    expect(url).not.toContain('page=');
  });

  it('should request facets with no query string when there are no filters', async () => {
    mockFetchJson({ data: { total: 0, categories: [], sources: [] } });
    await getNewsFacets();

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toMatch(/\/news\/facets$/);
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
  it('should request the admin proxy route and return the data', async () => {
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

    // Passa pela rota proxy do Next, nao direto na API: o endpoint exige JWT
    // com role ADMIN e o browser nao tem o segredo para assinar.
    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toBe('/api/admin/metrics');
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
  const savedNews = {
    id: 'fav-uuid',
    itemType: 'NEWS' as const,
    itemId: 'uuid-1',
    createdAt: '2024-01-02T08:00:00.000Z',
    news: mockNews,
  };

  it('should fetch favorites from the same-origin proxy', async () => {
    mockFetchJson({ data: [savedNews], meta: { total: 1 } });

    const result = await getFavorites();

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toBe('/api/favorites?page=1&limit=100');
    expect(result.data[0]?.itemType === 'NEWS' && result.data[0].news.title).toBe(
      'Notícia de Teste',
    );
  });

  it('should send the archive filters along, so "saved only" filters like /news', async () => {
    mockFetchJson({ data: [], meta: { total: 0 } });

    await getFavorites(2, 20, { category: Category.WORLD, search: 'clima', type: 'NEWS' });

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toContain('category=WORLD');
    expect(url).toContain('search=clima');
    expect(url).toContain('page=2');
    expect(url).toContain('type=NEWS');
  });

  it('should fetch only the ids of what is saved', async () => {
    mockFetchJson({ data: { news: ['uuid-1'], articles: ['uuid-2'] } });

    const result = await getFavoriteIds();

    const [url] = vi.mocked(fetch).mock.calls[0] as [string];
    expect(url).toBe('/api/favorites/ids');
    expect(result).toEqual({ news: ['uuid-1'], articles: ['uuid-2'] });
  });

  it('should POST the type and the id to save an item', async () => {
    mockFetchJson({
      data: {
        id: 'fav-uuid',
        userId: 'user-1',
        itemType: 'ARTICLE',
        itemId: 'uuid-2',
        createdAt: '2024-01-02T08:00:00.000Z',
      },
    });

    const result = await addFavorite('ARTICLE', 'uuid-2');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/favorites');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      itemType: 'ARTICLE',
      itemId: 'uuid-2',
    });
    expect(result.itemId).toBe('uuid-2');
  });

  it('should address the item by type and id to remove it', async () => {
    mockFetchJson({ data: { removed: true } });

    const result = await removeFavorite('NEWS', 'uuid-1');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/favorites/news/uuid-1');
    expect(init.method).toBe('DELETE');
    expect(result).toEqual({ removed: true });
  });
});

describe('admin client API', () => {
  it('should POST to the run-pipeline proxy', async () => {
    mockFetchJson({
      success: true,
      data: { pipelineId: 'pipe-1' },
      revalidated: true,
    });

    const result = await runDailyPipeline();

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/admin/run-pipeline');
    expect(init.method).toBe('POST');
    expect(result).toEqual({
      success: true,
      data: { pipelineId: 'pipe-1' },
      revalidated: true,
    });
  });

  it('should DELETE a news item through the admin proxy', async () => {
    mockFetchJson({ data: { deleted: true, id: 'uuid-1' } });

    const result = await deleteNewsAdmin('uuid-1');

    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/admin/news/uuid-1');
    expect(init.method).toBe('DELETE');
    expect(result).toEqual({ deleted: true, id: 'uuid-1' });
  });

  it('should throw when the run-pipeline request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      }),
    );

    await expect(runDailyPipeline()).rejects.toThrow('403');
  });
});

describe('getHome', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('should unwrap the aggregated payload from the { data } envelope', async () => {
    const home = {
      hero: null,
      briefing: null,
      topStories: [],
      trending: [],
      latest: [],
      categories: [],
    };
    mockFetchJson({ data: home });

    await expect(getHome()).resolves.toEqual(home);
  });

  // Sem argumento a rota vai sem querystring: o default de `categories` e do
  // backend, e repeti-lo aqui criaria um segundo lugar para mante-lo.
  it('should call /home without a querystring when no override is given', async () => {
    mockFetchJson({ data: { hero: null, briefing: null, topStories: [], trending: [], latest: [], categories: [] } });

    await getHome();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/home'),
      expect.anything(),
    );
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('categories='),
      expect.anything(),
    );
  });

  it('should forward an explicit category count', async () => {
    mockFetchJson({ data: { hero: null, briefing: null, topStories: [], trending: [], latest: [], categories: [] } });

    await getHome(6);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/home?categories=6'),
      expect.anything(),
    );
  });
});

describe('getTrending', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('should send the limit and window the ranking was asked for', async () => {
    mockFetchJson({ data: [] });

    await getTrending(3, '7d');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/trending?limit=3&window=7d'),
      expect.anything(),
    );
  });
});

describe('prefetch', () => {
  it('should pass a successful result through untouched', async () => {
    await expect(prefetch(Promise.resolve({ data: [1] }))).resolves.toEqual({
      data: [1],
    });
  });

  it('should turn a failure into undefined, not an empty result', async () => {
    // O `.catch(() => ({ categories: [], sources: [] }))` que isto substituiu
    // pôs uma **afirmação** no ar — "zero matérias em cada categoria" — como
    // `initialData` de uma query com `staleTime` de 5 minutos. O TanStack Query
    // a considerou fresca e nunca buscou de novo: em produção as oito pílulas
    // ficaram zeradas ao lado de "5.783 notícias".
    await expect(prefetch(Promise.reject(new Error('502')))).resolves.toBeUndefined();
  });
});
