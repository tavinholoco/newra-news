import { describe, it, expect } from 'vitest';
import type { SourceDay, SourceHealthReport, SourceOutcome, SourceSeries } from '@newranews/types';
import {
  FAILED_STREAK_TRIGGER,
  MIN_RECENT_SAMPLE,
  MIN_WINDOW_SAMPLE,
  SOURCE_WINDOW_DAYS,
  WITHERING_RATIO,
  failedStreak,
  reportStats,
  sourceAlerts,
  sourceCalendar,
  sourceStats,
} from '@/lib/source-days';

/**
 * A derivação por dia de calendário da saúde por fonte (§15 do plano de
 * observabilidade, Fase 11) — o `outcome-days.test.ts` desta série.
 *
 * O que se mede: que "não tentada" nasce da **ausência** de linha (a API não
 * emite um quarto valor), que as médias são sobre os dias tentados e não sobre
 * o calendário, que a sequência de falhas não é quebrada por um dia sem run,
 * e que os dois gatilhos da §15 disparam onde a §15 diz — e só ali.
 */

const WINDOW = { since: '2026-08-17T00:00:00.000Z', until: '2026-09-15T00:00:00.000Z' };

const day = (date: string, outcome: SourceOutcome, kept = 10, extra: Partial<SourceDay> = {}): SourceDay => ({
  day: `${date}T00:00:00.000Z`,
  outcome,
  fetched: outcome === 'OK' ? kept + 5 : 0,
  kept: outcome === 'OK' ? kept : 0,
  latencyMs: outcome === 'FAILED' ? 30_000 : 500,
  failureReason: outcome === 'FAILED' ? 'ETIMEDOUT' : null,
  pipelineLogId: `run-${date}`,
  ...extra,
});

/** `days` dias seguidos terminando em `until`, todos com o mesmo desfecho e `kept`. */
function run(source: string, days: number, outcome: SourceOutcome, kept = 10, until = '2026-09-15'): SourceSeries {
  const list: SourceDay[] = [];
  const end = new Date(`${until}T00:00:00.000Z`);
  for (let offset = days - 1; offset >= 0; offset--) {
    const at = new Date(end.getTime() - offset * 86_400_000);
    list.push(day(at.toISOString().slice(0, 10), outcome, kept));
  }
  return { source, kind: 'RSS', days: list };
}

describe('sourceCalendar — o dia sem linha é "não tentada"', () => {
  it('fills the window with one entry per UTC day, absent days as NOT_ATTEMPTED', () => {
    const series: SourceSeries = {
      source: 'G1',
      kind: 'RSS',
      days: [day('2026-09-13', 'OK'), day('2026-09-15', 'EMPTY')],
    };

    const calendar = sourceCalendar(series, WINDOW);

    expect(calendar).toHaveLength(SOURCE_WINDOW_DAYS);
    expect(calendar[0]?.date).toBe('2026-08-17');
    expect(calendar[calendar.length - 1]).toMatchObject({ date: '2026-09-15', state: 'EMPTY' });
    expect(calendar.find((d) => d.date === '2026-09-14')).toEqual({
      date: '2026-09-14',
      state: 'NOT_ATTEMPTED',
      day: null,
    });
    expect(calendar.find((d) => d.date === '2026-09-13')?.state).toBe('OK');
  });

  it('reads the day in UTC — a midnight line stays on its own day in any timezone', () => {
    const series: SourceSeries = { source: 'G1', kind: 'RSS', days: [day('2026-09-01', 'OK')] };

    const calendar = sourceCalendar(series, WINDOW);

    expect(calendar.find((d) => d.state === 'OK')?.date).toBe('2026-09-01');
  });

  it('keeps the source that left the list mid-window: its series ends, the rest is NOT_ATTEMPTED', () => {
    const series = run('Reuters', 5, 'OK', 10, '2026-08-25');

    const calendar = sourceCalendar(series, WINDOW);

    expect(calendar.filter((d) => d.state === 'OK')).toHaveLength(5);
    expect(calendar.slice(-20).every((d) => d.state === 'NOT_ATTEMPTED')).toBe(true);
  });
});

