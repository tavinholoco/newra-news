import { describe, it, expect } from 'vitest';
import {
  formatCalendarDay,
  formatDeltaPercent,
  formatHours,
  formatMegabytes,
  formatMilliseconds,
  formatRate,
  formatRatio,
  formatUptime,
} from '@/lib/format';
import { kpiDelta } from '@/lib/kpi';
import { fillCalendarDays } from '@/lib/series';
import {
  ATTENTION_RATIO,
  PACE_MIN_ELAPSED_HOURS,
  planPace,
  saturationTone,
} from '@/lib/saturation';

/**
 * As funções puras do PR 5c — o que a tela de observabilidade calcula antes
 * de desenhar. Cada uma existe por um defeito nomeado no cabeçalho dela, e o
 * teste é sobre esse defeito.
 */

describe('formatDeltaPercent', () => {
  it('carries the sign, in the locale', () => {
    expect(formatDeltaPercent(491, 436.4)).toBe('+12,5%');
    expect(formatDeltaPercent(27_000, 30_000)).toBe('-10%');
    expect(formatDeltaPercent(491, 436.4, 'en-US')).toBe('+12.5%');
  });

  it('is null without an honest baseline — never "+∞%"', () => {
    expect(formatDeltaPercent(10, 0)).toBeNull();
    expect(formatDeltaPercent(10, null)).toBeNull();
    expect(formatDeltaPercent(null, 10)).toBeNull();
  });
});

describe('kpiDelta', () => {
  const options = { period: 'vs. média 7 d', locale: 'pt-BR' };

  it('says whether the direction is good, not only where it points', () => {
    expect(kpiDelta(491, 436.4, options)).toEqual({
      text: '+12,5%',
      direction: 'up',
      tone: 'better',
      period: 'vs. média 7 d',
    });
    // Duração subindo é pior.
    expect(kpiDelta(33_000, 30_000, { ...options, betterWhen: 'down' })?.tone).toBe('worse');
    expect(kpiDelta(27_000, 30_000, { ...options, betterWhen: 'down' })?.tone).toBe('better');
  });

  it('is flat exactly when the text rounds to 0%', () => {
    // 0,04% imprime "0%": seta neutra. 0,3% imprime "+0,3%": seta para cima.
    expect(kpiDelta(1000.4, 1000, options)).toMatchObject({ direction: 'flat', tone: 'neutral', text: '0%' });
    expect(kpiDelta(491, 489.7, options)).toMatchObject({ direction: 'up', text: '+0,3%' });
  });

  it('is null when there is nothing to compare against', () => {
    expect(kpiDelta(undefined, 436.4, options)).toBeNull();
    expect(kpiDelta(491, 0, options)).toBeNull();
  });
});

describe('saturationTone', () => {
  it('is neutral below the attention line, orange up to the ceiling, red past it', () => {
    expect(ATTENTION_RATIO).toBe(0.8);
    expect(saturationTone(0.41)).toBe('neutral');
    expect(saturationTone(0.8)).toBe('attention');
    expect(saturationTone(0.99)).toBe('attention');
    // 29/08/2026: passar de 1 é o que suspendeu a API.
    expect(saturationTone(1)).toBe('exceeded');
    expect(saturationTone(1.04)).toBe('exceeded');
  });
});

describe('planPace', () => {
  const plan = {
    month: '2026-09',
    monthStart: '2026-09-01T00:00:00.000Z',
    secondsUsed: 0,
    hoursUsed: 240,
    limitHours: 750,
    ratio: 0.32,
  };

  it('projects the month from the hours elapsed — the number that would have warned before 29/08', () => {
    // Dia 11 às 00:00 UTC: 240 h decorridas e 240 h usadas é 24/7, e 24/7 em
    // setembro são 720 h — 96% do plano, com o arco de hoje dizendo só 32%.
    const pace = planPace(plan, new Date('2026-09-11T00:00:00.000Z'));

    expect(pace).toEqual({ projectedHours: 720, projectedRatio: 0.96, hoursInMonth: 720 });
  });

  it('says nothing before a day of sample — the gate without a baseline', () => {
    expect(PACE_MIN_ELAPSED_HOURS).toBe(24);
    expect(planPace({ ...plan, hoursUsed: 2 }, new Date('2026-09-01T02:00:00.000Z'))).toBeNull();
    expect(planPace({ ...plan, hoursUsed: 24 }, new Date('2026-09-02T00:00:00.000Z'))).not.toBeNull();
  });

  it('says nothing when the plan month is not the clock month', () => {
    expect(planPace(plan, new Date('2026-10-05T00:00:00.000Z'))).toBeNull();
  });

  it('uses the calendar length of the month', () => {
    const october = { ...plan, month: '2026-10', monthStart: '2026-10-01T00:00:00.000Z' };
    expect(planPace(october, new Date('2026-10-11T00:00:00.000Z'))?.hoursInMonth).toBe(744);
  });
});

