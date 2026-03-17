import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Category } from '@newranews/database';
import { fetchFromNewsApi } from '../../src/providers/news/newsapi.provider';

vi.mock('../../src/config/env', () => ({
  env: { NEWSAPI_KEY: 'test-key' },
}));

const mockArticle = {
  source: { name: 'G1' },
  title: 'Notícia de Teste',
  description: 'Descrição da notícia de teste',
  url: 'https://g1.globo.com/noticia-teste',
  urlToImage: 'https://g1.globo.com/image.jpg',
  publishedAt: '2024-01-01T12:00:00Z',
  content: 'Conteúdo da notícia de teste',
};

const mockApiResponse = {
  status: 'ok',
  articles: [mockArticle],
};

function makeFetchMock(response = mockApiResponse) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(response),
  });
}

describe('fetchFromNewsApi', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return normalized articles for given category', async () => {
    const result = await fetchFromNewsApi([Category.TECHNOLOGY]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Notícia de Teste');
    expect(result[0].description).toBe('Descrição da notícia de teste');
    expect(result[0].source).toBe('G1');
    expect(result[0].sourceUrl).toBe('https://g1.globo.com/noticia-teste');
    expect(result[0].category).toBe(Category.TECHNOLOGY);
  });

  it('should make one fetch call per category', async () => {
    await fetchFromNewsApi([Category.TECHNOLOGY, Category.SPORTS]);

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should use category=business in URL for ECONOMY', async () => {
    await fetchFromNewsApi([Category.ECONOMY]);

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('category=business'));
  });

  it('should use category=general in URL for POLITICS', async () => {
    await fetchFromNewsApi([Category.POLITICS]);

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('category=general'));
  });

  it('should return publishedAt as a Date with correct value', async () => {
    const result = await fetchFromNewsApi([Category.TECHNOLOGY]);

    expect(result[0].publishedAt).toBeInstanceOf(Date);
    expect(result[0].publishedAt.toISOString()).toBe('2024-01-01T12:00:00.000Z');
  });

  it('should normalize [Removed] content to null', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        status: 'ok',
        articles: [{ ...mockArticle, content: '[Removed]' }],
      }),
    );

    const result = await fetchFromNewsApi([Category.TECHNOLOGY]);

    expect(result[0].content).toBeNull();
  });

  it('should filter out articles with title [Removed]', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        status: 'ok',
        articles: [{ ...mockArticle, title: '[Removed]', description: null }],
      }),
    );

    const result = await fetchFromNewsApi([Category.TECHNOLOGY]);

    expect(result).toHaveLength(0);
  });

  it('should throw when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' }),
    );

    await expect(fetchFromNewsApi([Category.TECHNOLOGY])).rejects.toThrow(
      'NewsAPI error: 429 Too Many Requests',
    );
  });

  it('should throw when data.status is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({ status: 'error', articles: [] }),
    );

    await expect(fetchFromNewsApi([Category.TECHNOLOGY])).rejects.toThrow(
      'NewsAPI returned status: error',
    );
  });
});