describe('failedStreak — a Superinteressante de 03/09', () => {
  it('counts consecutive FAILED days from the most recent backwards', () => {
    const series: SourceSeries = {
      source: 'Superinteressante',
      kind: 'RSS',
      days: [day('2026-09-12', 'OK'), day('2026-09-13', 'FAILED'), day('2026-09-14', 'FAILED'), day('2026-09-15', 'FAILED')],
    };

    expect(failedStreak(sourceCalendar(series, WINDOW))).toBe(3);
  });

  it('is not broken by a day the pipeline did not run — it did not ask the source', () => {
    const series: SourceSeries = {
      source: 'Superinteressante',
      kind: 'RSS',
      days: [day('2026-09-12', 'FAILED'), day('2026-09-13', 'FAILED'), day('2026-09-15', 'FAILED')],
    };

    expect(failedStreak(sourceCalendar(series, WINDOW))).toBe(3);
  });

  it('is broken by EMPTY — the source answered, it just had nothing', () => {
    const series: SourceSeries = {
      source: 'Veja Saúde',
      kind: 'RSS',
      days: [day('2026-09-13', 'FAILED'), day('2026-09-14', 'EMPTY'), day('2026-09-15', 'FAILED')],
    };

    expect(failedStreak(sourceCalendar(series, WINDOW))).toBe(1);
  });

  it('is zero when the last attempted day was not a failure', () => {
    expect(failedStreak(sourceCalendar(run('G1', 10, 'OK'), WINDOW))).toBe(0);
  });
});

describe('sourceStats — médias sobre os dias tentados', () => {
  it('averages kept over attempted days only, and counts FAILED and EMPTY as zero', () => {
    // 5 dias OK com 10, 1 FAILED, 1 EMPTY nos últimos 7; nenhuma linha antes.
    const series: SourceSeries = {
      source: 'G1',
      kind: 'RSS',
      days: [
        day('2026-09-09', 'OK', 10),
        day('2026-09-10', 'OK', 10),
        day('2026-09-11', 'FAILED'),
        day('2026-09-12', 'OK', 10),
        day('2026-09-13', 'EMPTY'),
        day('2026-09-14', 'OK', 10),
        day('2026-09-15', 'OK', 10),
      ],
    };

    const stats = sourceStats(series, WINDOW);

    expect(stats.keptAvg7).toBeCloseTo(50 / 7);
    expect(stats.keptAvg30).toBeCloseTo(50 / 7);
    expect(stats.keptTotal).toBe(50);
    expect(stats.today.state).toBe('OK');
    expect(stats.latencyMs).toBe(500);
  });

  it('does not count the day the pipeline did not run against the source', () => {
    // 3 dias tentados com 10 nos últimos 7, e 4 sem run: a média é 10, não 30/7.
    const series: SourceSeries = {
      source: 'G1',
      kind: 'RSS',
      days: [day('2026-09-11', 'OK', 10), day('2026-09-13', 'OK', 10), day('2026-09-15', 'OK', 10)],
    };

    expect(sourceStats(series, WINDOW).keptAvg7).toBe(10);
  });

  it('stays silent below the minimum sample — NaN would compare false in every direction', () => {
    const tooFew = run('G1', MIN_RECENT_SAMPLE - 1, 'OK');

    const stats = sourceStats(tooFew, WINDOW);

    expect(stats.keptAvg7).toBeNull();
    expect(stats.keptAvg30).toBeNull();
    expect(stats.keptChange).toBeNull();
  });

  it('computes the change of the 7-day average against the 30-day one', () => {
    // 23 dias a 10, depois 7 dias a 5: média 30 = (230 + 35) / 30 ≈ 8,83; 7 = 5.
    const older = run('Trivela', 23, 'OK', 10, '2026-09-08').days;
    const recent = run('Trivela', 7, 'OK', 5).days;
    const series: SourceSeries = { source: 'Trivela', kind: 'RSS', days: [...older, ...recent] };

    const stats = sourceStats(series, WINDOW);

    expect(stats.keptAvg7).toBe(5);
    expect(stats.keptAvg30).toBeCloseTo(265 / 30);
    expect(stats.keptChange).toBeCloseTo(5 / (265 / 30) - 1);
  });

  it('reads the latency of the last attempted day, even when today was not attempted', () => {
    const series: SourceSeries = { source: 'G1', kind: 'RSS', days: [day('2026-09-13', 'FAILED')] };

    const stats = sourceStats(series, WINDOW);

    expect(stats.today.state).toBe('NOT_ATTEMPTED');
    expect(stats.latencyMs).toBe(30_000);
  });

  it('requires the window sample for the 30-day average', () => {
    expect(MIN_WINDOW_SAMPLE).toBeGreaterThan(MIN_RECENT_SAMPLE);
    expect(sourceStats(run('G1', MIN_WINDOW_SAMPLE - 1, 'OK'), WINDOW).keptAvg30).toBeNull();
    expect(sourceStats(run('G1', MIN_WINDOW_SAMPLE, 'OK'), WINDOW).keptAvg30).toBe(10);
  });
});

