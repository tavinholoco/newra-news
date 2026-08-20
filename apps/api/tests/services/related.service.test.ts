import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@newranews/database';
import { getRelatedNews } from '../../src/services/related.service';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: { news: { findUnique: vi.fn(), findMany: vi.fn() } },
  };
});

const BASE_AT = new Date('2026-08-20T12:00:00.000Z');

function makeNews(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Noticia ${id}`,
    description: 'Descricao',
    content: null,
    source: 'G1',
    sourceUrl: `https://g1.globo.com/${id}`,
    imageUrl: null,
    category: 'ECONOMY',
    publishedAt: BASE_AT,
    createdAt: BASE_AT,
    updatedAt: BASE_AT,
    ...overrides,
  };
}

const BASE = makeNews('base');

describe('getRelatedNews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.news.findUnique).mockResolvedValue(BASE as never);
    vi.mocked(prisma.news.findMany).mockResolvedValue([] as never);
  });

  it('should return null when the base story does not exist', async () => {
    vi.mocked(prisma.news.findUnique).mockResolvedValue(null as never);

    expect(await getRelatedNews('sumida', 4)).toBeNull();
    expect(prisma.news.findMany).not.toHaveBeenCalled();
  });

  it('should fill from the same category inside the 72h window first', async () => {
    vi.mocked(prisma.news.findMany).mockResolvedValueOnce([
      makeNews('a'),
      makeNews('b'),
      makeNews('c'),
      makeNews('d'),
    ] as never);

    const result = await getRelatedNews('base', 4);

    expect(result?.map((s) => s.id)).toEqual(['a', 'b', 'c', 'd']);
    // Preencheu no primeiro nivel: nao precisou dos outros dois.
    expect(prisma.news.findMany).toHaveBeenCalledTimes(1);
  });

  it('should widen to the same category outside the window', async () => {
    vi.mocked(prisma.news.findMany)
      .mockResolvedValueOnce([makeNews('perto')] as never)
      .mockResolvedValueOnce([makeNews('longe')] as never)
      .mockResolvedValueOnce([] as never);

    const result = await getRelatedNews('base', 4);

    expect(result?.map((s) => s.id)).toEqual(['perto', 'longe']);
  });

  it('should fall back to any category so a thin one is never empty', async () => {
    // Uma categoria pouco povoada nao pode devolver lista vazia (§5).
    vi.mocked(prisma.news.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([makeNews('outra', { category: 'SPORTS' })] as never);

    const result = await getRelatedNews('base', 4);

    expect(result?.map((s) => s.id)).toEqual(['outra']);
    expect(prisma.news.findMany).toHaveBeenCalledTimes(3);
  });

  it('should never include the base story itself', async () => {
    vi.mocked(prisma.news.findMany)
      .mockResolvedValueOnce([BASE, makeNews('a')] as never)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    const result = await getRelatedNews('base', 4);

    expect(result?.map((s) => s.id)).toEqual(['a']);
  });

  it('should not repeat a story across the three tiers', async () => {
    vi.mocked(prisma.news.findMany)
      .mockResolvedValueOnce([makeNews('a')] as never)
      .mockResolvedValueOnce([makeNews('a'), makeNews('b')] as never)
      .mockResolvedValueOnce([makeNews('a'), makeNews('c')] as never);

    const result = await getRelatedNews('base', 4);
    const ids = result?.map((s) => s.id) ?? [];

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('should never exceed the limit', async () => {
    vi.mocked(prisma.news.findMany).mockResolvedValueOnce([
      makeNews('a'), makeNews('b'), makeNews('c'), makeNews('d'), makeNews('e'),
    ] as never);

    const result = await getRelatedNews('base', 2);

    expect(result).toHaveLength(2);
  });

  it('should query a window centred on the base publication date', async () => {
    await getRelatedNews('base', 4);

    const args = vi.mocked(prisma.news.findMany).mock.calls[0]?.[0] as {
      where: { publishedAt: { gte: Date; lte: Date } };
    };
    const spanHours =
      (args.where.publishedAt.lte.getTime() - args.where.publishedAt.gte.getTime()) / 3_600_000;
    expect(spanHours).toBe(144); // ±72h
  });
});
