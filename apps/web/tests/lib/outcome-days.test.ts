import { describe, it, expect } from 'vitest';
import type { PipelineRunSummary } from '@newranews/types';
import { lastBriefingRun, outcomeByDay, OUTCOME_WINDOW_DAYS } from '@/lib/outcome-days';

/**
 * **Fase 8 — o dia que não rodou é um estado, e não é `FAILED`.**
 *
 * Em 01/09/2026 o cron estourou o prazo, nenhuma linha foi gravada, e o único
 * sinal foi o briefing ausente na Home. Ausência de linha não é o mesmo que
 * linha de falha — e as duas pedem ações opostas. A API não sabe dizer
 * `NEVER_RAN` (ela lista o que existe); quem sabe é o calendário, e ele mora
 * aqui, sobre a listagem dos últimos 30 dias.
 */

function run(overrides: Partial<PipelineRunSummary> & { startedAt: string }): PipelineRunSummary {
  return {
    id: `run-${overrides.startedAt}`,
    status: 'SUCCESS',
    newsCount: 377,
    articleId: 'article-1',
    error: null,
    errorStage: null,
    errorDetail: null,
    completedAt: overrides.startedAt,
    durationSeconds: 45,
    eventCount: 19,
    outcome: 'SUCCESS',
    degradedBy: [],
    ...overrides,
  };
}

// Um instante no meio do dia UTC, para o dia de hoje ser inequívoco.
const NOW = new Date('2026-09-15T15:00:00.000Z');

describe('outcomeByDay', () => {
  it('fills the window with one entry per UTC day, oldest first, today last', () => {
    const days = outcomeByDay([], NOW);

    expect(days).toHaveLength(OUTCOME_WINDOW_DAYS);
    expect(days[0]?.date).toBe('2026-08-17');
    expect(days[days.length - 1]?.date).toBe('2026-09-15');
  });

  it('a day without a run is NEVER_RAN — not FAILED', () => {
    // O buraco de 29–31/08 apareceria como três quadrados vazados.
    const days = outcomeByDay([run({ startedAt: '2026-09-01T11:00:10.000Z' })], NOW);
    const byDate = new Map(days.map((day) => [day.date, day]));

    expect(byDate.get('2026-08-31')?.outcome).toBe('NEVER_RAN');
    expect(byDate.get('2026-08-31')?.run).toBeNull();
    expect(byDate.get('2026-09-01')?.outcome).toBe('SUCCESS');
  });

  it('the last run to start is the one that represents the day', () => {
    // Disparo manual às 16:25 depois do cron das 11:00: o painel já chama o
    // mais recente de "último", e é ele o candidato honesto.
    const cron = run({
      id: 'cron',
      startedAt: '2026-09-10T11:00:10.000Z',
      status: 'FAILED',
      outcome: 'FAILED',
    });
    const manual = run({
      id: 'manual',
      startedAt: '2026-09-10T16:25:00.000Z',
      outcome: 'SUCCESS_DEGRADED',
      degradedBy: [7.5],
    });

    // Na ordem em que a API devolve (mais recente primeiro) e na inversa: a
    // escolha é pelo instante, não pela posição.
    for (const runs of [[manual, cron], [cron, manual]]) {
      const day = outcomeByDay(runs, NOW).find((entry) => entry.date === '2026-09-10');
      expect(day?.outcome).toBe('SUCCESS_DEGRADED');
      expect(day?.degradedBy).toEqual([7.5]);
      expect(day?.run?.id).toBe('manual');
    }
  });

  it('groups by the UTC day, never the local one', () => {
    // 23:30 UTC de 14/09 é 20:30 de 14/09 no Brasil, e seria 15/09 em Tóquio;
    // o dia do run é o da API — UTC —, como o `Article.date`.
    const days = outcomeByDay([run({ startedAt: '2026-09-14T23:30:00.000Z' })], NOW);
    const byDate = new Map(days.map((day) => [day.date, day]));

    expect(byDate.get('2026-09-14')?.outcome).toBe('SUCCESS');
    expect(byDate.get('2026-09-15')?.outcome).toBe('NEVER_RAN');
  });

  it('a run still RUNNING marks the day RUNNING, not NEVER_RAN', () => {
    const days = outcomeByDay(
      [run({ startedAt: '2026-09-15T11:00:10.000Z', status: 'RUNNING', outcome: null, completedAt: null })],
      NOW,
    );

    expect(days[days.length - 1]?.outcome).toBe('RUNNING');
  });

  it('ignores runs outside the window instead of stretching it', () => {
    const days = outcomeByDay([run({ startedAt: '2026-07-01T11:00:00.000Z' })], NOW);

    expect(days).toHaveLength(OUTCOME_WINDOW_DAYS);
    expect(days.every((day) => day.outcome === 'NEVER_RAN')).toBe(true);
  });
});

/**
 * O batimento positivo (§12.3): "último briefing há N h" mede do último run
 * que **produziu** briefing. Se o de hoje falhou, o briefing no ar é o de
 * ontem, e a idade honesta é a dele.
 */
describe('lastBriefingRun', () => {
  it('picks the latest SUCCESS run, not the latest run', () => {
    const failedToday = run({
      id: 'failed-today',
      startedAt: '2026-09-15T11:00:00.000Z',
      status: 'FAILED',
      outcome: 'FAILED',
      completedAt: null,
    });
    const yesterday = run({ id: 'yesterday', startedAt: '2026-09-14T11:00:00.000Z', completedAt: '2026-09-14T11:00:45.000Z' });
    const older = run({ id: 'older', startedAt: '2026-09-13T11:00:00.000Z', completedAt: '2026-09-13T11:00:45.000Z' });

    expect(lastBriefingRun([failedToday, older, yesterday])?.id).toBe('yesterday');
  });

  it('counts a degraded run as a briefing — the article came out', () => {
    const degraded = run({
      id: 'degraded',
      startedAt: '2026-09-15T11:00:00.000Z',
      outcome: 'SUCCESS_DEGRADED',
      degradedBy: [7.5],
    });

    expect(lastBriefingRun([degraded])?.id).toBe('degraded');
  });

  it('is null when nothing in the window produced a briefing', () => {
    const running = run({ startedAt: '2026-09-15T11:00:00.000Z', status: 'RUNNING', outcome: null, completedAt: null });

    expect(lastBriefingRun([])).toBeNull();
    expect(lastBriefingRun([running])).toBeNull();
  });
});
