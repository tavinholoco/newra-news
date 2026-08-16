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

  it('should show a success message when the pipeline run succeeds', () => {
    mockQueries({ run: { isSuccess: true } });
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
