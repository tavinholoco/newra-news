import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import type { ErrorGroup, ErrorSummary, PipelineRunSummary, PipelineRunsResponse } from '@newranews/types';
import { renderWithIntl } from '@/tests/utils';
import { emptyErrorSummary } from '@/tests/fixtures/observability';

const { useErrorSummary, usePipelineRuns } = vi.hoisted(() => ({
  useErrorSummary: vi.fn(),
  usePipelineRuns: vi.fn(),
}));

vi.mock('@/lib/queries', () => ({ useErrorSummary, usePipelineRuns }));

const { GatesPanel } = await import('@/components/admin/gates-panel');

/**
 * **O painel "Portões" — Fase 9, §13.3.** A derivação está em
 * `tests/lib/gate-decisions.test.ts`; aqui o que se mede é a tela: a janela
 * pedida, os quatro cartões, a rosquinha de motivos com os rótulos por
 * extenso, os dois alertas do §16 e os estados de carga e de falha.
 */

const since = '2026-09-13T00:00:00.000Z';

function run(startedAt: string, status: PipelineRunSummary['status'] = 'SUCCESS'): PipelineRunSummary {
  return {
    id: `run-${startedAt}`,
    status,
    startedAt,
    newsCount: 377,
    articleId: null,
    error: null,
    errorStage: null,
    errorDetail: null,
    completedAt: startedAt,
    durationSeconds: 45,
    eventCount: 19,
    outcome: status === 'RUNNING' ? null : status,
    degradedBy: [],
  };
}

function gateGroup(route: string, severity: ErrorGroup['severity'], count = 1): ErrorGroup {
  return {
    fingerprint: `PIPELINE:${severity}:PIPELINE_GATE_BLOCKED:${route}`,
    origin: 'PIPELINE',
    severity,
    code: 'PIPELINE_GATE_BLOCKED',
    category: 'contract',
    route,
    statusCode: null,
    message: 'blocked',
    count,
    hours: 1,
    firstSeenAt: '2026-09-18T11:00:00.000Z',
    lastSeenAt: '2026-09-18T11:00:00.000Z',
    lastRequestId: null,
    pipelineLogId: null,
  };
}

const week = [13, 14, 15, 16, 17, 18, 19].map((day) => run(`2026-09-${day}T11:00:00.000Z`));

function mock({
  groups = [],
  runs = week,
  errorsState = {},
  runsState = {},
}: {
  groups?: ErrorGroup[];
  runs?: PipelineRunSummary[];
  errorsState?: Partial<{ data: ErrorSummary | undefined; isError: boolean }>;
  runsState?: Partial<{ data: PipelineRunsResponse | undefined; isError: boolean }>;
} = {}) {
  useErrorSummary.mockReturnValue({
    data: { ...emptyErrorSummary, window: { ...emptyErrorSummary.window, key: '7d', hours: 168, since }, groups },
    isError: false,
    ...errorsState,
  });
  usePipelineRuns.mockReturnValue({
    data: { data: { runs, recentErrors: [] }, meta: { total: runs.length } },
    isError: false,
    ...runsState,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mock();
});

describe('GatesPanel', () => {
  it('always asks for the 7-day window — the one of the §16 trigger', () => {
    renderWithIntl(<GatesPanel />);

    expect(useErrorSummary).toHaveBeenCalledWith('7d');
    expect(usePipelineRuns).toHaveBeenCalled();
  });

  it('reads 100 % over a clean week, with the donut empty and no alert', () => {
    renderWithIntl(<GatesPanel />);

    expect(screen.getByText('Aprovação (7 d)')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Runs na janela').nextSibling).toHaveTextContent('7');
    expect(screen.getByText('Nenhum bloqueio nos últimos 7 dias.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('draws a dash, never 100 %, when the window has no run', () => {
    mock({ runs: [] });
    renderWithIntl(<GatesPanel />);

    expect(screen.getByText('Aprovação (7 d)').nextSibling).toHaveTextContent('—');
  });

  it('names the motives in full and separates the blocked days from the recovered ones', () => {
    mock({
      groups: [
        gateGroup('stage-5.5:volume', 'ERROR'),
        gateGroup('stage-6.5:language', 'WARN', 2),
      ],
      runs: [...week.slice(0, 6), run('2026-09-19T11:00:00.000Z', 'FAILED')],
    });
    renderWithIntl(<GatesPanel />);

    expect(screen.getByText('86%')).toBeInTheDocument();
    expect(screen.getByText('Dias bloqueados').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('Recuperados').nextSibling).toHaveTextContent('2');

    const donut = screen.getByRole('img', { name: 'Motivos' });
    const labels = [...(donut.parentElement?.querySelectorAll('ul li span:nth-child(2)') ?? [])].map(
      (span) => span.textContent,
    );
    expect(labels).toEqual(['Fora do português', 'Volume abaixo de 30 % da mediana']);
  });

  it('alerts on the unanchored URL — the one-off event — in the danger tone', () => {
    mock({
      groups: [gateGroup('stage-6.5:unanchored-url', 'FATAL')],
      runs: [...week.slice(0, 6), run('2026-09-19T11:00:00.000Z', 'FAILED')],
    });
    renderWithIntl(<GatesPanel />);

    const alerts = screen.getByRole('status', { name: 'Alertas dos portões' });
    expect(alerts).toHaveTextContent('1 bloqueio por URL não ancorada nos últimos 7 dias');
    expect(alerts.querySelector('li')).toHaveClass('text-danger');
  });

  it('alerts on approval below 90 %', () => {
    mock({
      groups: [gateGroup('stage-5.5:freshness', 'ERROR', 2)],
      runs: [...week.slice(0, 5), run('2026-09-18T11:00:00.000Z', 'FAILED'), run('2026-09-19T11:00:00.000Z', 'FAILED')],
    });
    renderWithIntl(<GatesPanel />);

    expect(screen.getByRole('status')).toHaveTextContent('Taxa de aprovação em 71% nos últimos 7 dias, abaixo de 90 %');
  });

  it('draws the skeleton while either query loads, and its own alert when one fails', () => {
    mock({ runsState: { data: undefined } });
    const { unmount, container } = renderWithIntl(<GatesPanel />);
    expect(container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length).toBeGreaterThan(0);
    unmount();

    mock({ errorsState: { data: undefined, isError: true } });
    renderWithIntl(<GatesPanel />);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar as decisões dos portões.');
  });
});
