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
  // Os dois entraram no `select` na Fase 12. **A fixture precisa trazê-los
  // explicitamente nulos**, e não ausentes: a comparação do job é `!==`, e
  // `null !== undefined` faria toda linha parecer alterada.
  content: string | null;
  imageUrl: string | null;
  source: string;
  category: Category;
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Notícia qualquer',
    description: 'Um corpo de texto sem palavra-chave nenhuma.',
    content: null,
    imageUrl: null,
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

  it('should scan every source, not just the classifier-owned ones', async () => {
    // **Mudou na Fase 12, e por medição.** O filtro antigo era o das fontes do
    // classificador, e existia para proteger a categoria — mas o HTML cru no
    // corpo estava concentrado justamente nas de categoria fixa (InfoMoney,
    // Olhar Digital e Drauzio Varella com 100% do corpo em HTML). Varrer só as
    // genéricas deixava de fora quase todo o defeito. O recorte de categoria
    // continua existindo, dentro do laço.
    mockFindMany.mockResolvedValue([]);

    await renormalizeStoredNews();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('should never reclassify a source with a fixed category, even when scanning it', async () => {
    mockFindMany.mockResolvedValue([
      row({
        source: 'InfoMoney',
        title: 'A família usou as redes sociais',
        description: 'A família usou as redes sociais para pedir ajuda.',
        category: Category.ECONOMY,
      }),
    ]);

    const report = await renormalizeStoredNews({ dryRun: false });

    expect(CLASSIFIER_OWNED_SOURCES).not.toContain('InfoMoney');
    expect(report.categoryChanged).toBe(0);
    expect(report.categorySkipped).toBe(0);
  });

  it('should honour an explicit source override', async () => {
    mockFindMany.mockResolvedValue([]);

    await renormalizeStoredNews({ sources: ['Reuters'] });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { source: { in: ['Reuters'] } } }),
    );
  });

  it('should fall back to scanning everything when sources is empty', async () => {
    mockFindMany.mockResolvedValue([]);

    await renormalizeStoredNews({ sources: [] });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
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
  // diferente do que a mesma matéria teria se entrasse hoje. Vai de
  // `categoryMode: 'all'` porque o assunto aqui é a ordem, não o modo — e uma
  // promoção é justamente o que o padrão `clear-only` deixa de aplicar.
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

    const report = await renormalizeStoredNews({ dryRun: false, categoryMode: 'all' });

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

/**
 * O modo existe porque as duas direções da mudança têm qualidade diferente.
 * Medido contra as 3.688 linhas do acervo de produção em 21/08: 320 demoções,
 * todas certas na amostra, e 1.240 promoções, erradas perto de metade das
 * vezes — corpo longo cita "prefeitura" ou "festival" de passagem e limpa o
 * piso de 3 palavras distintas.
 */
describe('renormalizeStoredNews — categoryMode', () => {
  const policeStory = row({
    title: 'Polícia prende suspeito',
    description: 'A família usou as redes sociais para pedir ajuda.',
    category: Category.TECHNOLOGY,
  });

  const uncategorised = row({
    title: 'Agenda cultural do fim de semana',
    description: 'Tem música, show, festival, banda e cantor na cidade.',
    category: Category.WORLD,
  });

  it('should default to clear-only', async () => {
    mockFindMany.mockResolvedValue([uncategorised]);

    const report = await renormalizeStoredNews({ dryRun: false });

    expect(report.categoryChanged).toBe(0);
    expect(report.categorySkipped).toBe(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('should apply a demotion in clear-only', async () => {
    mockFindMany.mockResolvedValue([policeStory]);

    const report = await renormalizeStoredNews({ dryRun: false });

    expect(report.categoryChanged).toBe(1);
    expect(report.categorySkipped).toBe(0);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ category: Category.WORLD }),
      }),
    );
  });

  it('should apply a promotion only when asked for all', async () => {
    mockFindMany.mockResolvedValue([uncategorised]);

    const report = await renormalizeStoredNews({ dryRun: false, categoryMode: 'all' });

    expect(report.categoryChanged).toBe(1);
    expect(report.categorySkipped).toBe(0);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ category: Category.ENTERTAINMENT }),
      }),
    );
  });

  // Uma linha ignorada para categoria ainda pode ter o texto reparado — as duas
  // coisas são independentes, e a higiene é segura nas duas direções.
  it('should still repair the text of a row whose category it skips', async () => {
    mockFindMany.mockResolvedValue([
      row({
        title: '\nAgenda cultural do fim de semana',
        description: 'Tem música, show, festival, banda e cantor na cidade.',
        category: Category.WORLD,
      }),
    ]);

    const report = await renormalizeStoredNews({ dryRun: false });

    expect(report.categorySkipped).toBe(1);
    expect(report.textChanged).toBe(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: '11111111-1111-1111-1111-111111111111' },
      data: { title: 'Agenda cultural do fim de semana' },
    });
  });

  it('should count a label-to-label swap as skipped in clear-only', async () => {
    mockFindMany.mockResolvedValue([
      row({
        title: 'Bolsa e dólar: juros do Banco Central',
        description: 'O Ibovespa fechou em alta.',
        category: Category.SPORTS,
      }),
    ]);

    const report = await renormalizeStoredNews({ dryRun: false });

    expect(report.categoryChanged).toBe(0);
    expect(report.categorySkipped).toBe(1);
  });
});
