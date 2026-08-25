import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminPanel } from '@/components/admin/admin-panel';
import { renderWithIntl } from '@/tests/utils';

const useRunPipelineMock = vi.fn();
const useDeleteNewsMock = vi.fn();
const useNewsListMock = vi.fn();

vi.mock('@/lib/queries', () => ({
  useRunPipeline: () => useRunPipelineMock(),
  useDeleteNews: () => useDeleteNewsMock(),
  useNewsList: () => useNewsListMock(),
}));

const mockNews = {
  id: 'uuid-1',
  title: 'Notícia de Teste',
  description: 'Descrição',
  content: null,
  source: 'G1',
  sourceUrl: 'https://g1.globo.com/x',
  imageUrl: null,
  category: 'TECHNOLOGY',
  publishedAt: '2024-01-01T12:00:00.000Z',
  createdAt: '2024-01-01T12:00:00.000Z',
  updatedAt: '2024-01-01T12:00:00.000Z',
};

function mockQueries(overrides: {
  run?: Partial<ReturnType<typeof useRunPipelineMock>>;
  deleteNews?: Partial<ReturnType<typeof useDeleteNewsMock>>;
  news?: Partial<ReturnType<typeof useNewsListMock>>;
} = {}) {
  useRunPipelineMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: undefined,
    ...overrides.run,
  });
  useDeleteNewsMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides.deleteNews,
  });
  useNewsListMock.mockReturnValue({
    data: {
      data: [mockNews],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    ...overrides.news,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminPanel', () => {
  it('should render the run pipeline section and the news list', () => {
    mockQueries();
    renderWithIntl(<AdminPanel />);

    expect(
      screen.getByRole('heading', { name: 'Executar pipeline' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Notícia de Teste')).toBeInTheDocument();
    expect(screen.getByText('1 notícia no total')).toBeInTheDocument();
  });

  it('should trigger the pipeline when the run button is clicked', async () => {
    const mutate = vi.fn();
    mockQueries({ run: { mutate } });
    const user = userEvent.setup();
    renderWithIntl(<AdminPanel />);

    await user.click(screen.getByRole('button', { name: 'Executar agora' }));

    expect(mutate).toHaveBeenCalledTimes(1);
  });

  /**
   * **As tres respostas eram a mesma frase verde, e uma delas mentia.**
   *
   * `triggerPipeline` e idempotente por dia: com um run de hoje ja em `SUCCESS`
   * ou `RUNNING` ele devolve o id daquele e nao dispara nada. A rota respondia
   * `200 { status: 'started' }` nos tres casos, e o painel imprimia "disparado
   * com sucesso" — foi o que aconteceu em 25/08/2026, e custou uma rodada
   * inteira de investigacao para descobrir que nada tinha rodado.
   */
  const trigger = (outcome: string) => ({
    isSuccess: true,
    data: {
      success: true,
      data: {
        outcome,
        pipelineId: 'aaaaaaaa-0000-0000-0000-000000000001',
        startedAt: '2026-08-25T11:00:00.000Z',
      },
      revalidated: outcome === 'started',
    },
  });

  it('should say it triggered only when it actually triggered', () => {
    mockQueries({ run: trigger('started') });
    renderWithIntl(<AdminPanel />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Pipeline disparado com sucesso.',
    );
  });

  it('should say the run already finished today, and when', () => {
    mockQueries({ run: trigger('already-succeeded-today') });
    renderWithIntl(<AdminPanel />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/já rodou/i);
    expect(status).toHaveTextContent(/nada foi disparado/i);
    // A hora do run referido, que e a pergunta seguinte de quem clicou.
    expect(status.textContent).toMatch(/\d{2}:\d{2}/);
    // E nao pode dizer que disparou.
    expect(status).not.toHaveTextContent('Pipeline disparado com sucesso.');
  });

  it('should say the run is still going, and when it started', () => {
    mockQueries({ run: trigger('already-running') });
    renderWithIntl(<AdminPanel />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/já está rodando/i);
    expect(status).not.toHaveTextContent('Pipeline disparado com sucesso.');
  });

  it('should fall back to the old message when the response has no outcome', () => {
    // O unico caso em que isso acontece e uma resposta que este codigo nao
    // conhece; nele, a frase antiga e a menos errada.
    mockQueries({ run: { isSuccess: true, data: { success: true } } });
    renderWithIntl(<AdminPanel />);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Pipeline disparado com sucesso.',
    );
  });

  it('should show an error message when the pipeline run fails', () => {
    mockQueries({
      run: {
        isError: true,
        error: new Error('API error: 500 Internal Server Error'),
      },
    });
    renderWithIntl(<AdminPanel />);

    expect(screen.getByRole('alert')).toHaveTextContent('API error: 500');
  });

  it('should delete the news when the trash button is clicked', async () => {
    const mutate = vi.fn();
    mockQueries({ deleteNews: { mutate } });
    const user = userEvent.setup();
    renderWithIntl(<AdminPanel />);

    await user.click(
      screen.getByRole('button', { name: 'Deletar: Notícia de Teste' }),
    );

    expect(mutate).toHaveBeenCalledWith('uuid-1');
  });

  it('should show an empty state when there are no news', () => {
    mockQueries({
      news: {
        data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
        isLoading: false,
        isError: false,
      },
    });
    renderWithIntl(<AdminPanel />);

    expect(screen.getByText('Nenhuma notícia no momento.')).toBeInTheDocument();
  });
});
