import { describe, it, expect } from 'vitest';
import type { ErrorGroup, PipelineRunSummary } from '@newranews/types';
import {
  APPROVAL_TRIGGER,
  GATE_BLOCKED_CODE,
  gateAlerts,
  gateDecisions,
  parseGateRoute,
} from '@/lib/gate-decisions';

/**
 * **Fase 9 — o sinal que a literatura pede, derivado do que já existe.**
 *
 * A taxa de aprovação dos portões e a distribuição de motivos saem do
 * `GET /api/admin/errors` (os grupos com `PIPELINE_GATE_BLOCKED` e o motivo no
 * `route`) e da listagem de runs — sem rota nova, como o `degradedStreak`.
 */

const SINCE = '2026-09-13T00:00:00.000Z';

function run(startedAt: string, status: PipelineRunSummary['status'] = 'SUCCESS'): PipelineRunSummary {
  return {
    id: `run-${startedAt}`,
    status,
    startedAt,
    newsCount: 377,
    articleId: status === 'SUCCESS' ? 'article-1' : null,
    error: null,
    errorStage: null,
    errorDetail: null,
    completedAt: status === 'RUNNING' ? null : startedAt,
    durationSeconds: 45,
    eventCount: 19,
    outcome: status === 'RUNNING' ? null : status,
    degradedBy: [],
  };
}

function group(overrides: Partial<ErrorGroup>): ErrorGroup {
  return {
    fingerprint: 'PIPELINE:ERROR:PIPELINE_GATE_BLOCKED:stage-5.5:volume',
    origin: 'PIPELINE',
    severity: 'ERROR',
    code: GATE_BLOCKED_CODE,
    category: 'upstream',
    route: 'stage-5.5:volume',
    statusCode: null,
    message: 'Entry gate blocked: volume',
    count: 1,
    hours: 1,
    firstSeenAt: '2026-09-14T11:00:00.000Z',
    lastSeenAt: '2026-09-14T11:00:00.000Z',
    lastRequestId: null,
    pipelineLogId: 'run-1',
    ...overrides,
  };
}

/** Sete runs, um por dia, todos verdes. */
const WEEK = [13, 14, 15, 16, 17, 18, 19].map((day) => run(`2026-09-${day}T11:00:00.000Z`));

describe('parseGateRoute', () => {
  it('reads the gate and the check off the route the API writes', () => {
    expect(parseGateRoute('stage-6.5:unanchored-url')).toEqual({ gate: 'exit', check: 'unanchored-url' });
    expect(parseGateRoute('stage-5.5:volume')).toEqual({ gate: 'entry', check: 'volume' });
  });

  it('ignores every other form of route — a stage without a motive is not a gate line', () => {
    expect(parseGateRoute('stage-6.5')).toBeNull();
    expect(parseGateRoute('stage-8.5')).toBeNull();
    expect(parseGateRoute('/api/news/:id')).toBeNull();
    expect(parseGateRoute('retention.news')).toBeNull();
    expect(parseGateRoute(null)).toBeNull();
  });
});

