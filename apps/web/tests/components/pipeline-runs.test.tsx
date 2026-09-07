import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PipelineRunSummary } from '@newranews/types';
import { PipelineRuns } from '@/components/admin/pipeline-runs';
import { renderWithIntl } from '@/tests/utils';

/**
 * **Fase 2 — os três painéis do pipeline na `/admin`.**
 *
 * O que estas asserções guardam não é layout: é a leitura. A tela existe para
 * responder "o run de ontem falhou, em que etapa, o que o erro dizia, e ele
 * falha há três dias?" — cada uma dessas quatro tem um teste aqui, e a
 * penúltima tem duas, porque a unidade da duração é a armadilha registrada no
 * §17.8 do plano.
 */

const usePipelineRunsMock = vi.fn();
const usePipelineRunDetailMock = vi.fn();

vi.mock('@/lib/queries', () => ({
  usePipelineRuns: () => usePipelineRunsMock(),
  usePipelineRunDetail: (pipelineId: string) =>
    usePipelineRunDetailMock(pipelineId),
}));

const SUCCESS_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const FAILED_ID = 'bbbbbbbb-0000-0000-0000-000000000002';

const successRun: PipelineRunSummary = {
  id: SUCCESS_ID,
  status: 'SUCCESS',
  newsCount: 377,
  articleId: 'cccccccc-0000-0000-0000-000000000003',
  error: null,
  errorStage: null,
  errorDetail: null,
  startedAt: '2026-09-06T11:00:00.000Z',
  completedAt: '2026-09-06T11:00:45.000Z',
  durationSeconds: 45,
  eventCount: 19,
};

const failedRun: PipelineRunSummary = {
  ...successRun,
  id: FAILED_ID,
  status: 'FAILED',
  error: 'Gemini API error 503: UNAVAILABLE',
  errorStage: 6,
  errorDetail: { message: 'Gemini API error 503: UNAVAILABLE' },
  completedAt: null,
  durationSeconds: null,
};

function mockRuns(
  runs: PipelineRunSummary[],
  recentErrors: PipelineRunSummary[] = [],
  total = runs.length,
) {
  usePipelineRunsMock.mockReturnValue({
    data: { data: { runs, recentErrors }, meta: { total } },
    isError: false,
  });
}

function mockDetail(events: unknown[]) {
  usePipelineRunDetailMock.mockReturnValue({
    data: { log: failedRun, events },
    isError: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  usePipelineRunDetailMock.mockReturnValue({ data: undefined, isError: false });
});

describe('PipelineRuns — o último run', () => {
  it('shows status, failing stage and the collected count', () => {
    mockRuns([successRun]);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getAllByText('Sucesso').length).toBeGreaterThan(0);
    expect(screen.getByText('Etapa da falha')).toBeInTheDocument();
    // Run bem-sucedido não tem etapa de falha: imprimir "9" ali leria como se
    // ele tivesse parado na última etapa.
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('377')).toBeInTheDocument();
  });

  it('reads durationSeconds as seconds — the §17.8 trap', () => {
    // `formatPipelineDuration` recebe **milissegundos** e `durationSeconds` é
    // segundo: passar um pelo outro renderiza "45 ms" para um run de 45 s, sem
    // erro de tipo e sem aviso. Esta asserção é a única coisa que separa os dois.
    mockRuns([successRun]);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getAllByText('45s').length).toBeGreaterThan(0);
    expect(screen.queryByText('45ms')).not.toBeInTheDocument();
    expect(screen.queryByText('0s')).not.toBeInTheDocument();
  });

  it('shows the error message of a failed run', () => {
    mockRuns([failedRun]);
    renderWithIntl(<PipelineRuns />);

    expect(
      screen.getByText('Gemini API error 503: UNAVAILABLE'),
    ).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('renders the empty state when no run was ever recorded', () => {
    mockRuns([], [], 0);
    renderWithIntl(<PipelineRuns />);

    expect(
      screen.getByText('Nenhuma execução registrada ainda.'),
    ).toBeInTheDocument();
  });

  it('renders the failure state without touching the list', () => {
    usePipelineRunsMock.mockReturnValue({ data: undefined, isError: true });
    renderWithIntl(<PipelineRuns />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as execuções do pipeline.',
    );
  });
});

