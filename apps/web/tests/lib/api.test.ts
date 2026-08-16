import { describe, it, expect, vi, afterEach } from 'vitest';
import { getNews, getNewsById, getLatestArticle } from '@/lib/api';

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
    await getNews(2, 20, 'SPORTS', 'futebol');

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
