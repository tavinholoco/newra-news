import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getProductMetrics } from '../../src/services/product-metrics.service';

const findMany = vi.fn();
const subscriberCount = vi.fn();
const userCount = vi.fn();

vi.mock('@newranews/database', () => ({
  prisma: {
    productEvent: { findMany: (...a: unknown[]) => findMany(...a) },
    subscriber: { count: (...a: unknown[]) => subscriberCount(...a) },
    user: { count: (...a: unknown[]) => userCount(...a) },
  },
}));

function evento(
  type: string,
  payload: Record<string, unknown> = {},
  sessionId = 's1',
  occurredAt = '2026-08-22T12:00:00.000Z',
) {
  return { type, sessionId, occurredAt: new Date(occurredAt), payload };
}

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([]);
  subscriberCount.mockResolvedValue(0);
  userCount.mockResolvedValue(0);
});

describe('getProductMetrics', () => {
  it('conta sessão distinta, não evento', async () => {
    findMany.mockResolvedValue([
      evento('homepage_view', {}, 's1'),
      evento('homepage_view', {}, 's1'),
      evento('homepage_view', {}, 's2'),
    ]);

    const m = await getProductMetrics();

    expect(m.audience.sessions).toBe(2);
    expect(m.byType).toEqual([{ type: 'homepage_view', count: 3 }]);
  });

  it('audiência recorrente vem de assinante e conta, não da sessão', async () => {
    // O `sessionId` morre ao fechar a aba — é o que mantém a medição anônima, e
    // por isso ele não sabe dizer quem voltou. Quem sabe são os dois números
    // persistentes.
    subscriberCount.mockResolvedValue(42);
    userCount.mockResolvedValue(7);

    const m = await getProductMetrics();

    expect(m.audience.newsletterSubscribers).toBe(42);
    expect(m.audience.accounts).toBe(7);
    expect(subscriberCount).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
    });
  });

  it('separa a origem do clique — é o que distingue hero de rodapé', async () => {
    findMany.mockResolvedValue([
      evento('story_open', { source: 'hero' }),
      evento('story_open', { source: 'hero' }),
      evento('story_open', { source: 'latest' }),
    ]);

    const m = await getProductMetrics();

    expect(m.storyOpensBySource).toEqual([
      { source: 'hero', count: 2 },
      { source: 'latest', count: 1 },
    ]);
  });

  it('só lista busca que não achou nada', async () => {
    // Busca com resultado não diz o que falta no acervo, que é a pergunta que
    // este evento existe para responder.
    findMany.mockResolvedValue([
      evento('search', { query: 'eclipse', resultCount: 0 }),
      evento('search', { query: 'eclipse', resultCount: 0 }),
      evento('search', { query: 'eleições', resultCount: 12 }),
    ]);

    const m = await getProductMetrics();

    expect(m.searchesWithoutResults).toEqual([{ query: 'eclipse', count: 2 }]);
  });

  it('mede aberto contra lido', async () => {
    findMany.mockResolvedValue([
      evento('story_open', { source: 'hero' }),
      evento('briefing_open', {}),
      evento('article_scroll_25', {}),
      evento('article_scroll_50', {}),
      evento('article_scroll_90', {}),
    ]);

    const m = await getProductMetrics();

    expect(m.readingDepth).toEqual({
      opened: 2,
      scroll25: 1,
      scroll50: 1,
      scroll90: 1,
    });
  });

  it('agrupa por dia em UTC, e em ordem cronológica', async () => {
    // Agrupar no fuso de quem consulta moveria evento de dia — a mesma
    // armadilha que a Fase 7 corrigiu na data do briefing.
    findMany.mockResolvedValue([
      evento('homepage_view', {}, 's2', '2026-08-22T02:00:00.000Z'),
      evento('homepage_view', {}, 's1', '2026-08-21T23:00:00.000Z'),
    ]);

    const m = await getProductMetrics();

    expect(m.byDay).toEqual([
      { date: '2026-08-21', sessions: 1, events: 1 },
      { date: '2026-08-22', sessions: 1, events: 1 },
    ]);
  });

  it('a janela pedida vira o recorte da consulta', async () => {
    await getProductMetrics(7);

    const [arg] = findMany.mock.calls[0] as [
      { where: { occurredAt: { gte: Date; lte: Date } } },
    ];
    const dias = Math.round(
      (arg.where.occurredAt.lte.getTime() - arg.where.occurredAt.gte.getTime()) /
        86_400_000,
    );

    expect(dias).toBe(7);
  });

  it('sem evento nenhum devolve zeros, não explode', async () => {
    // É o estado de hoje, e a tela precisa desenhá-lo.
    const m = await getProductMetrics();

    expect(m.audience.sessions).toBe(0);
    expect(m.byDay).toEqual([]);
    expect(m.byType).toEqual([]);
    expect(m.readingDepth.opened).toBe(0);
  });

  it('ignora payload sem o campo esperado em vez de quebrar', async () => {
    // O `payload` é `Json`: um evento antigo pode não ter o campo que a versão
    // atual espera, e a tela não pode cair por causa disso.
    findMany.mockResolvedValue([
      evento('story_open', {}),
      evento('category_view', { category: 42 }),
    ]);

    const m = await getProductMetrics();

    expect(m.storyOpensBySource).toEqual([]);
    expect(m.categoryViews).toEqual([]);
    expect(m.readingDepth.opened).toBe(1);
  });
});
