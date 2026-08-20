import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import type { News, PaginatedResponse } from '@newranews/types';
import { NewsPageClient } from '@/components/news/news-page-client';
import { renderWithIntl } from '@/tests/utils';

const searchParamsMock = vi.fn();
const useNewsListMock = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsMock(),
}));

vi.mock('@/lib/queries', () => ({
  useNewsList: (...args: unknown[]) => useNewsListMock(...args),
  useIsFavorite: () => false,
  useToggleFavorite: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signIn: vi.fn(),
}));

const initialData: PaginatedResponse<News> = {
  data: [],
  meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
};

/** Argumentos com que o hook de listagem foi chamado na última renderização. */
function lastQuery() {
  const calls = useNewsListMock.mock.calls;
  return calls[calls.length - 1]?.[0] as { category?: string; search?: string };
}

describe('NewsPageClient', () => {
  beforeEach(() => {
    useNewsListMock.mockReset();
    useNewsListMock.mockReturnValue({
      data: initialData,
      isFetching: false,
      isError: false,
    });
    searchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it('should seed the category filter from the URL', () => {
    searchParamsMock.mockReturnValue(new URLSearchParams('category=SPORTS'));
    renderWithIntl(<NewsPageClient initialData={initialData} />);

    expect(lastQuery().category).toBe('SPORTS');
  });

  it('should seed the search term from the URL', () => {
    searchParamsMock.mockReturnValue(new URLSearchParams('search=bolsa'));
    renderWithIntl(<NewsPageClient initialData={initialData} />);

    expect(lastQuery().search).toBe('bolsa');
  });

  it('should ignore a category that is not a real one', () => {
    searchParamsMock.mockReturnValue(new URLSearchParams('category=BANANA'));
    renderWithIntl(<NewsPageClient initialData={initialData} />);

    expect(lastQuery().category).toBeUndefined();
  });

  it('should follow the URL when the category changes without a remount', () => {
    // Clicar na faixa de categorias do masthead é navegação client-side dentro
    // da mesma rota: o componente NÃO remonta, então um `useState(inicial)`
    // sozinho mantém o filtro velho e a URL passa a mentir sobre a lista.
    searchParamsMock.mockReturnValue(new URLSearchParams('category=SPORTS'));
    const { rerender } = renderWithIntl(
      <NewsPageClient initialData={initialData} />,
    );
    expect(lastQuery().category).toBe('SPORTS');

    searchParamsMock.mockReturnValue(new URLSearchParams('category=ECONOMY'));
    rerender(<NewsPageClient initialData={initialData} />);

    expect(lastQuery().category).toBe('ECONOMY');
  });

  it('should follow the URL back to no category at all', () => {
    searchParamsMock.mockReturnValue(new URLSearchParams('category=SPORTS'));
    const { rerender } = renderWithIntl(
      <NewsPageClient initialData={initialData} />,
    );

    searchParamsMock.mockReturnValue(new URLSearchParams());
    rerender(<NewsPageClient initialData={initialData} />);

    expect(lastQuery().category).toBeUndefined();
  });

  it('should show the error state when the list fails', () => {
    useNewsListMock.mockReturnValue({
      data: undefined,
      isFetching: false,
      isError: true,
    });
    renderWithIntl(<NewsPageClient initialData={initialData} />);

    expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument();
  });
});
