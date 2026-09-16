import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rssSources } from '../../src/config/rss-sources';
import { fetchAll } from '../../src/services/news-fetcher.service';

vi.mock('../../src/providers/news/newsdata.provider');
vi.mock('../../src/providers/news/rss.provider');

import { fetchFromNewsData } from '../../src/providers/news/newsdata.provider';
import { fetchFromRssWithFailures } from '../../src/providers/news/rss.provider';
import type { RssFeedOutcome } from '../../src/providers/news/rss.provider';

/** O par `{ source, detail }` que os cenários nomeiam; vira `failure` no desfecho. */
interface RssFeedFailure {
  source: string;
  detail: string;
}

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

/**
 * O que `fetchFromRssWithFailures` resolve: os itens e **um desfecho por feed
 * configurado** — o que trouxe item conta os seus, o nomeado como falho leva
 * a exceção, e o resto respondeu vazio. A latência é fixa: o que se mede aqui
 * é a classificação, não o relógio.
 */
const rss = (items: ReturnType<typeof feedsExcept>, failures: RssFeedFailure[] = []) => ({
  items,
  outcomes: rssSources.map((source): RssFeedOutcome => {
    const failure = failures.find((f) => f.source === source.name);
    if (failure) {
      return { source: source.name, fetched: 0, latencyMs: 30_000, failure: failure.detail };
    }
    return {
      source: source.name,
      fetched: items.filter((item) => item.source === source.name).length,
      latencyMs: 500,
    };
  }),
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
    // O desfecho por feed não é tudo-ou-nada: nove feeds podem responder
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
    // Até a Fase 11 quem não devolvia item não aparecia no resultado, e a
    // única forma de ver a fonte que sumiu era comparar contra a lista
    // configurada — foi assim que a `Reuters` ficou com zero itens até
    // 24/08/2026 sem ninguém notar. Hoje o provider diz, uma entrada por feed.
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

/**
 * **`sources` é o dado bruto; `warnings` é derivado dele.** (Fase 11 do plano
 * de observabilidade)
 *
 * Uma entrada por fonte configurada — os doze feeds mais o balde `newsdata` —
 * com o que cada uma rendeu e quanto demorou. É o que a `SourceHealth` grava,
 * e é de onde os avisos acima saem: um feed sem entrada aqui não foi tentado,
 * e não há valor para isso de propósito.
 */
describe('NewsFetcherService — o desfecho por fonte', () => {
  it('reports one entry per configured source, the aggregator first', async () => {
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(rss(feedsExcept()));

    const { sources } = await fetchAll();

    expect(sources).toHaveLength(rssSources.length + 1);
    expect(sources[0]).toEqual({
      source: 'newsdata',
      kind: 'AGGREGATOR',
      fetched: 1,
      latencyMs: expect.any(Number),
    });
    expect(sources.slice(1).map((s) => s.source)).toEqual(rssSources.map((s) => s.name));
    expect(sources.slice(1).every((s) => s.kind === 'RSS' && s.fetched === 1)).toBe(true);
  });

  it('carries the feed failure and the feed silence side by side', async () => {
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(
      rss(feedsExcept('Superinteressante', 'TechCrunch'), [
        { source: 'Superinteressante', detail: 'ETIMEDOUT' },
      ]),
    );

    const { sources } = await fetchAll();
    const bySource = new Map(sources.map((s) => [s.source, s]));

    expect(bySource.get('Superinteressante')).toEqual({
      source: 'Superinteressante',
      kind: 'RSS',
      fetched: 0,
      latencyMs: 30_000,
      failure: 'ETIMEDOUT',
    });
    expect(bySource.get('TechCrunch')).toEqual({
      source: 'TechCrunch',
      kind: 'RSS',
      fetched: 0,
      latencyMs: 500,
    });
    expect(bySource.get('G1')?.fetched).toBe(1);
  });

  it('marks the aggregator as failed, with the reason, when NewsData threw', async () => {
    vi.mocked(fetchFromNewsData).mockRejectedValue(
      new Error('NEWSDATA_API_KEY is not configured'),
    );
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(rss(feedsExcept()));

    const { sources } = await fetchAll();

    expect(sources[0]).toMatchObject({
      source: 'newsdata',
      fetched: 0,
      failure: 'NEWSDATA_API_KEY is not configured',
    });
  });

  it('marks every configured feed as failed, with the provider reason, when the RSS provider threw', async () => {
    // O provider caiu por cima dos doze: nenhum foi tentado por culpa nossa,
    // e isso não é "respondeu vazio". O aviso continua um só (ver acima); o
    // desfecho por fonte é o que a SourceHealth grava, e ali cada uma é FAILED.
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRssWithFailures).mockRejectedValue(new Error('RSS down'));

    const { sources } = await fetchAll();
    const feeds = sources.filter((s) => s.kind === 'RSS');

    expect(feeds).toHaveLength(rssSources.length);
    expect(feeds.every((s) => s.fetched === 0 && s.failure === 'RSS down')).toBe(true);
  });

  it('keeps one empty entry per feed even when the whole provider came back empty', async () => {
    // O aviso agrega ("provider-empty"); o desfecho não — a série por fonte
    // precisa do dia vazio de cada uma para a faixa não ter buraco.
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(rss([]));

    const { sources, warnings } = await fetchAll();
    const feeds = sources.filter((s) => s.kind === 'RSS');

    expect(warnings).toEqual([{ kind: 'provider-empty', source: 'rss' }]);
    expect(feeds).toHaveLength(rssSources.length);
    expect(feeds.every((s) => s.fetched === 0 && s.failure === undefined)).toBe(true);
  });

  it('measures the latency of each provider call, including the one that failed', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(fetchFromNewsData).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockNewsDataItems), 700)),
      );
      vi.mocked(fetchFromRssWithFailures).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('RSS down')), 1_200)),
      );

      const pending = fetchAll();
      await vi.advanceTimersByTimeAsync(1_300);
      const { sources } = await pending;

      expect(sources[0]?.latencyMs).toBe(700);
      expect(sources[1]?.latencyMs).toBe(1_200);
    } finally {
      vi.useRealTimers();
    }
  });

  it('derives the warnings from the same entries — a failed feed is exactly a failed entry', async () => {
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRssWithFailures).mockResolvedValue(
      rss(feedsExcept('Superinteressante', 'Veja Saúde', 'TechCrunch'), [
        { source: 'Superinteressante', detail: 'ETIMEDOUT' },
        { source: 'Veja Saúde', detail: 'ENOTFOUND' },
      ]),
    );

    const { sources, warnings } = await fetchAll();

    const failedFeeds = sources
      .filter((s) => s.kind === 'RSS' && s.failure !== undefined)
      .map((s) => s.source);
    const emptyFeeds = sources
      .filter((s) => s.kind === 'RSS' && s.failure === undefined && s.fetched === 0)
      .map((s) => s.source);
    expect(warnings.filter((w) => w.kind === 'feed-failed').map((w) => w.source)).toEqual(
      failedFeeds,
    );
    expect(warnings.filter((w) => w.kind === 'feed-empty').map((w) => w.source)).toEqual(
      emptyFeeds,
    );
  });
});
