import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@newranews/database';
import { getTrending, recencyDecay } from '../../src/services/trending.service';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      news: { findMany: vi.fn() },
      favorite: { groupBy: vi.fn() },
    },
  };
});

const NOW = new Date('2026-08-20T12:00:00.000Z');

function makeNews(id: string, hoursAgo: number, overrides = {}) {
  return {
    id,
    title: `Notícia ${id}`,
    description: 'Descrição',
    content: null,
    source: 'G1',
    sourceUrl: `https://g1.globo.com/${id}`,
    imageUrl: null,
    category: 'ECONOMY',
    publishedAt: new Date(NOW.getTime() - hoursAgo * 3_600_000),
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('recencyDecay', () => {
  it('should be 1 at publication and halve every 12h', () => {
    expect(recencyDecay(NOW, NOW)).toBe(1);
    expect(recencyDecay(new Date(NOW.getTime() - 12 * 3_600_000), NOW)).toBeCloseTo(0.5, 5);
    expect(recencyDecay(new Date(NOW.getTime() - 24 * 3_600_000), NOW)).toBeCloseTo(0.25, 5);
  });

  it('should not exceed 1 for a future publication date', () => {
    // Feeds ocasionalmente trazem data no futuro; sem o piso, ela ganharia
    // peso arbitrariamente grande e dominaria o ranking para sempre.
    expect(recencyDecay(new Date(NOW.getTime() + 3_600_000), NOW)).toBe(1);
  });
});

describe('getTrending', () => {
  beforeEach(() => {
    // Sem limpar, `mock.calls[0]` seria a chamada do primeiro teste do arquivo
    // e a asserção de janela leria o argumento errado.
    vi.clearAllMocks();
    vi.mocked(prisma.favorite.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.news.findMany).mockResolvedValue([] as never);
  });

  it('should return an empty list when nothing was published in the window', async () => {
    vi.mocked(prisma.news.findMany).mockResolvedValue([] as never);

    const result = await getTrending({ limit: 5, window: '24h', now: NOW });

    expect(result).toEqual([]);
  });

  it('should order by recency when nothing is saved', async () => {
    vi.mocked(prisma.news.findMany).mockResolvedValue([
      makeNews('a', 1),
      makeNews('b', 6),
      makeNews('c', 20),
    ] as never);

    const result = await getTrending({ limit: 5, window: '24h', now: NOW });

    expect(result.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('should let saves outweigh recency', async () => {
    vi.mocked(prisma.news.findMany).mockResolvedValue([
      makeNews('fresh', 0),
      makeNews('saved', 24),
    ] as never);
    vi.mocked(prisma.favorite.groupBy).mockResolvedValue([
      { itemId: 'saved', _count: { itemId: 2 } },
    ] as never);

    const result = await getTrending({ limit: 5, window: '24h', now: NOW });

    // saved: 0,25 + 2×2 = 4,25 · fresh: 1,0
    expect(result.map((s) => s.id)).toEqual(['saved', 'fresh']);
  });

  it('should mark every returned story as trending', async () => {
    vi.mocked(prisma.news.findMany).mockResolvedValue([makeNews('a', 1)] as never);

    const [story] = await getTrending({ limit: 5, window: '24h', now: NOW });

    expect(story?.isTrending).toBe(true);
    expect(story?.isFeatured).toBeUndefined();
  });

  it('should honour the limit', async () => {
    vi.mocked(prisma.news.findMany).mockResolvedValue([
      makeNews('a', 1),
      makeNews('b', 2),
      makeNews('c', 3),
    ] as never);

    const result = await getTrending({ limit: 2, window: '24h', now: NOW });

    expect(result).toHaveLength(2);
  });

  it('should widen the query window for 7d', async () => {
    vi.mocked(prisma.news.findMany).mockResolvedValue([] as never);

    await getTrending({ limit: 5, window: '7d', now: NOW });

    const args = vi.mocked(prisma.news.findMany).mock.calls[0]?.[0] as {
      where: { publishedAt: { gte: Date } };
    };
    const hours = (NOW.getTime() - args.where.publishedAt.gte.getTime()) / 3_600_000;
    expect(hours).toBe(168);
  });

  it('should break score ties by recency, deterministically', async () => {
    // Duas matérias com o mesmo score precisam sair sempre na mesma ordem, ou
    // a Home embaralha sozinha entre requisições.
    vi.mocked(prisma.news.findMany).mockResolvedValue([
      makeNews('older', 5),
      makeNews('newer', 2),
    ] as never);
    vi.mocked(prisma.favorite.groupBy).mockResolvedValue([
      { itemId: 'older', _count: { itemId: 1 } },
      { itemId: 'newer', _count: { itemId: 1 } },
    ] as never);

    const first = await getTrending({ limit: 5, window: '24h', now: NOW });
    const second = await getTrending({ limit: 5, window: '24h', now: NOW });

    expect(first.map((s) => s.id)).toEqual(second.map((s) => s.id));
  });

  it('should reach an older saved story that recency alone would never surface', async () => {
    // O defeito que a revisão pegou: com candidatos vindos só da recência, uma
    // matéria antiga e favoritada — que é exatamente o que o peso de save
    // existe para promover — nunca entrava na lista para ser pontuada. Na
    // janela de 7 dias a recência dela é 0,00006; só o favorito a coloca lá.
    vi.mocked(prisma.news.findMany)
      .mockResolvedValueOnce([makeNews('recente', 1)] as never) // janela por recência
      .mockResolvedValueOnce([makeNews('antiga-salva', 160)] as never); // resgatada por saves
    vi.mocked(prisma.favorite.groupBy)
      .mockResolvedValueOnce([{ itemId: 'antiga-salva', _count: { itemId: 5 } }] as never)
      .mockResolvedValueOnce([{ itemId: 'antiga-salva', _count: { itemId: 5 } }] as never);

    const result = await getTrending({ limit: 5, window: '7d', now: NOW });

    expect(result.map((s) => s.id)).toEqual(['antiga-salva', 'recente']);
  });

  it('should not query for extra stories when nothing saved falls outside the window', async () => {
    vi.mocked(prisma.news.findMany).mockResolvedValueOnce([makeNews('a', 1)] as never);
    vi.mocked(prisma.favorite.groupBy).mockResolvedValue([] as never);

    await getTrending({ limit: 5, window: '24h', now: NOW });

    // Uma consulta de notícias só: a de recência.
    expect(prisma.news.findMany).toHaveBeenCalledTimes(1);
  });
});