describe('fillCalendarDays', () => {
  const period = { start: '2026-09-11T18:35:00.000Z', end: '2026-09-14T18:35:00.000Z' };
  const empty = (date: string) => ({ date, sessions: 0, events: 0 });

  it('gives every calendar day of the window a slot, zero where nothing happened', () => {
    // A API só devolve os dias com evento: um dia numa janela de 30 virava
    // uma barra de largura inteira, e o eixo do tempo deixava de existir.
    const filled = fillCalendarDays([{ date: '2026-09-13', sessions: 4, events: 9 }], period, empty);

    expect(filled.map((day) => day.date)).toEqual(['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14']);
    expect(filled.map((day) => day.sessions)).toEqual([0, 0, 4, 0]);
  });

  it('counts the days in UTC — the keys are UTC days', () => {
    // 23:30 UTC do dia 11 ainda é dia 11; no fuso de São Paulo seria 20:30 do
    // mesmo dia, mas em Tóquio já seria dia 12 — e a chave é UTC.
    const filled = fillCalendarDays([], { start: '2026-09-11T23:30:00.000Z', end: '2026-09-12T00:30:00.000Z' }, empty);
    expect(filled.map((day) => day.date)).toEqual(['2026-09-11', '2026-09-12']);
  });

  it('leaves the points alone when the window is not a window', () => {
    const points = [{ date: '2026-09-13', sessions: 1, events: 1 }];
    expect(fillCalendarDays(points, { start: 'nope', end: period.end }, empty)).toBe(points);
    expect(fillCalendarDays(points, { start: period.end, end: period.start }, empty)).toBe(points);
  });
});

describe('os formatadores da observabilidade', () => {
  it('formatMilliseconds keeps the tens of milliseconds a latency lives in', () => {
    expect(formatMilliseconds(42)).toBe('42 ms');
    expect(formatMilliseconds(4903)).toBe('4,9 s');
    expect(formatMilliseconds(4903, 'en-US')).toBe('4.9 s');
  });

  it('formatRatio goes past 100% — the arc must say 104%, not 100%', () => {
    expect(formatRatio(0.4067)).toBe('41%');
    expect(formatRatio(1.04)).toBe('104%');
    expect(formatRatio(-0.2)).toBe('0%');
  });

  it('formatRate keeps two decimals for an HTTP error rate', () => {
    expect(formatRate(0.0008)).toBe('0,08%');
    expect(formatRate(0)).toBe('0%');
  });

  it('formatMegabytes, formatHours and formatUptime read like an operator would', () => {
    expect(formatMegabytes(98_304_000)).toBe('94 MB');
    expect(formatMegabytes(536_870_912)).toBe('512 MB');
    expect(formatHours(305.4)).toBe('305 h');
    expect(formatUptime(11_520)).toBe('3 h 12 min');
    expect(formatUptime(2_700)).toBe('45 min');
    expect(formatUptime(30)).toBe('30 s');
  });

  it('formatCalendarDay reads a YYYY-MM-DD key in UTC, so 01/09 stays 01/09 in Brazil', () => {
    // `byDay.date` é o dia UTC do `toISOString().slice(0, 10)`. Lido no fuso
    // local, `2026-09-01` viraria 31/08 em qualquer fuso negativo.
    expect(formatCalendarDay('2026-09-01')).toMatch(/^01 de set\.?$/);
    expect(formatCalendarDay('2026-09-01', 'en-US')).toBe('Sep 01');
  });
});
