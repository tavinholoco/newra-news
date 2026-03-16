import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Category } from '@newranews/database';
import { fetchFromRss } from '../../src/providers/rss.provider';
import type { RssSource } from '../../src/config/rss-sources';

const { mockParseURL } = vi.hoisted(() => ({ mockParseURL: vi.fn() }));

vi.mock('rss-parser', () => ({
  default: vi.fn().mockImplementation(() => ({
    parseURL: mockParseURL,
  })),
}));

const mockItem = {
  title: 'Notícia de Teste',
  contentSnippet: 'Descrição da notícia de teste',
  content: '<p>Conteúdo completo da notícia</p>',
  link: 'https://g1.globo.com/noticia-teste',
  enclosure: { url: 'https://g1.globo.com/image.jpg' },
  pubDate: 'Mon, 01 Jan 2024 12:00:00 +0000',
};

const sourceWithCategory: RssSource = {
  name: 'TechCrunch',
  url: 'https://techcrunch.com/feed/',
  category: Category.TECHNOLOGY,
};

const sourceWithoutCategory: RssSource = {
  name: 'G1',
  url: 'https://g1.globo.com/rss/g1/',
};

beforeEach(() => {
  mockParseURL.mockResolvedValue({ title: 'Test Feed', items: [mockItem] });
});

afterEach(() => {
  mockParseURL.mockReset();
});

describe('fetchFromRss', () => {
  it('should return normalized items for a source with category', async () => {
    const result = await fetchFromRss([sourceWithCategory]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Notícia de Teste');
    expect(result[0].description).toBe('Descrição da notícia de teste');
    expect(result[0].source).toBe('TechCrunch');
    expect(result[0].sourceUrl).toBe('https://g1.globo.com/noticia-teste');
    expect(result[0].category).toBe(Category.TECHNOLOGY);
  });

  it('should use Category.WORLD when source has no category', async () => {
    const result = await fetchFromRss([sourceWithoutCategory]);

    expect(result[0].category).toBe(Category.WORLD);
  });

  it('should filter out items without a title', async () => {
    mockParseURL.mockResolvedValue({
      title: 'Test Feed',
      items: [{ ...mockItem, title: undefined }],
    });

    const result = await fetchFromRss([sourceWithCategory]);

    expect(result).toHaveLength(0);
  });

  it('should filter out items without contentSnippet and content', async () => {
    mockParseURL.mockResolvedValue({
      title: 'Test Feed',
      items: [{ ...mockItem, contentSnippet: undefined, content: undefined }],
    });

    const result = await fetchFromRss([sourceWithCategory]);

    expect(result).toHaveLength(0);
  });

  it('should return publishedAt as a Date with correct value', async () => {
    const result = await fetchFromRss([sourceWithCategory]);

    expect(result[0].publishedAt).toBeInstanceOf(Date);
    expect(result[0].publishedAt.toISOString()).toBe('2024-01-01T12:00:00.000Z');
  });

  it('should use new Date() when pubDate is missing', async () => {
    const before = new Date();
    mockParseURL.mockResolvedValue({
      title: 'Test Feed',
      items: [{ ...mockItem, pubDate: undefined }],
    });

    const result = await fetchFromRss([sourceWithCategory]);
    const after = new Date();

    expect(result[0].publishedAt).toBeInstanceOf(Date);
    expect(result[0].publishedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result[0].publishedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should not block other sources when one source fails', async () => {
    mockParseURL
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ title: 'Test Feed', items: [mockItem] });

    const result = await fetchFromRss([sourceWithCategory, sourceWithoutCategory]);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('G1');
  });

  it('should use item.link as sourceUrl when available', async () => {
    const result = await fetchFromRss([sourceWithCategory]);

    expect(result[0].sourceUrl).toBe('https://g1.globo.com/noticia-teste');
  });

  it('should fall back to source.url when item.link is missing', async () => {
    mockParseURL.mockResolvedValue({
      title: 'Test Feed',
      items: [{ ...mockItem, link: undefined }],
    });

    const result = await fetchFromRss([sourceWithCategory]);

    expect(result[0].sourceUrl).toBe('https://techcrunch.com/feed/');
  });

  it('should return null imageUrl when enclosure is missing', async () => {
    mockParseURL.mockResolvedValue({
      title: 'Test Feed',
      items: [{ ...mockItem, enclosure: undefined }],
    });

    const result = await fetchFromRss([sourceWithCategory]);

    expect(result[0].imageUrl).toBeNull();
  });
});
