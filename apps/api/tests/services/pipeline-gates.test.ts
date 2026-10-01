import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Category } from '@newranews/database';
import {
  ENTRY_BASELINE_DAYS,
  ENTRY_GATE_CHECKS,
  FRESHNESS_WINDOW_MS,
  GATE_CHECKS,
  GATE_STAGES,
  GateBlockedError,
  MAX_CATEGORY_DRIFT,
  MAX_DUPLICATE_RATE,
  MIN_BASELINE_DAYS,
  MIN_DISTINCT_SOURCES,
  MIN_VOLUME_RATIO,
  WIDENED_SELECTION,
  categoryDrift,
  evaluateEntryGate,
  isGateCheck,
  loadEntryBaseline,
  type BaselineDay,
  type EntryGateInput,
} from '../../src/services/pipeline-gates.service';
import { OUTPUT_GUARD_CHECKS } from '../../src/providers/ai/output-guard';
import type { RawNewsItem } from '../../src/providers/types';

/**
 * **O portão de entrada — §13.1 do plano de observabilidade, Fase 9.**
 *
 * Cada check reprovando o caso exato e aprovando o vizinho legítimo, e as
 * duas correções da auditoria de 04/09 como asserção: a diversidade alarga
 * antes de desistir, e a mediana sem histórico não opina.
 */

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: { dailyMetric: { findMany: vi.fn() } },
  };
});

import { prisma } from '@newranews/database';

const NOW = new Date('2026-09-19T11:00:00.000Z');

function item(overrides: Partial<RawNewsItem> = {}): RawNewsItem {
  return {
    title: 'Notícia',
    description: 'Descrição',
    content: null,
    source: 'G1',
    sourceUrl: `https://g1.globo.com/${Math.random().toString(36).slice(2)}`,
    imageUrl: null,
    category: Category.WORLD,
    publishedAt: new Date(NOW.getTime() - 2 * 3_600_000),
    ...overrides,
  };
}

/** `n` itens de `source`, com a data espaçada para a ordenação ser estável. */
function items(n: number, source: string, overrides: Partial<RawNewsItem> = {}): RawNewsItem[] {
  return Array.from({ length: n }, (_, i) =>
    item({ source, publishedAt: new Date(NOW.getTime() - (i + 1) * 60_000), ...overrides }),
  );
}

function day(offset: number, newsCollected: number, extra: Partial<BaselineDay> = {}): BaselineDay {
  const date = new Date('2026-09-19T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() - offset);
  return {
    date,
    newsCollected,
    newsByCategory: { WORLD: Math.round(newsCollected * 0.6), TECHNOLOGY: Math.round(newsCollected * 0.4) },
    articleGenerated: true,
    ...extra,
  };
}

/** Sete dias em torno de 300 — a série normal. */
const HEALTHY_WEEK = [1, 2, 3, 4, 5, 6, 7].map((offset) => day(offset, 280 + offset * 6));

/**
 * Uma colheita normal: 300 itens de três fontes, dois terços Mundo e um terço
 * Tecnologia (a janela é 60/40 — deriva de 0,07), e a seleção das 15 mais
 * recentes.
 */
function healthyInput(overrides: Partial<EntryGateInput> = {}): EntryGateInput {
  const deduplicated = [
    ...items(100, 'G1'),
    ...items(100, 'BBC'),
    ...items(100, 'Folha', { category: Category.TECHNOLOGY }),
  ];
  const select = (limit: number) =>
    [...deduplicated].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, limit);
  return {
    deduplicated,
    collected: 320,
    selected: select(15),
    widen: () => select(WIDENED_SELECTION),
    baseline: HEALTHY_WEEK,
    now: NOW,
    ...overrides,
  };
}

