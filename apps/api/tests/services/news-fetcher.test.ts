import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rssSources } from '../../src/config/rss-sources';
import { fetchAll } from '../../src/services/news-fetcher.service';

vi.mock('../../src/providers/news/newsdata.provider');
vi.mock('../../src/providers/news/rss.provider');

import { fetchFromNewsData } from '../../src/providers/news/newsdata.provider';
import { fetchFromRss } from '../../src/providers/news/rss.provider';

const mockNewsDataItems = [
  {
    title: 'NewsData Article',
    description: 'Descrição',
    content: null,
    source: 'G1',
    sourceUrl: 'https://g1.com/1',
    imageUrl: null,
    category: 'TECHNOLOGY' as const,
    publishedAt: new Date('2024-01-01T10:00:00Z'),
  },
];

const mockRssItems = [
  {
    title: 'RSS Article',
    description: 'Descrição',
    content: null,
    source: 'BBC',
    sourceUrl: 'https://bbc.com/1',
    imageUrl: null,
    category: 'WORLD' as const,
    publishedAt: new Date('2024-01-01T09:00:00Z'),
  },
];

/** Uma matéria por feed configurado, tirando os nomeados como silenciosos. */
const feedsExcept = (...silent: string[]) =>
  rssSources
    .filter((source) => !silent.includes(source.name))
    .map((source) => ({
      title: `Matéria da ${source.name}`,
      description: 'Descrição',
      content: null,
      source: source.name,
      sourceUrl: `https://exemplo.test/${encodeURIComponent(source.name)}`,
      imageUrl: null,
      category: 'WORLD' as const,
      publishedAt: new Date('2024-01-01T09:00:00Z'),
    }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('NewsFetcherService', () => {
  it('should combine items from both sources', async () => {
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRss).mockResolvedValue(mockRssItems);

    const result = await fetchAll();

    expect(result.newsDataItems).toEqual(mockNewsDataItems);
    expect(result.rssItems).toEqual(mockRssItems);
    expect(result.allItems).toHaveLength(2);
    expect(result.allItems).toEqual([...mockNewsDataItems, ...mockRssItems]);
  });

  it('should return empty newsDataItems when NewsData fails', async () => {
    vi.mocked(fetchFromNewsData).mockRejectedValue(new Error('NewsData down'));
    vi.mocked(fetchFromRss).mockResolvedValue(mockRssItems);

    const result = await fetchAll();

    expect(result.newsDataItems).toEqual([]);
    expect(result.rssItems).toEqual(mockRssItems);
    expect(result.allItems).toEqual(mockRssItems);
  });

  it('should return empty rssItems when RSS fails', async () => {
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRss).mockRejectedValue(new Error('RSS down'));

    const result = await fetchAll();

    expect(result.newsDataItems).toEqual(mockNewsDataItems);
    expect(result.rssItems).toEqual([]);
    expect(result.allItems).toEqual(mockNewsDataItems);
  });

  it('should return empty allItems when both sources fail', async () => {
    vi.mocked(fetchFromNewsData).mockRejectedValue(new Error('NewsData down'));
    vi.mocked(fetchFromRss).mockRejectedValue(new Error('RSS down'));

    const result = await fetchAll();

    expect(result.newsDataItems).toEqual([]);
    expect(result.rssItems).toEqual([]);
    expect(result.allItems).toEqual([]);
  });
});

/**
 * **O aviso é a parte nova, e é a que faltava.**
 *
 * `Promise.allSettled` já protegia o dia — um provider fora do ar não derrubava
 * a coleta —, só que a proteção era muda: a rejeição virava `console.warn` no
 * stdout do Render e o run seguia para `SUCCESS` idêntico a um dia bom. Estas
 * asserções são sobre o que a etapa 1 consegue **gravar**, que é o que alguém
 * consegue ler depois.
 */
describe('NewsFetcherService — o aviso de colheita degradada', () => {
  it('names the provider that failed, and why', async () => {
    vi.mocked(fetchFromNewsData).mockRejectedValue(new Error('socket hang up'));
    vi.mocked(fetchFromRss).mockResolvedValue(feedsExcept());

    const result = await fetchAll();

    expect(result.warnings).toEqual([
      { kind: 'provider-failed', source: 'newsdata', detail: 'socket hang up' },
    ]);
  });

  it('flags a provider that came back empty without throwing', async () => {
    // O modo pior dos dois: lista vazia sem exceção é indistinguível de "não
    // houve notícia hoje", e não deixa nem a rejeição para o log.
    vi.mocked(fetchFromNewsData).mockResolvedValue([]);
    vi.mocked(fetchFromRss).mockResolvedValue(feedsExcept());

    const result = await fetchAll();

    expect(result.warnings).toEqual([{ kind: 'provider-empty', source: 'newsdata' }]);
  });

  it('stays quiet when every provider and every feed delivered', async () => {
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRss).mockResolvedValue(feedsExcept());

    const result = await fetchAll();

    expect(result.warnings).toEqual([]);
  });

  it('names each configured feed that rendered nothing', async () => {
    // Quem não devolve item não aparece no resultado — a única forma de ver a
    // fonte que sumiu é comparar contra a lista configurada. Foi assim que a
    // `Reuters` ficou com zero itens até 24/08/2026 sem ninguém notar.
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRss).mockResolvedValue(feedsExcept('TechCrunch', 'Veja Saúde'));

    const result = await fetchAll();

    expect(result.warnings).toEqual([
      { kind: 'feed-empty', source: 'TechCrunch' },
      { kind: 'feed-empty', source: 'Veja Saúde' },
    ]);
  });

  it('does not blame all twelve feeds when the RSS provider itself failed', async () => {
    // O provider caído já tem o aviso dele; repetir doze `feed-empty` afogaria
    // justamente a linha que diz o que aconteceu.
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRss).mockRejectedValue(new Error('RSS down'));

    const result = await fetchAll();

    expect(result.warnings).toEqual([
      { kind: 'provider-failed', source: 'rss', detail: 'RSS down' },
    ]);
  });
});
