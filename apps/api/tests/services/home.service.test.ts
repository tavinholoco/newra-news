import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@newranews/database';
import { getHome } from '../../src/services/home.service';
import { getTrending } from '../../src/services/trending.service';
import { getLatestArticle } from '../../src/services/article.service';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return { ...actual, prisma: { news: { findMany: vi.fn() } } };
});

vi.mock('../../src/services/trending.service', () => ({
  getTrending: vi.fn(),
}));

vi.mock('../../src/services/article.service', () => ({
  getLatestArticle: vi.fn(),
}));

const NOW = new Date('2026-08-20T12:00:00.000Z');

let seq = 0;
function makeNews(overrides: Record<string, unknown> = {}) {
  seq += 1;
  return {
    id: `news-${seq}`,
    title: `Notícia ${seq}`,
    description: 'Descrição',
    content: null,
    source: 'G1',
    sourceUrl: `https://g1.globo.com/${seq}`,
    imageUrl: null,
    category: 'ECONOMY',
    publishedAt: new Date(NOW.getTime() - seq * 60_000),
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** `EditorialStory` mínima, para os mocks de trending. */
function story(id: string) {
  return {
    id,
    title: id,
    dek: null,
    imageUrl: null,
    category: 'ECONOMY',
    source: 'G1',
    sourceUrl: `https://g1.globo.com/${id}`,
    publishedAt: NOW.toISOString(),
    updatedAt: null,
    readingTimeMinutes: null,
    isTrending: true,
  };
}

/** Todos os ids que aparecem em qualquer bloco da resposta. */
function allIds(home: Awaited<ReturnType<typeof getHome>>): string[] {
  return [
    ...(home.hero ? [home.hero.id] : []),
    ...home.topStories.map((s) => s.id),
    ...home.trending.map((s) => s.id),
    ...home.categories.flatMap((c) => c.stories.map((s) => s.id)),
    ...home.latest.map((s) => s.id),
  ];
}

describe('getHome', () => {
  beforeEach(() => {
    seq = 0;
    vi.clearAllMocks();
    vi.mocked(getTrending).mockResolvedValue([]);
    vi.mocked(getLatestArticle).mockResolvedValue(null as never);
    vi.mocked(prisma.news.findMany).mockResolvedValue([] as never);
  });

  it('should render with an empty archive', async () => {
    const home = await getHome({ categories: 4 });

    expect(home.hero).toBeNull();
    expect(home.briefing).toBeNull();
    expect(home.topStories).toEqual([]);
    expect(home.categories).toEqual([]);
  });

  it('should pick the most recent story WITH an image as the hero', async () => {
    // A §6.2 quer capa, e ~30% do acervo vem de RSS sem imagem. Pegar a mais
    // recente sem olhar isso deixaria a capa no gradiente quase todo dia.
    vi.mocked(prisma.news.findMany).mockResolvedValue([
      makeNews({ id: 'sem-imagem' }),
      makeNews({ id: 'com-imagem', imageUrl: 'https://x/a.jpg' }),
    ] as never);

    const home = await getHome({ categories: 4 });

    expect(home.hero?.id).toBe('com-imagem');
    expect(home.hero?.isFeatured).toBe(true);
  });

  it('should leave the hero null when nothing has an image', async () => {
    vi.mocked(prisma.news.findMany).mockResolvedValue([makeNews()] as never);

    const home = await getHome({ categories: 4 });

    expect(home.hero).toBeNull();
  });

  it('should never repeat a story across blocks', async () => {
    // A regra central da §3 dos contratos: sem ela a mesma manchete aparece no
    // hero, em top stories e na seção da categoria dela.
    const pool = Array.from({ length: 60 }, (_, i) =>
      makeNews({
        imageUrl: i === 0 ? 'https://x/a.jpg' : null,
        category: ['ECONOMY', 'SPORTS', 'WORLD', 'HEALTH'][i % 4],
      }),
    );
    vi.mocked(prisma.news.findMany).mockResolvedValue(pool as never);

    const home = await getHome({ categories: 4 });
    const ids = allIds(home);

    expect(ids.length).toBeGreaterThan(20);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should fill the trending block from further down its ranking', async () => {
    // `topStories` leva as mais recentes, e o trending ranqueia por recência —
    // então os primeiros colocados quase sempre já saíram. A precedência da §3
    // existe para não repetir, não para esvaziar o bloco: o perdedor continua
    // descendo o próprio ranking até preencher.
    const pool = Array.from({ length: 20 }, (_, i) =>
      makeNews({ id: `p${i}`, imageUrl: i === 0 ? 'https://x/a.jpg' : null }),
    );
    vi.mocked(prisma.news.findMany).mockResolvedValue(pool as never);

    // O ranking devolve as 6 primeiras do pool — as 6 que hero e topStories
    // vão consumir — e só depois candidatos ainda livres.
    vi.mocked(getTrending).mockResolvedValue(
      ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p10', 'p11', 'p12', 'p13', 'p14'].map(
        (id) => story(id),
      ) as never,
    );

    const home = await getHome({ categories: 4 });

    expect(home.trending).toHaveLength(5);
    expect(home.trending.map((s) => s.id)).toEqual([
      'p10',
      'p11',
      'p12',
      'p13',
      'p14',
    ]);
    // E nenhum deles reaparece depois.
    for (const id of home.trending.map((s) => s.id)) {
      expect(home.latest.map((s) => s.id)).not.toContain(id);
      expect(home.categories.flatMap((c) => c.stories.map((s) => s.id))).not.toContain(id);
    }
  });

  it('should drop a trending story that an earlier block already used', async () => {
    const pool = [makeNews({ id: 'hero', imageUrl: 'https://x/a.jpg' })];
    vi.mocked(prisma.news.findMany).mockResolvedValue(pool as never);
    vi.mocked(getTrending).mockResolvedValue([story('hero')] as never);

    const home = await getHome({ categories: 4 });

    expect(home.hero?.id).toBe('hero');
    expect(home.trending).toEqual([]);
  });

  it('should omit categories with no stories instead of returning empty ones', async () => {
    vi.mocked(prisma.news.findMany).mockResolvedValue([
      makeNews({ category: 'SPORTS' }),
      makeNews({ category: 'SPORTS' }),
    ] as never);

    const home = await getHome({ categories: 4 });

    expect(home.categories.every((c) => c.stories.length > 0)).toBe(true);
    expect(home.categories.map((c) => c.category)).not.toContain('TECHNOLOGY');
  });

  it('should honour the categories count', async () => {
    const pool = Array.from({ length: 40 }, (_, i) =>
      makeNews({ category: ['ECONOMY', 'SPORTS', 'WORLD', 'HEALTH', 'SCIENCE'][i % 5] }),
    );
    vi.mocked(prisma.news.findMany).mockResolvedValue(pool as never);

    const home = await getHome({ categories: 2 });

    expect(home.categories).toHaveLength(2);
  });

  it('should draw the rest of the Home on a day with news and no briefing', async () => {
    // **A pergunta da §9.4**, e ela não é hipotética: o acervo tem gap
    // conhecido (89 artigos em 90 dias). O dia sem briefing não é o dia sem
    // acervo — a coleta roda antes da geração e persiste mesmo quando a IA
    // falha, então a Home tem notícia de sobra e não tem o texto do dia.
    //
    // O que ela desenha: tudo, menos o bloco do briefing. `briefing: null` é
    // estado normal, e o schema de resposta o declara `nullable()` — se ele não
    // declarasse, a rota inteira devolveria 500 num dia em que o produto só
    // estava degradado.
    vi.mocked(prisma.news.findMany).mockResolvedValue(
      Array.from({ length: 20 }, (_, i) =>
        makeNews({ id: `n${i}`, imageUrl: i === 0 ? 'https://img/1.jpg' : null }),
      ) as never,
    );
    vi.mocked(getLatestArticle).mockResolvedValue(null);

    const home = await getHome({ categories: 4 });

    expect(home.briefing).toBeNull();
    expect(home.hero).not.toBeNull();
    expect(home.latest.length).toBeGreaterThan(0);
  });

  it('should build the briefing from the latest article', async () => {
    vi.mocked(getLatestArticle).mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Briefing',
      content: 'palavra '.repeat(400),
      summary: 'Resumo',
      date: new Date('2026-08-20T00:00:00.000Z'),
      newsCount: 15,
      createdAt: NOW,
      updatedAt: NOW,
      generatedAt: NOW,
      promptVersion: 'v1-ebb73b75',
      modelVersion: 'gemini-2.5-flash',
      status: 'PUBLISHED',
      sources: [
        {
          id: '22222222-2222-2222-2222-222222222222',
          position: 0,
          title: 'Fonte',
          source: 'G1',
          sourceUrl: 'https://g1.globo.com/x',
          newsId: null,
        },
      ],
    } as never);

    const home = await getHome({ categories: 4 });

    expect(home.briefing?.date).toBe('2026-08-20');
    expect(home.briefing?.sourceCount).toBe(1);
    expect(home.briefing?.readingTimeMinutes).toBe(2);
    // A §8 exige declarar que o texto é gerado por IA, sempre.
    expect(home.briefing?.aiDisclosure).toBe(true);
  });

  it('should fall back to newsCount for articles from before the audit migration', async () => {
    vi.mocked(getLatestArticle).mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      title: 'Antigo',
      content: 'texto',
      summary: 'Resumo',
      date: new Date('2026-05-01T00:00:00.000Z'),
      newsCount: 12,
      createdAt: NOW,
      updatedAt: NOW,
      generatedAt: null,
      promptVersion: null,
      modelVersion: null,
      status: 'PUBLISHED',
      sources: [],
    } as never);

    const home = await getHome({ categories: 4 });

    expect(home.briefing?.sourceCount).toBe(12);
    expect(home.briefing?.generatedAt).toBeNull();
  });
});