describe('o que os dois portões partilham', () => {
  it('numbers the gates as the half-stages the pipeline announces', () => {
    expect(GATE_STAGES).toEqual({ entry: 5.5, exit: 6.5 });
  });

  it('the check set is the union of the two gates, finite, and is what the route validator accepts', () => {
    expect([...GATE_CHECKS]).toEqual([...ENTRY_GATE_CHECKS, ...OUTPUT_GUARD_CHECKS]);
    for (const check of GATE_CHECKS) expect(isGateCheck(check)).toBe(true);
    expect(isGateCheck('stage-6.5:anything')).toBe(false);
    expect(isGateCheck(undefined)).toBe(false);
  });

  it('GateBlockedError carries the gate, its stage, the check, the reason and the detail', () => {
    const error = new GateBlockedError({
      gate: 'exit',
      check: 'unanchored-url',
      reason: 'security',
      detail: 'evil.example',
      provider: 'gemini',
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('GateBlockedError');
    expect(error.stage).toBe(6.5);
    expect(error.provider).toBe('gemini');
    expect(error.message).toBe(
      'Output guard blocked (gemini): unanchored-url (evil.example) — security block: the cause is in the material, re-triggering repeats the attack',
    );
  });

  it('a quality block does not claim to be an attack', () => {
    const error = new GateBlockedError({ gate: 'entry', check: 'volume', reason: 'quality', detail: '12 < 30%' });

    expect(error.stage).toBe(5.5);
    expect(error.message).toBe('Entry gate blocked: volume (12 < 30%)');
    expect(error.provider).toBeUndefined();
  });
});

describe('um dia normal passa', () => {
  it('approves a healthy harvest with the measures that the 5.5 event records', () => {
    const verdict = evaluateEntryGate(healthyInput());

    expect(verdict.block).toBeNull();
    expect(verdict.warnings).toEqual([]);
    expect(verdict.baseline).toBe('ok');
    expect(verdict.selected).toHaveLength(15);
    expect(verdict.measures).toMatchObject({
      volume: 300,
      baselineDays: 7,
      median: 304,
      sources: 3,
      widened: false,
      duplicateRate: 0.063,
    });
    expect(verdict.measures.volumeRatio).toBeCloseTo(300 / 304, 2);
    expect(verdict.measures.freshestAgeHours).toBeCloseTo(0, 1);
    expect(verdict.measures.categoryDrift).toBeLessThan(MAX_CATEGORY_DRIFT);
  });
});

describe('volume — contra a mediana móvel, e só com linha de base', () => {
  it('blocks a harvest below 30% of the median', () => {
    const verdict = evaluateEntryGate(healthyInput({ deduplicated: items(60, 'G1'), selected: items(15, 'G1') }));

    expect(verdict.block).toEqual({
      check: 'volume',
      detail: '60 < 30% of median 304 over 7 days',
    });
    expect(verdict.measures.volumeRatio).toBeCloseTo(60 / 304, 3);
  });

  it('approves a harvest just above the line — the threshold is relative, not absolute', () => {
    const volume = Math.ceil(MIN_VOLUME_RATIO * 304);
    const verdict = evaluateEntryGate(
      healthyInput({ deduplicated: [...items(volume - 2, 'G1'), ...items(1, 'BBC'), ...items(1, 'Folha')] }),
    );

    expect(verdict.block).toBeNull();
    expect(verdict.measures.volume).toBe(volume);
  });

  it('does not opine without three successful days in the window, and says so', () => {
    // O primeiro dia depois do deploy, ou a manhã depois de uma lacuna como a
    // de 29–31/08: a mediana seria sobre dias vazios (perto de zero, aprovando
    // tudo) ou `NaN` (bloqueando tudo). Armadilha 24.
    const verdict = evaluateEntryGate(
      healthyInput({ deduplicated: items(5, 'G1'), selected: items(5, 'G1'), baseline: [day(1, 300), day(2, 300)] }),
    );

    expect(verdict.block).toBeNull();
    expect(verdict.baseline).toBe('insufficient');
    expect(verdict.measures).toMatchObject({ baselineDays: 2, median: null, volumeRatio: null, categoryDrift: null });
    expect(MIN_BASELINE_DAYS).toBe(3);
  });

  it('counts only days with a briefing — a row without one is not "normal"', () => {
    const verdict = evaluateEntryGate(
      healthyInput({
        deduplicated: items(5, 'G1'),
        baseline: [day(1, 300), day(2, 300), day(3, 300, { articleGenerated: false })],
      }),
    );

    expect(verdict.baseline).toBe('insufficient');
    expect(verdict.measures.baselineDays).toBe(2);
  });

  it('uses the median, so one giant day does not move the bar', () => {
    const verdict = evaluateEntryGate(
      healthyInput({
        deduplicated: items(120, 'G1'),
        baseline: [day(1, 300), day(2, 300), day(3, 300), day(4, 9_000)],
      }),
    );

    expect(verdict.measures.median).toBe(300);
    expect(verdict.block).toBeNull();
  });

  it('never divides by a zero median', () => {
    const verdict = evaluateEntryGate(
      healthyInput({ deduplicated: items(1, 'G1'), baseline: [day(1, 0), day(2, 0), day(3, 0)] }),
    );

    expect(verdict.block?.check).not.toBe('volume');
    expect(verdict.measures).toMatchObject({ median: 0, volumeRatio: null });
  });
});

describe('diversidade — alarga uma vez antes de desistir', () => {
  it('widens when the 15 most recent come from fewer than three sources, and passes the widened selection on', () => {
    // O acidente de ordenação: o G1 publicou 20 matérias na última hora e a
    // BBC e a Folha há três horas. As 15 mais recentes são só G1.
    const g1 = items(20, 'G1');
    const others = [
      ...items(5, 'BBC', { publishedAt: new Date(NOW.getTime() - 3 * 3_600_000) }),
      ...items(5, 'Folha', { publishedAt: new Date(NOW.getTime() - 3 * 3_600_000) }),
    ];
    const deduplicated = [...g1, ...others];
    const select = (limit: number) =>
      [...deduplicated].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, limit);
    const widen = vi.fn(() => select(WIDENED_SELECTION));

    // Sem linha de base, para o volume (30 itens) não opinar: o que se mede
    // aqui é a diversidade.
    const verdict = evaluateEntryGate(healthyInput({ deduplicated, selected: select(15), widen, baseline: [] }));

    expect(widen).toHaveBeenCalledTimes(1);
    expect(verdict.block).toBeNull();
    expect(verdict.selected).toHaveLength(30);
    expect(verdict.measures).toMatchObject({ widened: true, sources: 3 });
  });

  it('blocks only when even the widened selection has fewer than three sources', () => {
    const deduplicated = [...items(20, 'G1'), ...items(20, 'BBC')];
    const verdict = evaluateEntryGate(
      healthyInput({ deduplicated, selected: deduplicated.slice(0, 15), widen: () => deduplicated.slice(0, 30), baseline: [] }),
    );

    expect(verdict.block).toEqual({
      check: 'diversity',
      detail: `2 distinct sources < ${MIN_DISTINCT_SOURCES}, even among 30`,
    });
    expect(verdict.measures).toMatchObject({ widened: true, sources: 2 });
    // A seleção devolvida é a original: o alargamento não comprou nada.
    expect(verdict.selected).toHaveLength(15);
  });

  it('does not widen when the first selection is already diverse', () => {
    const widen = vi.fn(() => []);
    const verdict = evaluateEntryGate(healthyInput({ widen }));

    expect(widen).not.toHaveBeenCalled();
    expect(verdict.measures.widened).toBe(false);
  });
});

describe('frescor — 24 h, não "hoje"', () => {
  it('blocks when the newest selected item is older than the window', () => {
    const thirtyHoursAgo = new Date(NOW.getTime() - 30 * 3_600_000);
    const selected = [
      ...items(5, 'G1', { publishedAt: thirtyHoursAgo }),
      ...items(5, 'BBC', { publishedAt: thirtyHoursAgo }),
      ...items(5, 'Folha', { publishedAt: thirtyHoursAgo }),
    ];
    const verdict = evaluateEntryGate(healthyInput({ selected }));

    expect(verdict.block).toEqual({
      check: 'freshness',
      detail: 'newest selected item is 30 h old, window is 24 h',
    });
  });

  it('approves when one item is inside the window, even if the rest is from yesterday', () => {
    // ~39% de toda colheita chega carimbada com a data da véspera — é norma.
    const yesterday = new Date(NOW.getTime() - 26 * 3_600_000);
    const selected = [
      item({ source: 'G1', publishedAt: new Date(NOW.getTime() - 23 * 3_600_000) }),
      ...items(7, 'BBC', { publishedAt: yesterday }),
      ...items(7, 'Folha', { publishedAt: yesterday }),
    ];
    const verdict = evaluateEntryGate(healthyInput({ selected }));

    expect(verdict.block).toBeNull();
    expect(verdict.measures.freshestAgeHours).toBe(23);
    expect(FRESHNESS_WINDOW_MS).toBe(24 * 3_600_000);
  });

  it('judges the widened selection when the gate widened', () => {
    // O item fresco estava fora das 15 e entrou com o alargamento: o frescor
    // é conferido sobre o que vai ao modelo.
    const old = new Date(NOW.getTime() - 30 * 3_600_000);
    const g1 = items(15, 'G1', { publishedAt: old });
    const fresh = [item({ source: 'BBC' }), item({ source: 'Folha' })];
    const verdict = evaluateEntryGate(
      healthyInput({ deduplicated: [...g1, ...fresh], selected: g1, widen: () => [...g1, ...fresh], baseline: [] }),
    );

    expect(verdict.block).toBeNull();
    expect(verdict.measures.widened).toBe(true);
  });
});

describe('os dois avisos', () => {
  it('warns on a duplicate rate above 60% — and does not block', () => {
    const verdict = evaluateEntryGate(healthyInput({ collected: 1_000 }));

    expect(verdict.block).toBeNull();
    expect(verdict.warnings).toEqual([
      { check: 'duplicate-rate', detail: '70% of 1000 collected were duplicates' },
    ]);
    expect(verdict.measures.duplicateRate).toBe(0.7);
    expect(MAX_DUPLICATE_RATE).toBe(0.6);
  });

  it('warns on category drift against the window mean — and does not block', () => {
    // A janela é 60/40 Mundo/Tecnologia; hoje é 100% Esportes.
    const deduplicated = [...items(100, 'G1', { category: Category.SPORTS }), ...items(100, 'BBC', { category: Category.SPORTS }), ...items(100, 'Folha', { category: Category.SPORTS })];
    const verdict = evaluateEntryGate(healthyInput({ deduplicated, selected: deduplicated.slice(0, 15) }));

    expect(verdict.block).toBeNull();
    expect(verdict.warnings.map((w) => w.check)).toEqual(['category-drift']);
    expect(verdict.measures.categoryDrift).toBe(1);
  });

  it('measures drift as total variation, weighted by the size of each baseline day', () => {
    expect(categoryDrift({ WORLD: 6, TECHNOLOGY: 4 }, [day(1, 100)])).toBe(0);
    expect(categoryDrift({ WORLD: 10 }, [day(1, 100)])).toBe(0.4);
    expect(categoryDrift({ SPORTS: 10 }, [day(1, 100)])).toBe(1);
    expect(categoryDrift({ WORLD: 1 }, [])).toBeNull();
    expect(categoryDrift({}, [day(1, 100)])).toBeNull();
  });

  it('does not measure drift without a baseline', () => {
    const verdict = evaluateEntryGate(healthyInput({ baseline: [] }));

    expect(verdict.measures.categoryDrift).toBeNull();
    expect(verdict.warnings).toEqual([]);
  });
});

describe('a ordem dos bloqueios e o retrato completo', () => {
  it('reports the first block in table order — volume, diversity, freshness — and still measures the rest', () => {
    const stale = items(10, 'G1', { publishedAt: new Date(NOW.getTime() - 40 * 3_600_000) });
    const verdict = evaluateEntryGate(
      healthyInput({ deduplicated: stale, selected: stale, widen: () => stale, collected: 100 }),
    );

    expect(verdict.block?.check).toBe('volume');
    // Diversidade e frescor também reprovariam, e as medidas dizem isso; o
    // aviso de duplicata (90%) também sai. 100% Mundo contra 60/40 é deriva
    // de 0,4 — acima do teto desde a calibração contra produção (0,25, Fase
    // 12), então avisa também: até 24/09 o teto era 0,5, calibrado por cima.
    expect(verdict.measures).toMatchObject({ sources: 1, widened: true, freshestAgeHours: 40, categoryDrift: 0.4 });
    expect(verdict.warnings.map((w) => w.check)).toEqual(['duplicate-rate', 'category-drift']);
  });
});

describe('loadEntryBaseline — os sete dias anteriores', () => {
  beforeEach(() => {
    vi.mocked(prisma.dailyMetric.findMany).mockReset();
  });

  it('reads the window before today, never today, from the date index', async () => {
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue([
      { date: new Date('2026-09-18T00:00:00.000Z'), newsCollected: 310, newsByCategory: { WORLD: 200 }, articleGenerated: true },
    ] as never);
    const today = new Date('2026-09-19T00:00:00.000Z');

    const rows = await loadEntryBaseline(today);

    expect(prisma.dailyMetric.findMany).toHaveBeenCalledWith({
      where: { date: { gte: new Date('2026-09-12T00:00:00.000Z'), lt: today } },
      select: { date: true, newsCollected: true, newsByCategory: true, articleGenerated: true },
      orderBy: { date: 'asc' },
    });
    expect(rows).toEqual([
      expect.objectContaining({ newsCollected: 310, newsByCategory: { WORLD: 200 }, articleGenerated: true }),
    ]);
    expect(ENTRY_BASELINE_DAYS).toBe(7);
  });

  it('reads an empty newsByCategory as an empty map, never as null', async () => {
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue([
      { date: new Date('2026-09-18T00:00:00.000Z'), newsCollected: 0, newsByCategory: null, articleGenerated: true },
    ] as never);

    const [row] = await loadEntryBaseline(new Date('2026-09-19T00:00:00.000Z'));

    expect(row?.newsByCategory).toEqual({});
  });
});
