import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Category } from '@newranews/database';
import { fetchFromNewsData } from '../../src/providers/news/newsdata.provider';

vi.mock('../../src/config/env', () => ({
  env: { NEWSDATA_API_KEY: 'test-key' },
}));

const mockArticle = {
  article_id: 'abc123',
  link: 'https://g1.globo.com/noticia-teste',
  title: 'Notícia de Teste',
  description: 'Descrição da notícia de teste',
  content: 'Conteúdo da notícia de teste',
  pubDate: '2024-01-01 12:00:00',
  image_url: 'https://g1.globo.com/image.jpg',
  source_id: 'g1',
  source_name: 'G1',
  category: ['technology', 'top'],
  country: ['brazil'],
  language: 'portuguese',
  duplicate: false,
};

const mockApiResponse = {
  status: 'success',
  totalResults: 10,
  results: [mockArticle],
};

function makeFetchMock(response = mockApiResponse) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(response),
  });
}

describe('fetchFromNewsData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return normalized articles for given category', async () => {
    const result = await fetchFromNewsData([Category.TECHNOLOGY]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Notícia de Teste');
    expect(result[0].description).toBe('Descrição da notícia de teste');
    expect(result[0].source).toBe('G1');
    expect(result[0].sourceUrl).toBe('https://g1.globo.com/noticia-teste');
    expect(result[0].imageUrl).toBe('https://g1.globo.com/image.jpg');
    expect(result[0].category).toBe(Category.TECHNOLOGY);
  });

  it('should make one fetch call per category', async () => {
    await fetchFromNewsData([Category.TECHNOLOGY, Category.SPORTS]);

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should use category=business in URL for ECONOMY', async () => {
    await fetchFromNewsData([Category.ECONOMY]);

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('category=business'));
  });

  it('should use category=world in URL for WORLD', async () => {
    await fetchFromNewsData([Category.WORLD]);

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('category=world'));
  });

  it('should use country=br and language=pt in URL', async () => {
    await fetchFromNewsData([Category.TECHNOLOGY]);

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('country=br'));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('language=pt'));
  });

  it('should filter articles without description', async () => {
    const withoutDescription = { ...mockArticle, description: null };
    vi.stubGlobal(
      'fetch',
      makeFetchMock({ status: 'success', results: [withoutDescription, mockArticle] }),
    );

    const result = await fetchFromNewsData([Category.TECHNOLOGY]);

    expect(result).toHaveLength(1);
  });

  it('should filter duplicate articles', async () => {
    const duplicate = { ...mockArticle, duplicate: true };
    vi.stubGlobal(
      'fetch',
      makeFetchMock({ status: 'success', results: [duplicate, mockArticle] }),
    );

    const result = await fetchFromNewsData([Category.TECHNOLOGY]);

    expect(result).toHaveLength(1);
  });

  it('should throw when the API returns an error status', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        status: 'error',
        results: { message: 'The provided API key is not valid.', code: 'Unauthorized' },
      }),
    );

    await expect(fetchFromNewsData([Category.TECHNOLOGY])).rejects.toThrow(
      'NewsData returned status: The provided API key is not valid.',
    );
  });

  it('should throw on HTTP errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' }),
    );

    await expect(fetchFromNewsData([Category.TECHNOLOGY])).rejects.toThrow(
      'NewsData error: 429 Too Many Requests',
    );
  });
});