describe('gateDecisions', () => {
  it('reads 100 % approval from a clean week', () => {
    const decisions = gateDecisions([], WEEK, SINCE);

    expect(decisions).toEqual({ runs: 7, blocked: 0, recovered: 0, approvalRate: 1, motives: [] });
  });

  it('has no rate without a run — zero runs is not 100 %', () => {
    expect(gateDecisions([], [], SINCE).approvalRate).toBeNull();
  });

  it('counts only closed runs inside the window in the denominator', () => {
    const runs = [
      ...WEEK,
      run('2026-09-20T11:00:00.000Z', 'RUNNING'),
      run('2026-09-01T11:00:00.000Z'),
    ];

    expect(gateDecisions([], runs, SINCE).runs).toBe(7);
  });

  it('a block that failed the day lowers the rate; a block the fallback recovered does not', () => {
    const runs = [...WEEK.slice(0, 6), run('2026-09-19T11:00:00.000Z', 'FAILED')];
    const groups = [
      group({ route: 'stage-5.5:volume', severity: 'ERROR' }),
      group({
        fingerprint: 'PIPELINE:WARN:PIPELINE_GATE_BLOCKED:stage-6.5:language',
        route: 'stage-6.5:language',
        severity: 'WARN',
        category: 'contract',
        count: 2,
      }),
    ];

    const decisions = gateDecisions(groups, runs, SINCE);

    expect(decisions.blocked).toBe(1);
    expect(decisions.recovered).toBe(2);
    expect(decisions.approvalRate).toBeCloseTo(6 / 7, 5);
    expect(decisions.motives).toEqual([
      { gate: 'exit', check: 'language', count: 2, blocked: 0 },
      { gate: 'entry', check: 'volume', count: 1, blocked: 1 },
    ]);
  });

  it('ignores groups of other codes, even on a gate stage', () => {
    const groups = [
      group({ code: 'PIPELINE_STAGE_DEGRADED', route: 'stage-6.5', severity: 'WARN' }),
      group({ code: 'PIPELINE_STAGE_FAILED', route: 'stage-6', severity: 'ERROR' }),
    ];

    expect(gateDecisions(groups, WEEK, SINCE)).toMatchObject({ blocked: 0, recovered: 0, motives: [] });
  });

  it('sums the FATAL security block as a block of the day, with the host-free motive', () => {
    const groups = [
      group({
        fingerprint: 'PIPELINE:FATAL:PIPELINE_GATE_BLOCKED:stage-6.5:unanchored-url',
        route: 'stage-6.5:unanchored-url',
        severity: 'FATAL',
        category: 'authorization',
      }),
    ];

    const decisions = gateDecisions(groups, WEEK, SINCE);

    expect(decisions.blocked).toBe(1);
    expect(decisions.motives).toEqual([{ gate: 'exit', check: 'unanchored-url', count: 1, blocked: 1 }]);
  });

  it('never goes below zero when re-triggers outnumber the runs the listing kept', () => {
    // Três re-disparos do mesmo dia bloqueado são três linhas de `count`;
    // se a listagem só trouxe um run, a taxa é 0, nunca negativa.
    const groups = [group({ count: 3 })];

    expect(gateDecisions(groups, [run('2026-09-19T11:00:00.000Z', 'FAILED')], SINCE).approvalRate).toBe(0);
  });
});

describe('gateAlerts — os dois gatilhos do §16', () => {
  it('is quiet on a clean week', () => {
    expect(gateAlerts(gateDecisions([], WEEK, SINCE))).toEqual([]);
  });

  it('alerts on any unanchored-url block, even with the rate above the trigger', () => {
    const groups = [
      group({ route: 'stage-6.5:unanchored-url', severity: 'FATAL', category: 'authorization' }),
    ];
    // 99 runs verdes e um bloqueado: 99 % de aprovação, e o alerta sai mesmo assim.
    const runs = [
      ...Array.from({ length: 99 }, (_, i) => run(`2026-09-19T${String(i % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`)),
      run('2026-09-19T23:59:00.000Z', 'FAILED'),
    ];

    expect(gateAlerts(gateDecisions(groups, runs, SINCE))).toEqual([{ kind: 'unanchored-url', count: 1 }]);
  });

  it('alerts on approval below 90 % in the window', () => {
    const runs = [...WEEK.slice(0, 5), run('2026-09-18T11:00:00.000Z', 'FAILED'), run('2026-09-19T11:00:00.000Z', 'FAILED')];
    const groups = [group({ count: 2 })];

    const alerts = gateAlerts(gateDecisions(groups, runs, SINCE));

    expect(alerts).toEqual([{ kind: 'low-approval', rate: 5 / 7 }]);
    expect(5 / 7).toBeLessThan(APPROVAL_TRIGGER);
  });

  it('does not treat a recovered quality block as a lost day', () => {
    const groups = [group({ route: 'stage-6.5:size', severity: 'WARN', count: 7 })];

    expect(gateAlerts(gateDecisions(groups, WEEK, SINCE))).toEqual([]);
  });
});
