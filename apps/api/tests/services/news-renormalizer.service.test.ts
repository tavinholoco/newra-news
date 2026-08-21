import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Category } from '@newranews/database';

const { mockFindMany, mockUpdate, mockTransaction } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('@newranews/database', async () => {
  const actual = await vi.importActual<typeof import('@newranews/database')>(
    '@newranews/database',
  );
  return {
    ...actual,
    prisma: {
      news: { findMany: mockFindMany, update: mockUpdate },
      $transaction: mockTransaction,
    },
  };
});

const {
  renormalizeStoredNews,
  CLASSIFIER_OWNED_SOURCES,
} = await import('../../src/services/news-renormalizer.service');

interface Row {
  id: string;
  title: string;
  description: string;
  source: string;
  category: Category;
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Notícia qualquer',
    description: 'Um corpo de texto sem palavra-chave nenhuma.',
    source: 'G1',
    category: Category.WORLD,
    ...overrides,
  };
}

beforeEach(() => {
  mockFindMany.mockReset();
  mockUpdate.mockReset();
  mockTransaction.mockReset().mockResolvedValue([]);
  mockUpdate.mockImplementation((args: unknown) => args);
});

describe('CLASSIFIER_OWNED_SOURCES', () => {
  // Fonte com categoria fixa teve a categoria escolhida pela configuração, e
  // recalcular ali destrói dado correto.
  it('should list only the feeds without a fixed category', () => {
    expect(CLASSIFIER_OWNED_SOURCES).toContain('G1');
    expect(CLASSIFIER_OWNED_SOURCES).toContain('BBC Brasil');
    expect(CLASSIFIER_OWNED_SOURCES).not.toContain('TechCrunch');
    expect(CLASSIFIER_OWNED_SOURCES).not.toContain('InfoMoney');
    expect(CLASSIFIER_OWNED_SOURCES).not.toContain('ESPN Brasil');
  });
});

describe('renormalizeStoredNews', () => {
  it('should default to a dry run and write nothing', async () => {
    mockFindMany.mockResolvedValue([
      row({ category: Category.TECHNOLOGY, description: 'A família usou as redes sociais.' }),
    ]);

    const report = await renormalizeStoredNews();

    expect(report.dryRun).toBe(true);
    expect(report.categoryChanged).toBe(1);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('should scope the query to the classifier-owned sources', async () => {
    mockFindMany.mockResolvedValue([]);

    await renormalizeStoredNews();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source: { in: CLASSIFIER_OWNED_SOURCES } },
      }),
    );
  });

  it('should honour an explicit source override', async () => {
    mockFindMany.mockResolvedValue([]);

    await renormalizeStoredNews({ sources: ['Reuters'] });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { source: { in: ['Reuters'] } } }),
    );
  });

  it('should fall back to the default scope when sources is empty', async () => {
    mockFindMany.mockResolvedValue([]);

    await renormalizeStoredNews({ sources: [] });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source: { in: CLASSIFIER_OWNED_SOURCES } },
      }),
    );
  });

  it('should write only the fields that actually changed', async () => {
    mockFindMany.mockResolvedValue([
      row({
        title: '\nPolícia prende suspeito',
        description: 'Polícia prende suspeito\nDivulgação/PM\nO corpo da matéria.',
        category: Category.WORLD,
      }),
    ]);

    await renormalizeStoredNews({ dryRun: false });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: '11111111-1111-1111-1111-111111111111' },
      data: { title: 'Polícia prende suspeito', description: 'O corpo da matéria.' },
    });
  });

  it('should skip rows that the current rules already agree with', async () => {
    mockFindMany.mockResolvedValue([row()]);

    const report = await renormalizeStoredNews({ dryRun: false });

    expect(report.scanned).toBe(1);
    expect(report.textChanged).toBe(0);
    expect(report.categoryChanged).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // A ordem importa: classificar sobre a descrição suja daria um resultado
  // diferente do que a mesma matéria teria se entrasse hoje.
  it('should classify from the sanitized text, not the stored blob', async () => {
    mockFindMany.mockResolvedValue([
      row({
        title: 'Bolsa e dólar: juros do Banco Central',
        // A descrição repete o título; sem higiene, o corpo real some no meio.
        description:
          'Bolsa e dólar: juros do Banco Central\nDivulgação/B3\nO Ibovespa fechou em alta.',
        category: Category.WORLD,
      }),
    ]);

    const report = await renormalizeStoredNews({ dryRun: false });

    expect(report.categoryChanged).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'O Ibovespa fechou em alta.',
          category: Category.ECONOMY,
        }),
      }),
    );
  });

  it('should decode HTML entities left in the source name', async () => {
    mockFindMany.mockResolvedValue([
      row({ source: 'Jornal Do Com&eacute;rcio' }),
    ]);

    const report = await renormalizeStoredNews({ dryRun: false });

    expect(report.textChanged).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'Jornal Do Comércio' }),
      }),
    );
  });

  it('should aggregate transitions and cap the sample', async () => {
    const policeStory = (n: number) =>
      row({
        id: `2222222${n}-1111-1111-1111-111111111111`.slice(0, 36),
        title: `Matéria ${n}`,
        description: 'A família usou as redes sociais para pedir ajuda.',
        category: Category.TECHNOLOGY,
      });
    mockFindMany.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => policeStory(i)),
    );

    const report = await renormalizeStoredNews();

    expect(report.categoryChanged).toBe(30);
    expect(report.transitions).toEqual([
      { from: Category.TECHNOLOGY, to: Category.WORLD, count: 30 },
    ]);
    expect(report.sample).toHaveLength(25);
  });

  it('should batch the writes instead of opening one huge transaction', async () => {
    mockFindMany.mockResolvedValue(
      Array.from({ length: 250 }, (_, i) =>
        row({
          id: `3333333${i}-1111-1111-1111-111111111111`.slice(0, 36),
          title: `\nMatéria ${i}`,
        }),
      ),
    );

    await renormalizeStoredNews({ dryRun: false });

    // 250 linhas em lotes de 100 → 3 transações.
    expect(mockTransaction).toHaveBeenCalledTimes(3);
  });

  it('should pass the limit through to the query', async () => {
    mockFindMany.mockResolvedValue([]);

    await renormalizeStoredNews({ limit: 50 });

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });
});
