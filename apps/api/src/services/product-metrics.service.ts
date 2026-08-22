import { prisma } from '@newranews/database';
import type { ProductMetrics } from '@newranews/types';

/** Janela padrão. 30 dias respondem tudo sem carregar a retenção inteira. */
export const DEFAULT_WINDOW_DAYS = 30;

/** Teto de termos de busca sem resultado devolvidos, do mais frequente. */
const TOP_SEARCHES = 20;

type Payload = Record<string, unknown>;

interface Linha {
  type: string;
  sessionId: string;
  occurredAt: Date;
  payload: unknown;
}

function texto(payload: Payload, campo: string): string | null {
  const valor = payload[campo];
  return typeof valor === 'string' ? valor : null;
}

/** Ordena um mapa de contagens do maior para o menor. */
function ranking<T extends string>(
  contagens: Map<T, number>,
  chave: string,
): Array<Record<string, string | number>> {
  return [...contagens.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([valor, count]) => ({ [chave]: valor, count }));
}

/**
 * As métricas de produto da Fase 8.
 *
 * **Uma consulta e a agregação em memória, de propósito.** As alternativas
 * seriam SQL cru com operadores de JSON (`payload->>'source'`) ou um `groupBy`
 * por dimensão — a primeira é o que menos se consegue testar, e a segunda são
 * seis idas ao banco para responder uma tela. Com a janela de 30 dias e o
 * volume de hoje, uma varredura resolve.
 *
 * **É a mesma dívida consciente da `/api/favorites`**, e com o mesmo aviso: no
 * dia em que a janela trouxer centenas de milhares de linhas, isto vira a
 * consulta a otimizar. Não é o caso agora, e está escrito aqui para não ser
 * descoberto por acidente.
 *
 * Os dois números de audiência **não vêm do `ProductEvent`**: assinante e conta
 * são estado persistente, e são eles que dizem se há gente voltando. O
 * `sessionId` não sabe: ele morre ao fechar a aba, que é o que mantém a
 * medição anônima.
 */
export async function getProductMetrics(
  days = DEFAULT_WINDOW_DAYS,
): Promise<ProductMetrics> {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const [linhas, newsletterSubscribers, accounts] = await Promise.all([
    prisma.productEvent.findMany({
      where: { occurredAt: { gte: start, lte: end } },
      select: { type: true, sessionId: true, occurredAt: true, payload: true },
      orderBy: { occurredAt: 'asc' },
    }),
    prisma.subscriber.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count(),
  ]);

  const sessoes = new Set<string>();
  const porTipo = new Map<string, number>();
  const porDia = new Map<string, { sessions: Set<string>; events: number }>();
  const porOrigem = new Map<string, number>();
  const porCategoria = new Map<string, number>();
  const buscasVazias = new Map<string, number>();

  const profundidade = { opened: 0, scroll25: 0, scroll50: 0, scroll90: 0 };

  for (const linha of linhas as Linha[]) {
    const payload = (linha.payload ?? {}) as Payload;

    sessoes.add(linha.sessionId);
    porTipo.set(linha.type, (porTipo.get(linha.type) ?? 0) + 1);

    // `toISOString` e não a data local: o servidor da Vercel roda em UTC e o
    // navegador não — agrupar no fuso de quem consulta moveria evento de dia.
    const dia = linha.occurredAt.toISOString().slice(0, 10);
    const doDia = porDia.get(dia) ?? { sessions: new Set<string>(), events: 0 };
    doDia.sessions.add(linha.sessionId);
    doDia.events += 1;
    porDia.set(dia, doDia);

    switch (linha.type) {
      case 'story_open': {
        profundidade.opened += 1;
        const source = texto(payload, 'source');
        if (source) porOrigem.set(source, (porOrigem.get(source) ?? 0) + 1);
        break;
      }
      case 'briefing_open':
        profundidade.opened += 1;
        break;
      case 'category_view': {
        const categoria = texto(payload, 'category');
        if (categoria) {
          porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + 1);
        }
        break;
      }
      case 'search': {
        // Só as que **não acharam nada**: é a pergunta que o evento existe para
        // responder. Busca com resultado não diz o que falta no acervo.
        if (payload.resultCount === 0) {
          const query = texto(payload, 'query');
          if (query) buscasVazias.set(query, (buscasVazias.get(query) ?? 0) + 1);
        }
        break;
      }
      case 'article_scroll_25':
        profundidade.scroll25 += 1;
        break;
      case 'article_scroll_50':
        profundidade.scroll50 += 1;
        break;
      case 'article_scroll_90':
        profundidade.scroll90 += 1;
        break;
      default:
        break;
    }
  }

  return {
    period: {
      start: start.toISOString(),
      end: end.toISOString(),
      days,
    },
    audience: {
      sessions: sessoes.size,
      newsletterSubscribers,
      accounts,
    },
    // Ordem cronológica: o gráfico lê da esquerda para a direita.
    byDay: [...porDia.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, dados]) => ({
        date,
        sessions: dados.sessions.size,
        events: dados.events,
      })),
    byType: ranking(porTipo, 'type') as ProductMetrics['byType'],
    storyOpensBySource: ranking(
      porOrigem,
      'source',
    ) as ProductMetrics['storyOpensBySource'],
    categoryViews: ranking(
      porCategoria,
      'category',
    ) as ProductMetrics['categoryViews'],
    readingDepth: profundidade,
    searchesWithoutResults: (
      ranking(buscasVazias, 'query') as ProductMetrics['searchesWithoutResults']
    ).slice(0, TOP_SEARCHES),
  };
}
