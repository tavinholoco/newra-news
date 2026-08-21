import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Category } from '@newranews/database';
import { fetchFromRss } from '../../src/providers/news/rss.provider';
import type { RssSource } from '../../src/config/rss-sources';

const { mockParseString } = vi.hoisted(() => ({ mockParseString: vi.fn() }));

vi.mock('rss-parser', () => ({
  default: vi.fn().mockImplementation(() => ({
    parseString: mockParseString,
  })),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

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

function mockFetchResponse(contentType = 'application/xml; charset=UTF-8', body = '') {
  mockFetch.mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode(body).buffer),
    headers: new Headers({ 'content-type': contentType }),
  });
}

beforeEach(() => {
  mockParseString.mockResolvedValue({ title: 'Test Feed', items: [mockItem] });
  mockFetchResponse();
});

afterEach(() => {
  mockParseString.mockReset();
  mockFetch.mockReset();
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

  it('should fall back to Category.WORLD when source has no category and no keyword matches', async () => {
    const result = await fetchFromRss([sourceWithoutCategory]);

    expect(result[0].category).toBe(Category.WORLD);
  });

  it('should classify items by keywords when source has no category', async () => {
    mockParseString.mockResolvedValue({
      title: 'Test Feed',
      items: [{
        ...mockItem,
        title: 'Futebol: time vence clássico e assume a liderança',
      }],
    });

    const result = await fetchFromRss([sourceWithoutCategory]);

    expect(result[0].category).toBe(Category.SPORTS);
  });

  it('should keep the source category and not classify by keywords', async () => {
    mockParseString.mockResolvedValue({
      title: 'Test Feed',
      items: [{
        ...mockItem,
        title: 'Gol no fim: veja como foi a partida de futebol',
      }],
    });

    const result = await fetchFromRss([sourceWithCategory]);

    expect(result[0].category).toBe(Category.TECHNOLOGY);
  });

  // A higiene do texto vive em `feed-text.ts` e é testada lá; estes dois
  // garantem que ela está **ligada** no provider — que foi o que faltou até
  // 21/08, quando o dek do hero chegou a produção repetindo o título.
  it('should sanitize the title and the description on the way in', async () => {
    mockParseString.mockResolvedValue({
      title: 'Test Feed',
      items: [
        {
          ...mockItem,
          title: '\nNotícia de Teste',
          contentSnippet:
            'Notícia de Teste\nDivulgação/Polícia Civil\nO corpo da matéria.',
        },
      ],
    });

    const result = await fetchFromRss([sourceWithCategory]);

    expect(result[0].title).toBe('Notícia de Teste');
    expect(result[0].description).toBe('O corpo da matéria.');
  });

  // O classificador recebia `item.title` cru — com entidade e quebra de linha —
  // enquanto o título gravado era o decodificado. Duas versões do mesmo campo.
  it('should classify from the sanitized text, not the raw feed title', async () => {
    mockParseString.mockResolvedValue({
      title: 'Test Feed',
      items: [
        {
          ...mockItem,
          title: '\nBolsa &amp; dólar: juros do Banco Central',
          contentSnippet: 'resumo',
        },
      ],
    });

    const result = await fetchFromRss([sourceWithoutCategory]);

    expect(result[0].title).toBe('Bolsa & dólar: juros do Banco Central');
    expect(result[0].category).toBe(Category.ECONOMY);
  });

  it('should filter out items without a title', async () => {
    mockParseString.mockResolvedValue({
      title: 'Test Feed',
      items: [{ ...mockItem, title: undefined }],
    });

    const result = await fetchFromRss([sourceWithCategory]);

    expect(result).toHaveLength(0);
  });

  it('should filter out items without contentSnippet and content', async () => {
    mockParseString.mockResolvedValue({
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
    mockParseString.mockResolvedValue({
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
    mockFetch
      .mockResolvedValueOnce({
        arrayBuffer: () => Promise.reject(new Error('Network error')),
        headers: new Headers({ 'content-type': 'text/xml' }),
      })
      .mockResolvedValueOnce({
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode('').buffer),
        headers: new Headers({ 'content-type': 'application/xml; charset=UTF-8' }),
      });

    const result = await fetchFromRss([sourceWithCategory, sourceWithoutCategory]);

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('G1');
  });

  it('should use item.link as sourceUrl when available', async () => {
    const result = await fetchFromRss([sourceWithCategory]);

    expect(result[0].sourceUrl).toBe('https://g1.globo.com/noticia-teste');
  });

  it('should fall back to source.url when item.link is missing', async () => {
    mockParseString.mockResolvedValue({
      title: 'Test Feed',
      items: [{ ...mockItem, link: undefined }],
    });

    const result = await fetchFromRss([sourceWithCategory]);

    expect(result[0].sourceUrl).toBe('https://techcrunch.com/feed/');
  });
});

describe('extractImageUrl', () => {
  it('should use enclosure url when available', async () => {
    mockParseString.mockResolvedValue({
      title: 'Test Feed',
      items: [{ ...mockItem, enclosure: { url: 'https://example.com/enclosure.jpg' } }],
    });

    const result = await fetchFromRss([sourceWithCategory]);

    expect(result[0].imageUrl).toBe('https://example.com/enclosure.jpg');
  });

  it('should use media:content url when enclosure is missing (G1 pattern)', async () => {
    mockParseString.mockResolvedValue({
      title: 'Test Feed',
      items: [{
        ...mockItem,
        enclosure: undefined,
        mediaContent: { $: { url: 'https://s2-g1.glbimg.com/photo.jpg', medium: 'image' } },
      }],
    });

    const result = await fetchFromRss([sourceWithCategory]);

    expect(result[0].imageUrl).toBe('https://s2-g1.glbimg.com/photo.jpg');
  });

  it('should use media:thumbnail url when enclosure and media:content are missing (BBC pattern)', async () => {
    mockParseString.mockResolvedValue({
      title: 'Test Feed',
      items: [{
        ...mockItem,
        enclosure: undefined,
        mediaThumbnail: { $: { url: 'https://ichef.bbci.co.uk/thumb.jpg', width: '240', height: '135' } },
      }],
    });

    const result = await fetchFromRss([sourceWithCategory]);

    expect(result[0].imageUrl).toBe('https://ichef.bbci.co.uk/thumb.jpg');
  });

  it('should prefer enclosure over media:content', async () => {
    mockParseString.mockResolvedValue({
      title: 'Test Feed',
      items: [{
        ...mockItem,
        enclosure: { url: 'https://example.com/enclosure.jpg' },
        mediaContent: { $: { url: 'https://example.com/media.jpg' } },
      }],
    });

    const result = await fetchFromRss([sourceWithCategory]);

    expect(result[0].imageUrl).toBe('https://example.com/enclosure.jpg');
  });

  it('should return null when no image source is available', async () => {
    mockParseString.mockResolvedValue({
      title: 'Test Feed',
      items: [{ ...mockItem, enclosure: undefined }],
    });

    const result = await fetchFromRss([sourceWithCategory]);

    expect(result[0].imageUrl).toBeNull();
  });
});

describe('fetchFeedXml encoding', () => {
  it('should detect charset from Content-Type header', async () => {
    mockFetchResponse('text/xml; charset=UTF-8', '<?xml version="1.0"?><rss/>');

    await fetchFromRss([sourceWithCategory]);

    expect(mockFetch).toHaveBeenCalledWith(sourceWithCategory.url);
    expect(mockParseString).toHaveBeenCalled();
  });

  it('should detect charset from XML declaration when Content-Type has no charset', async () => {
    const xmlDecl = '<?xml version="1.0" encoding="ISO-8859-1" ?>';
    const xmlBytes = new TextEncoder().encode(xmlDecl);

    mockFetch.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(xmlBytes.buffer),
      headers: new Headers({ 'content-type': 'text/xml' }),
    });

    await fetchFromRss([sourceWithCategory]);

    expect(mockParseString).toHaveBeenCalled();
  });

  it('should default to UTF-8 when no charset info is available', async () => {
    mockFetch.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode('<rss/>').buffer),
      headers: new Headers({ 'content-type': 'text/xml' }),
    });

    await fetchFromRss([sourceWithCategory]);

    expect(mockParseString).toHaveBeenCalled();
  });

  it('should give Content-Type charset priority over XML declaration', async () => {
    const xml = '<?xml version="1.0" encoding="ISO-8859-1" ?><rss/>';
    mockFetchResponse('text/xml; charset=utf-8', xml);

    await fetchFromRss([sourceWithCategory]);

    expect(mockParseString).toHaveBeenCalled();
  });
});