describe('sourceAlerts — os dois gatilhos da §15, e só eles', () => {
  it('fires failed-streak at the trigger, with the count', () => {
    const stats = [sourceStats(run('Superinteressante', FAILED_STREAK_TRIGGER, 'FAILED'), WINDOW)];

    expect(sourceAlerts(stats)).toEqual([
      { kind: 'failed-streak', source: 'Superinteressante', days: FAILED_STREAK_TRIGGER },
    ]);
  });

  it('stays quiet one day short of the trigger', () => {
    const stats = [sourceStats(run('Superinteressante', FAILED_STREAK_TRIGGER - 1, 'FAILED'), WINDOW)];

    expect(sourceAlerts(stats)).toEqual([]);
  });

  it('fires withering when the 7-day average drops below the ratio of the 30-day one', () => {
    // 23 dias a 10 e 7 dias a 2: 2 / ((230 + 14) / 30) ≈ 0,246 < 0,3.
    const older = run('Trivela', 23, 'OK', 10, '2026-09-08').days;
    const recent = run('Trivela', 7, 'OK', 2).days;
    const stats = [sourceStats({ source: 'Trivela', kind: 'RSS', days: [...older, ...recent] }, WINDOW)];

    const alerts = sourceAlerts(stats);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: 'withering', source: 'Trivela' });
    expect((alerts[0] as { ratio: number }).ratio).toBeLessThan(WITHERING_RATIO);
  });

  it('does not call a steady source withering', () => {
    expect(sourceAlerts([sourceStats(run('G1', 30, 'OK', 10), WINDOW)])).toEqual([]);
  });

  it('does not call a source withering without the sample — the gate says it kept quiet', () => {
    const stats = [sourceStats(run('Nova', 2, 'OK', 1), WINDOW)];

    expect(stats[0]?.keptChange).toBeNull();
    expect(sourceAlerts(stats)).toEqual([]);
  });

  it('reports the failed streak, not withering, for the source that is down — one alert per cause', () => {
    // 27 dias a 10 e 3 FAILED: a média de 7 caiu, mas a causa é a falha.
    const older = run('Superinteressante', 27, 'OK', 10, '2026-09-12').days;
    const recent = run('Superinteressante', 3, 'FAILED').days;
    const stats = [sourceStats({ source: 'Superinteressante', kind: 'RSS', days: [...older, ...recent] }, WINDOW)];

    expect(sourceAlerts(stats).map((alert) => alert.kind)).toEqual(['failed-streak']);
  });
});

describe('reportStats — a janela do relatório', () => {
  it('derives one stats entry per source over the report window', () => {
    const report: SourceHealthReport = {
      window: { days: 30, ...WINDOW },
      sources: [run('G1', 30, 'OK', 20), run('newsdata', 30, 'OK', 40)],
    };

    const stats = reportStats(report);

    expect(stats.map((s) => s.source)).toEqual(['G1', 'newsdata']);
    expect(stats.map((s) => s.keptTotal)).toEqual([600, 1200]);
    expect(stats.every((s) => s.calendar.length === 30)).toBe(true);
  });
});
