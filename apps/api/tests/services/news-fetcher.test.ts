import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rssSources } from '../../src/config/rss-sources';
import { fetchAll } from '../../src/services/news-fetcher.service';

vi.mock('../../src/providers/news/newsdata.provider');
vi.mock('../../src/providers/news/rss.provider');

import { fetchFromNewsData } from '../../src/providers/news/newsdata.provider';
import { fetchFromRssWithFailures } from '../../src/providers/news/rss.provider';
import type { RssFeedFailure } from '../../src/providers/news/rss.provider';

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

/** O que `fetchFromRssWithFailures` resolve — atalho para o par items/failures. */
const rss = (items: ReturnType<typeof feedsExcept>, failures: RssFeedFailure[] = []) => ({
  items,
  failures,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('NewsFetcherService', () => {
  it('should combine items from both sources', async () => {
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(rss(mockRssItems));

    const result = await fetchAll();

    expect(result.newsDataItems).toEqual(mockNewsDataItems);
    expect(result.rssItems).toEqual(mockRssItems);
    expect(result.allItems).toHaveLength(2);
    expect(result.allItems).toEqual([...mockNewsDataItems, ...mockRssItems]);
  });

  it('should return empty newsDataItems when NewsData fails', async () => {
    vi.mocked(fetchFromNewsData).mockRejectedValue(new Error('NewsData down'));
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(rss(mockRssItems));

    const result = await fetchAll();

    expect(result.newsDataItems).toEqual([]);
    expect(result.rssItems).toEqual(mockRssItems);
    expect(result.allItems).toEqual(mockRssItems);
  });

  it('should return empty rssItems when RSS fails', async () => {
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRssWithFailures).mockRejectedValue(new Error('RSS down'));

    const result = await fetchAll();

    expect(result.newsDataItems).toEqual(mockNewsDataItems);
    expect(result.rssItems).toEqual([]);
    expect(result.allItems).toEqual(mockNewsDataItems);
  });

  it('should return empty allItems when both sources fail', async () => {
    vi.mocked(fetchFromNewsData).mockRejectedValue(new Error('NewsData down'));
    vi.mocked(fetchFromRssWithFailures).mockRejectedValue(new Error('RSS down'));

    const result = await fetchAll();

    expect(result.newsDataItems).toEqual([]);
    expect(result.rssItems).toEqual([]);
    expect(result.allItems).toEqual([]);
  });

  it('should keep the items from feeds that succeeded when others in the batch failed', async () => {
    // O `failures` do provider não é tudo-ou-nada: nove feeds podem responder
    // enquanto três estão fora, e os itens dos nove continuam valendo.
    vi.mocked(fetchFromNewsData).mockResolvedValue([]);
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(
      rss(feedsExcept('Superinteressante', 'Veja Saúde', 'Drauzio Varella'), [
        { source: 'Superinteressante', detail: 'ETIMEDOUT' },
        { source: 'Veja Saúde', detail: 'ETIMEDOUT' },
        { source: 'Drauzio Varella', detail: 'ETIMEDOUT' },
      ]),
    );

    const result = await fetchAll();

    expect(result.rssItems).toHaveLength(9);
    expect(result.rssItems.map((item) => item.source)).not.toContain('Superinteressante');
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
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(rss(feedsExcept()));

    const result = await fetchAll();

    expect(result.warnings).toEqual([
      { kind: 'provider-failed', source: 'newsdata', detail: 'socket hang up' },
    ]);
  });

  it('flags a provider that came back empty without throwing', async () => {
    // O modo pior dos dois: lista vazia sem exceção é indistinguível de "não
    // houve notícia hoje", e não deixa nem a rejeição para o log.
    vi.mocked(fetchFromNewsData).mockResolvedValue([]);
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(rss(feedsExcept()));

    const result = await fetchAll();

    expect(result.warnings).toEqual([{ kind: 'provider-empty', source: 'newsdata' }]);
  });

  it('stays quiet when every provider and every feed delivered', async () => {
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(rss(feedsExcept()));

    const result = await fetchAll();

    expect(result.warnings).toEqual([]);
  });

  it('names each configured feed that rendered nothing', async () => {
    // Quem não devolve item não aparece no resultado — a única forma de ver a
    // fonte que sumiu é comparar contra a lista configurada. Foi assim que a
    // `Reuters` ficou com zero itens até 24/08/2026 sem ninguém notar.
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(
      rss(feedsExcept('TechCrunch', 'Veja Saúde')),
    );

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
    vi.mocked(fetchFromRssWithFailures).mockRejectedValue(new Error('RSS down'));

    const result = await fetchAll();

    expect(result.warnings).toEqual([
      { kind: 'provider-failed', source: 'rss', detail: 'RSS down' },
    ]);
  });

  /**
   * `feed-failed` × `feed-empty`, e o episódio que expôs a lacuna entre eles.
   *
   * Até aqui, um feed que lançava — timeout, DNS, XML inválido — e um feed que
   * respondia e não tinha nada chegavam aqui **indistinguíveis**: os dois
   * viravam a mesma ausência no resultado de `fetchFromRss`. Em 03/09/2026 três
   * feeds (Superinteressante, Veja Saúde, Drauzio Varella) estavam em
   * `ETIMEDOUT` havia dois dias e saíam como `feed-empty` — a classe que **não**
   * conta em `pipelineErrors` — porque não havia outro lugar para cair.
   */
  it('classifies a feed whose fetch threw as feed-failed, not feed-empty', async () => {
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(
      rss(feedsExcept('Superinteressante', 'Veja Saúde', 'Drauzio Varella'), [
        { source: 'Superinteressante', detail: 'ETIMEDOUT' },
        { source: 'Veja Saúde', detail: 'ETIMEDOUT' },
        { source: 'Drauzio Varella', detail: 'ETIMEDOUT' },
      ]),
    );

    const result = await fetchAll();

    expect(result.warnings).toEqual([
      { kind: 'feed-failed', source: 'Superinteressante', detail: 'ETIMEDOUT' },
      { kind: 'feed-failed', source: 'Veja Saúde', detail: 'ETIMEDOUT' },
      { kind: 'feed-failed', source: 'Drauzio Varella', detail: 'ETIMEDOUT' },
    ]);
    // As três contam como erro do run — é o próprio ponto da distinção.
    expect(result.warnings.every((w) => w.kind !== 'feed-empty')).toBe(true);
  });

  it('does not also report a failed feed as feed-empty', async () => {
    // A fonte que falhou está "contabilizada" para o laço de feed-empty: ela
    // não deve aparecer duas vezes, uma por cada classificação.
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(
      rss(feedsExcept('Superinteressante'), [
        { source: 'Superinteressante', detail: 'ETIMEDOUT' },
      ]),
    );

    const result = await fetchAll();

    const superinteressante = result.warnings.filter((w) => w.source === 'Superinteressante');
    expect(superinteressante).toEqual([
      { kind: 'feed-failed', source: 'Superinteressante', detail: 'ETIMEDOUT' },
    ]);
  });

  it('mixes feed-failed and feed-empty in the same run', async () => {
    // O caso real de 03/09/2026: alguns feeds fora do ar, outros só quietos.
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(
      rss(feedsExcept('Superinteressante', 'TechCrunch'), [
        { source: 'Superinteressante', detail: 'ETIMEDOUT' },
      ]),
    );

    const result = await fetchAll();

    expect(result.warnings).toEqual([
      { kind: 'feed-failed', source: 'Superinteressante', detail: 'ETIMEDOUT' },
      { kind: 'feed-empty', source: 'TechCrunch' },
    ]);
  });

  it('reports provider-empty for rss when every feed resolved with nothing and none threw', async () => {
    // As doze respondem, nenhuma lança, nenhuma traz item: o padrão sugere o
    // provider inteiro mudo, não doze fontes coincidentemente quietas — por
    // isso vira um aviso de provider, não doze feed-empty repetidos.
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(rss([]));

    const result = await fetchAll();

    expect(result.warnings).toEqual([{ kind: 'provider-empty', source: 'rss' }]);
  });
});
