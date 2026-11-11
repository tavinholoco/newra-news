import type { RawNewsItem } from '../providers/types';

/**
 * **A seleção do briefing: as mais recentes, com teto por fonte.**
 *
 * Até 11/11/2026 a etapa 5 pegava as 15 mais recentes por `publishedAt`, e às
 * 08:00 de Brasília quem publicou por último é quase sempre o G1: **61,6 % das
 * citações desde 10/10, contra 25,7 % da colheita**. NewsData (~19 % da
 * colheita), TechCrunch e Trivela nunca foram citados. O portão 5.5 media três
 * fontes (o mínimo) na maioria dos dias e **bloqueou os runs das 11:00 de 02/11
 * e 06/11**. Plano de ação de 11/11, P4; o teto é decisão do dono.
 *
 * O ensaio sobre as colheitas de 12/10 a 11/11 de produção (só leitura; a
 * regra antiga reconstruída bateu com as citações reais na maioria dos dias):
 * **de 2–9 fontes para 6–9 por dia, e o G1 de 13–93 % para 20 %**. A matéria
 * mais velha escolhida passou de 0,4 h para 1,6 h, em média (4,6 h no pior
 * dia), e a primeira passada completou as 15 nos 30 dias.
 *
 * Duas passadas, e o motivo de cada uma:
 *
 * 1. **Recência com teto**, só entre as das últimas {@link SELECTION_WINDOW_MS}:
 *    no máximo {@link MAX_ITEMS_PER_SOURCE} por fonte. A janela é o que impede
 *    a fonte lenta de pôr no briefing a matéria de três dias atrás no lugar da
 *    quarta do G1 desta manhã.
 * 2. **Recência sem teto**, completando o que faltou — o dia com poucas
 *    fontes não vira um briefing com menos matérias. É o caso que o portão
 *    5.5 ainda mede: se a colheita for pobre de verdade, ele bloqueia.
 *
 * **A chave de ordenação é o `publishedAt` limitado a agora.** A ESPN chegou a
 * carimbar matéria ~0,9 h no futuro (`freshestAgeHours` negativo no evento da
 * 5.5) e furava o topo da ordenação; limitada, ela empata com "agora" em vez de
 * vencer tudo. O `pubDateZone` de `rss-sources.ts` continua sendo o conserto da
 * causa; isto é o teto do estrago.
 *
 * A fonte é o `source` do item, a mesma chave que o portão usa para contar
 * fontes distintas — de outro jeito a seleção e o portão discordariam sobre o
 * que é "uma fonte". Um item da NewsData leva o nome do veículo.
 *
 * Função pura, de propósito: o pipeline a chama na etapa 5 e de novo no
 * alargamento do portão, e o ensaio a reconstrói em SQL.
 */
export const BRIEFING_SELECTION_SIZE = 15;

/** Decisão do dono em 11/11/2026: 3 de 15 — pelo menos cinco fontes sempre que a colheita tiver. */
export const MAX_ITEMS_PER_SOURCE = 3;

/** A primeira passada só olha as últimas 24 h — a mesma janela do frescor do portão 5.5. */
export const SELECTION_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface SelectionOptions {
  /** Quantos itens a seleção devolve. */
  limit?: number;
  /** O instante do run: o teto da chave de ordenação e a ponta da janela. */
  now: Date;
}

/** O que a seleção lê de um item — e só isso, para o ensaio poder passar uma linha de `News`. */
export type Selectable = Pick<RawNewsItem, 'source' | 'publishedAt'>;

/** O instante pelo qual o item é ordenado — o `publishedAt`, nunca depois de agora. */
export function selectionKey(item: Selectable, now: Date): number {
  return Math.min(item.publishedAt.getTime(), now.getTime());
}

export function selectBriefingItems<T extends Selectable>(items: T[], options: SelectionOptions): T[] {
  const limit = options.limit ?? BRIEFING_SELECTION_SIZE;
  const nowMs = options.now.getTime();
  // `sort` é estável: no empate vale a ordem da colheita (NewsData antes do RSS).
  const ordered = [...items].sort((a, b) => selectionKey(b, options.now) - selectionKey(a, options.now));

  const chosen = new Set<T>();
  const perSource = new Map<string, number>();
  for (const item of ordered) {
    if (chosen.size >= limit) break;
    if (nowMs - selectionKey(item, options.now) > SELECTION_WINDOW_MS) continue;
    const taken = perSource.get(item.source) ?? 0;
    if (taken >= MAX_ITEMS_PER_SOURCE) continue;
    perSource.set(item.source, taken + 1);
    chosen.add(item);
  }

  for (const item of ordered) {
    if (chosen.size >= limit) break;
    chosen.add(item);
  }

  // Devolve na ordem de recência, que é a ordem em que o modelo lê o material
  // e em que a `BriefingSource` grava a posição.
  return ordered.filter((item) => chosen.has(item));
}
