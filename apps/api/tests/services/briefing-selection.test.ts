import { describe, it, expect } from 'vitest';
import {
  BRIEFING_SELECTION_SIZE,
  MAX_ITEMS_PER_SOURCE,
  SELECTION_WINDOW_MS,
  selectBriefingItems,
  selectionKey,
} from '../../src/services/briefing-selection';

/**
 * A seleção do briefing com teto por fonte — P4 do plano de ação de
 * 11/11/2026. O G1 era 61,6 % das citações porque às 08:00 de Brasília é quem
 * publicou por último; o portão 5.5 bloqueou 02/11 e 06/11 por diversidade.
 */

const NOW = new Date('2026-11-11T11:20:00Z');
const HOUR = 3_600_000;

type Item = { id: string; source: string; publishedAt: Date };

/** `count` itens de uma fonte, o primeiro `startHoursAgo` atrás e um a cada `stepHours`. */
function batch(source: string, count: number, startHoursAgo: number, stepHours = 0.1): Item[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${source}-${i}`,
    source,
    publishedAt: new Date(NOW.getTime() - (startHoursAgo + i * stepHours) * HOUR),
  }));
}

function countBy(items: Item[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.source] = (counts[item.source] ?? 0) + 1;
  return counts;
}

describe('selectBriefingItems', () => {
  it('a decisão do dono: 3 de 15', () => {
    expect(BRIEFING_SELECTION_SIZE).toBe(15);
    expect(MAX_ITEMS_PER_SOURCE).toBe(3);
    expect(SELECTION_WINDOW_MS).toBe(24 * HOUR);
  });

  it('a manhã de 10/11: o G1 publicou por último, e não leva mais que três', () => {
    // Antes, as 15 mais recentes eram 12 do G1. Com o teto, as outras fontes
    // entram, cada uma com as suas mais recentes.
    const items = [
      ...batch('G1', 12, 0.1),
      ...batch('Folha', 4, 1.5),
      ...batch('BBC', 4, 1.6),
      ...batch('TechCrunch', 4, 2),
      ...batch('Trivela', 2, 3),
      ...batch('Valor', 4, 3.5),
    ];

    const selected = selectBriefingItems(items, { now: NOW });

    expect(selected).toHaveLength(15);
    const counts = countBy(selected);
    expect(counts.G1).toBe(MAX_ITEMS_PER_SOURCE);
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(MAX_ITEMS_PER_SOURCE);
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(5);
    // Cada fonte entra pelas suas mais recentes.
    expect(selected.filter((item) => item.source === 'G1').map((item) => item.id)).toEqual(['G1-0', 'G1-1', 'G1-2']);
  });

  it('completa por recência quando faltam fontes — o dia pobre não vira briefing curto', () => {
    const items = [...batch('G1', 10, 0.1), ...batch('BBC', 10, 0.15)];

    const selected = selectBriefingItems(items, { now: NOW });

    expect(selected).toHaveLength(15);
    // As seis da primeira passada (três de cada) e as nove mais recentes do
    // que sobrou, sem teto — exatamente as 15 mais recentes do dia.
    const newest = [...items].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, 15);
    expect(new Set(selected.map((item) => item.id))).toEqual(new Set(newest.map((item) => item.id)));
  });

  it('a fonte lenta não põe a matéria de três dias atrás no lugar da quarta do G1 desta manhã', () => {
    const items = [...batch('G1', 20, 0.1), ...batch('Trivela', 1, 72)];

    const selected = selectBriefingItems(items, { now: NOW });

    expect(selected).toHaveLength(15);
    expect(selected.map((item) => item.source)).not.toContain('Trivela');
  });

  it('mas a matéria velha entra quando é o que há para completar', () => {
    const items = [...batch('G1', 2, 0.1), ...batch('Trivela', 3, 72)];

    const selected = selectBriefingItems(items, { now: NOW });

    expect(selected.map((item) => item.id)).toEqual(['G1-0', 'G1-1', 'Trivela-0', 'Trivela-1', 'Trivela-2']);
  });

  it('o item do futuro empata com agora em vez de vencer tudo, e respeita o teto', () => {
    // A ESPN chegou a carimbar matéria ~0,9 h no futuro.
    const future = Array.from({ length: 6 }, (_, i) => ({
      id: `ESPN-${i}`,
      source: 'ESPN Brasil',
      publishedAt: new Date(NOW.getTime() + (0.9 - i * 0.01) * HOUR),
    }));
    expect(selectionKey(future[0] as Item, NOW)).toBe(NOW.getTime());

    const fresh = ['G1', 'BBC', 'Folha', 'Valor'].flatMap((source, i) => batch(source, 4, 0.1 + i * 0.02));
    const selected = selectBriefingItems([...future, ...fresh], { now: NOW });

    expect(selected).toHaveLength(15);
    expect(countBy(selected)['ESPN Brasil']).toBe(MAX_ITEMS_PER_SOURCE);
    // Empatadas com agora, elas abrem a lista — mas são três, não seis.
    expect(selected.slice(0, 3).map((item) => item.source)).toEqual(['ESPN Brasil', 'ESPN Brasil', 'ESPN Brasil']);
  });

  it('no empate vale a ordem da colheita', () => {
    const tie = new Date(NOW.getTime() - HOUR);
    const items = [
      { id: 'a', source: 'NewsData', publishedAt: tie },
      { id: 'b', source: 'G1', publishedAt: tie },
      { id: 'c', source: 'BBC', publishedAt: tie },
    ];
    expect(selectBriefingItems(items, { now: NOW }).map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('devolve na ordem de recência — é a ordem que o modelo lê e que a BriefingSource grava', () => {
    const items = [...batch('BBC', 2, 2), ...batch('G1', 6, 0.1), ...batch('Folha', 2, 1)];

    const selected = selectBriefingItems(items, { now: NOW });

    const keys = selected.map((item) => item.publishedAt.getTime());
    expect(keys).toEqual([...keys].sort((a, b) => b - a));
    // A quarta do G1 entra na segunda passada e fica no lugar dela na ordem.
    expect(selected.map((item) => item.id)).toEqual([
      'G1-0', 'G1-1', 'G1-2', 'G1-3', 'G1-4', 'G1-5', 'Folha-0', 'Folha-1', 'BBC-0', 'BBC-1',
    ]);
  });

  it('o alargamento do portão pede 30 com o mesmo teto', () => {
    const items = ['G1', 'Folha', 'BBC', 'TechCrunch', 'Trivela', 'Valor', 'ESPN Brasil', 'InfoMoney', 'Olhar Digital', 'Superinteressante', 'Drauzio']
      .flatMap((source, i) => batch(source, 6, 0.1 + i * 0.05));

    const wider = selectBriefingItems(items, { limit: 30, now: NOW });

    expect(wider).toHaveLength(30);
    expect(Math.max(...Object.values(countBy(wider)))).toBe(MAX_ITEMS_PER_SOURCE);
    expect(Object.keys(countBy(wider)).length).toBeGreaterThanOrEqual(10);
  });

  it('não muta a entrada e devolve vazio para colheita vazia', () => {
    const items = batch('G1', 4, 0.1).reverse();
    const before = items.map((item) => item.id);
    selectBriefingItems(items, { now: NOW });
    expect(items.map((item) => item.id)).toEqual(before);
    expect(selectBriefingItems([], { now: NOW })).toEqual([]);
  });
});