describe('PipelineRuns — "ele falha há três dias?"', () => {
  it('announces recent failures even when the latest run succeeded', () => {
    // `recentErrors` não é um recorte de `runs`: é o mesmo filtro com
    // `status: FAILED`. Sem este aviso, uma falha de anteontem fica invisível
    // atrás de um run verde — e essa é justamente a pergunta que a fase abriu
    // para responder.
    mockRuns([successRun], [failedRun], 2);
    renderWithIntl(<PipelineRuns />);

    expect(
      screen.getByText(/1 execução falhou na janela/),
    ).toBeInTheDocument();
  });

  it('says nothing when there is no failure in the window', () => {
    mockRuns([successRun], [], 1);
    renderWithIntl(<PipelineRuns />);

    expect(screen.queryByText(/falhou na janela/)).not.toBeInTheDocument();
  });
});

describe('PipelineRuns — a lista e o detalhe', () => {
  it('lists the runs with a status pill and the recorded total', () => {
    mockRuns([successRun, failedRun], [failedRun], 31);
    renderWithIntl(<PipelineRuns />);

    expect(screen.getByText('Últimas execuções')).toBeInTheDocument();
    expect(screen.getAllByText('Falhou').length).toBeGreaterThan(0);
    // O total é o do recorte, não o tamanho da lista que o `limit` cortou.
    expect(screen.getByText('31 execuções no total')).toBeInTheDocument();
  });

  it('does not ask for any run detail until a row is expanded', () => {
    // A lista mostra 20 linhas; carregar o diário das 20 seriam 20 requisições
    // para ler uma.
    mockRuns([successRun, failedRun]);
    renderWithIntl(<PipelineRuns />);

    // Nem com `enabled: false`: o hook **não é chamado**, porque a linha
    // expandida só é montada depois do clique.
    expect(usePipelineRunDetailMock).not.toHaveBeenCalled();
  });

  it('loads the events of the row that was opened, grouped by stage', async () => {
    mockRuns([failedRun]);
    mockDetail([
      {
        id: 'e1',
        stage: 1,
        level: 'INFO',
        message: 'fetched 377 items from 45 sources',
        context: null,
        createdAt: '2026-09-06T11:00:05.000Z',
      },
      {
        id: 'e2',
        stage: 6,
        level: 'ERROR',
        message: 'Gemini API error 503: UNAVAILABLE',
        context: { provider: 'gemini' },
        createdAt: '2026-09-06T11:00:40.000Z',
      },
    ]);
    renderWithIntl(<PipelineRuns />);

    const toggle = screen.getByRole('button', { name: /19 eventos/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    expect(usePipelineRunDetailMock).toHaveBeenCalledWith(FAILED_ID);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Etapa 1')).toBeInTheDocument();
    expect(screen.getByText('Etapa 6')).toBeInTheDocument();
    expect(
      screen.getByText('fetched 377 items from 45 sources'),
    ).toBeInTheDocument();
    // O `context` fica atrás de um `<details>`: é diagnóstico, e aberto por
    // padrão empurraria a mensagem — que é o que se lê — para fora da tela.
    expect(screen.getByText('Contexto')).toBeInTheDocument();
  });

  it('closes the row that was open, and stops asking for its detail', async () => {
    mockRuns([failedRun]);
    mockDetail([]);
    renderWithIntl(<PipelineRuns />);

    const toggle = screen.getByRole('button', { name: /19 eventos/ });
    await userEvent.click(toggle);
    expect(
      screen.getByText('Esta execução não registrou nenhum evento.'),
    ).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByText('Esta execução não registrou nenhum evento.'),
    ).not.toBeInTheDocument();
  });

  it('reports a detail that failed to load without hiding the row', async () => {
    mockRuns([failedRun]);
    usePipelineRunDetailMock.mockReturnValue({ data: undefined, isError: true });
    renderWithIntl(<PipelineRuns />);

    await userEvent.click(screen.getByRole('button', { name: /19 eventos/ }));

    expect(
      screen.getByText('Não foi possível carregar os eventos desta execução.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Últimas execuções')).toBeInTheDocument();
  });
});
