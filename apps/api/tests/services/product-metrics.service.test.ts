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
      viewed: 0,
      completed: 0,
      scroll25: 1,
      scroll50: 1,
      scroll90: 1,
    });
  });

  it('a leitura completa divide pela tela vista, não pelo clique no card', async () => {
    // 13.4 do plano de observabilidade: em 01/10/2026 a tela marcava 1.034
    // leituras a 90% contra 0 aberturas. Quem chega pelo buscador não clica em
    // card nenhum — o denominador é a tela de leitura vista.
    const leitura = { contentId: 'n1', contentType: 'story' };
    findMany.mockResolvedValue([
      evento('article_view', leitura, 's1'),
      evento('article_scroll_90', leitura, 's1'),
      evento('article_view', leitura, 's2'),
      evento('article_view', { contentId: 'b1', contentType: 'briefing' }, 's2'),
      evento('article_scroll_90', { contentId: 'b1', contentType: 'briefing' }, 's2'),
    ]);

    const m = await getProductMetrics();

    expect(m.readingDepth.opened).toBe(0);
    expect(m.readingDepth.viewed).toBe(3);
    expect(m.readingDepth.completed).toBe(2);
  });

  it('só conta como completa a leitura cuja visualização está na janela', async () => {
    // O 90% de antes do `article_view` existir — e o das ferramentas, que
    // nunca tiveram visualização — não entra: o par é (sessão, conteúdo).
    findMany.mockResolvedValue([
      evento('article_scroll_90', { contentId: 'n1', contentType: 'story' }, 's1'),
      evento('article_view', { contentId: 'n2', contentType: 'story' }, 's1'),
      evento('article_scroll_90', { contentId: 'n2', contentType: 'story' }, 's2'),
      evento('article_view', { contentId: 'n3', contentType: 'story' }, 's3'),
      evento('article_scroll_90', { contentId: 'n3', contentType: 'briefing' }, 's3'),
    ]);

    const m = await getProductMetrics();

    expect(m.readingDepth.viewed).toBe(2);
    expect(m.readingDepth.completed).toBe(0);
    expect(m.readingDepth.scroll90).toBe(3);
  });

  it('a mesma tela vista duas vezes na sessão é uma leitura possível, não duas', async () => {
    // Dois `article_view` do mesmo conteúdo na mesma sessão (voltou à tela)
    // contra um 90% — contar as duas visualizações daria 50% para quem leu.
    const leitura = { contentId: 'n1', contentType: 'story' };
    findMany.mockResolvedValue([
      evento('article_view', leitura, 's1'),
      evento('article_view', leitura, 's1'),
      evento('article_scroll_90', leitura, 's1'),
    ]);

    const m = await getProductMetrics();

    expect(m.readingDepth.viewed).toBe(1);
    expect(m.readingDepth.completed).toBe(1);
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
