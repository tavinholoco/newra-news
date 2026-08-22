import { prisma } from '@newranews/database';
import type { News } from '@newranews/database';
import type { EditorialStory, TrendingWindow } from '@newranews/types';
import { toEditorialStory } from './editorial.mapper';

/**
 * Trending — **etapa 1** (§4 dos contratos).
 *
 * A §18.2 do plano propõe `recency + clicks + saves + shares`. Destes, só
 * `saves` existe: é a tabela `Favorite`. Cliques e compartilhamentos dependem
 * da camada de analytics da §27, que ainda não foi construída.
 *
 *   etapa 1 (agora)          score = recência + saves × 2
 *   etapa 2 (após a Fase 8)  score = recência + saves × 2 + clicks × 0,5 + shares × 3
 *
 * Chamar isto de "trending" sem dizer o que ele mede vira mito: hoje é
 * **"recentes mais favoritadas"**, e é assim que deve ser lido por quem
 * interpretar o resultado. Sem ML, como a §18.2 pede.
 */

const WINDOW_HOURS: Record<TrendingWindow, number> = { '24h': 24, '7d': 168 };

/** Meia-vida da recência, em horas. */
const HALF_LIFE_HOURS = 12;

const SAVE_WEIGHT = 2;

/**
 * Teto de candidatos por recência. Cobre um dia inteiro de coleta com folga
 * (~490 notícias/dia) e mantém a consulta previsível.
 */
const RECENT_CANDIDATES = 600;

/**
 * Quantas das mais favoritadas trazer além das recentes.
 *
 * **Sem isto o score não funciona.** Um favorito vale 2,0 e a recência vale no
 * máximo 1,0 — ou seja, uma matéria com um único save deve superar qualquer
 * matéria fresca sem nenhum. Mas se os candidatos forem só os mais recentes,
 * essa matéria nunca entra na lista para ser pontuada. Na janela de 7 dias o
 * efeito é gritante: uma matéria de 7 dias tem recência 0,00006, então **só**
 * os favoritos a colocam ali — e ela seria justamente a cortada.
 */
const SAVED_CANDIDATES = 60;

/**
 * Peso da recência: 1,0 no instante da publicação, 0,5 doze horas depois,
 * 0,25 vinte e quatro horas depois. Decaimento exponencial, não degrau — com
 * degrau, duas matérias separadas por um minuto na fronteira da janela
 * receberiam pesos muito diferentes.
 */
export function recencyDecay(publishedAt: Date, now: Date): number {
  const ageHours = (now.getTime() - publishedAt.getTime()) / 3_600_000;
  if (ageHours <= 0) return 1;
  return 0.5 ** (ageHours / HALF_LIFE_HOURS);
}

export interface TrendingOptions {
  limit: number;
  window: TrendingWindow;
  /** Injetável para o teste não depender do relógio. */
  now?: Date;
}

export async function getTrending({
  limit,
  window,
  now = new Date(),
}: TrendingOptions): Promise<EditorialStory[]> {
  const since = new Date(now.getTime() - WINDOW_HOURS[window] * 3_600_000);
  const publishedInWindow = { gte: since, lte: now };

  // Os candidatos vêm de dois lados, porque o score também tem dois lados.
  // `Favorite.itemId` não tem FK (é ponteiro fraco, como o schema documenta),
  // então favoritos de notícias já removidas pelo cleanup existem — o filtro
  // de janela na consulta seguinte os descarta naturalmente.
  //
  // O `itemType: 'NEWS'` não é decorativo: desde a Fase 6 o mesmo `Favorite`
  // guarda briefings salvos, e sem ele o trending contaria salvamento de
  // briefing como salvamento de notícia.
  const [recent, mostSaved] = await Promise.all([
    prisma.news.findMany({
      where: { publishedAt: publishedInWindow },
      orderBy: { publishedAt: 'desc' },
      take: RECENT_CANDIDATES,
    }),
    prisma.favorite.groupBy({
      by: ['itemId'],
      where: { itemType: 'NEWS' },
      _count: { itemId: true },
      orderBy: { _count: { itemId: 'desc' } },
      take: SAVED_CANDIDATES,
    }),
  ]);

  const recentIds = new Set(recent.map((news) => news.id));
  const savedOutsideRecent = mostSaved
    .map((row) => row.itemId)
    .filter((id) => !recentIds.has(id));

  const extra: News[] = savedOutsideRecent.length
    ? await prisma.news.findMany({
        where: { id: { in: savedOutsideRecent }, publishedAt: publishedInWindow },
      })
    : [];

  const candidates = [...recent, ...extra];
  if (candidates.length === 0) return [];

  const grouped = await prisma.favorite.groupBy({
    by: ['itemId'],
    where: { itemType: 'NEWS', itemId: { in: candidates.map((news) => news.id) } },
    _count: { itemId: true },
  });
  const saves = new Map(grouped.map((row) => [row.itemId, row._count.itemId]));

  // O ranking é em memória porque o score mistura uma função do tempo com uma
  // contagem de outra tabela sem FK — não há `orderBy` do Prisma que exprima
  // isso.
  return candidates
    .map((news) => ({
      news,
      score:
        recencyDecay(news.publishedAt, now) +
        (saves.get(news.id) ?? 0) * SAVE_WEIGHT,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Empate: a mais recente primeiro, para a ordem ser determinística.
      return b.news.publishedAt.getTime() - a.news.publishedAt.getTime();
    })
    .slice(0, limit)
    .map(({ news }) => toEditorialStory(news, { isTrending: true }));
}
