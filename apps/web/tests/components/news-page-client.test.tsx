import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Category, type News, type PaginatedResponse } from '@newranews/types';
import { NewsPageClient } from '@/components/news/news-page-client';
import { renderWithIntl } from '@/tests/utils';

const searchParamsMock = vi.fn();
const useNewsListMock = vi.fn();
const useNewsFacetsMock = vi.fn();
const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsMock(),
}));

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/news',
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  Link: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('@/lib/queries', () => ({
  useNewsList: (...args: unknown[]) => useNewsListMock(...args),
  useNewsFacets: (...args: unknown[]) => useNewsFacetsMock(...args),
  useIsFavorite: () => false,
  useToggleFavorite: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signIn: vi.fn(),
}));

function makeNews(index: number): News {
  return {
    id: `aaaaaaaa-0000-0000-0000-00000000000${index}`,
    title: `Matéria ${index}`,
    description: 'Resumo da matéria de teste.',
    content: null,
    source: 'G1',
    sourceUrl: 'https://g1.globo.com/teste',
    imageUrl: null,
    category: Category.SPORTS,
    publishedAt: '2024-01-01T12:00:00.000Z',
    createdAt: '2024-01-01T12:00:00.000Z',
    updatedAt: '2024-01-01T12:00:00.000Z',
  };
}

const emptyList: PaginatedResponse<News> = {
  data: [],
  meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
};

function listOf(count: number, totalPages = 1): PaginatedResponse<News> {
  return {
    data: Array.from({ length: count }, (_, i) => makeNews(i + 1)),
    meta: { total: count, page: 1, limit: 20, totalPages },
  };
}

/** Argumentos com que o hook de listagem foi chamado na última renderização. */
function lastQuery() {
  const calls = useNewsListMock.mock.calls;
  return calls[calls.length - 1]?.[0] as {
    category?: string;
    search?: string;
    source?: string;
    from?: string;
    sort?: string;
    page: number;
  };
}

/** A URL escrita na última navegação, por `push` ou por `replace`. */
function lastUrl(): string | undefined {
  const calls = [...pushMock.mock.calls, ...replaceMock.mock.calls];
  return calls[calls.length - 1]?.[0] as string | undefined;
}

function setUrl(query: string) {
  searchParamsMock.mockReturnValue(new URLSearchParams(query));
}

describe('NewsPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNewsListMock.mockReturnValue({
      data: emptyList,
      isFetching: false,
      isError: false,
    });
    useNewsFacetsMock.mockReturnValue({
      data: { categories: [{ category: 'SPORTS', count: 5 }], sources: [] },
    });
    setUrl('');
  });

  describe('lendo a URL', () => {
    it('should seed every filter dimension from the URL', () => {
      setUrl('category=SPORTS&search=copa&source=G1&sort=oldest&page=3');
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      expect(lastQuery()).toMatchObject({
        category: 'SPORTS',
        search: 'copa',
        source: 'G1',
        sort: 'oldest',
        page: 3,
      });
    });

    it('should ignore a category that is not a real one', () => {
      setUrl('category=BANANA');
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      expect(lastQuery().category).toBeUndefined();
    });

    it('should follow the URL when the category changes without a remount', () => {
      // Clicar na faixa do masthead é navegação client-side dentro da mesma
      // rota: o componente NÃO remonta.
      setUrl('category=SPORTS');
      const { rerender } = renderWithIntl(
        <NewsPageClient initialData={emptyList} />,
      );
      expect(lastQuery().category).toBe('SPORTS');

      setUrl('category=ECONOMY');
      rerender(<NewsPageClient initialData={emptyList} />);

      expect(lastQuery().category).toBe('ECONOMY');
    });

    it('should turn the period label into a from date', () => {
      setUrl('period=today');
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      expect(lastQuery().from).toMatch(/T00:00:00\.000Z$/);
    });

    it('should title the page after the selected category', () => {
      setUrl('category=SPORTS');
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      expect(
        screen.getByRole('heading', { level: 1, name: 'Esportes' }),
      ).toBeInTheDocument();
    });

    it('should title the page after the archive when nothing is selected', () => {
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      expect(
        screen.getByRole('heading', { level: 1, name: 'Acervo' }),
      ).toBeInTheDocument();
    });
  });

  describe('escrevendo a URL', () => {
    it('should push the category into the URL when a chip is clicked', () => {
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      fireEvent.click(screen.getByRole('button', { name: /Esportes/ }));

      expect(pushMock).toHaveBeenCalled();
      expect(lastUrl()).toBe('/news?category=SPORTS');
    });

    it('should drop the query string entirely when going back to all', () => {
      // `/news` limpa tem de ser `/news`: é a URL que a editorial-nav aponta.
      setUrl('category=SPORTS');
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      fireEvent.click(screen.getByRole('button', { name: /Todas/ }));

      expect(lastUrl()).toBe('/news');
    });

    it('should reset the page when a filter changes', () => {
      // Ficar na página 7 de uma busca que agora tem duas devolve uma tela
      // vazia que parece defeito.
      setUrl('page=7');
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      fireEvent.click(screen.getByRole('button', { name: /Esportes/ }));

      expect(lastUrl()).toBe('/news?category=SPORTS');
    });

    it('should keep the sort when clearing the filters', () => {
      setUrl('category=SPORTS&sort=oldest');
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      fireEvent.click(screen.getByRole('button', { name: /Limpar filtros/ }));

      expect(lastUrl()).toBe('/news?sort=oldest');
    });

    it('should never navigate on the first render', () => {
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      expect(pushMock).not.toHaveBeenCalled();
      expect(replaceMock).not.toHaveBeenCalled();
    });
  });

  describe('resultado', () => {
    it('should seed the list from the server only on the pristine view', () => {
      renderWithIntl(<NewsPageClient initialData={emptyList} />);
      expect(useNewsListMock.mock.calls[0]![1]).toBe(emptyList);

      vi.clearAllMocks();
      useNewsListMock.mockReturnValue({
        data: emptyList,
        isFetching: false,
        isError: false,
      });
      useNewsFacetsMock.mockReturnValue({ data: undefined });
      setUrl('category=SPORTS');
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      expect(useNewsListMock.mock.calls[0]![1]).toBeUndefined();
    });

    it('should announce how many stories the filters returned', () => {
      useNewsListMock.mockReturnValue({
        data: listOf(3),
        isFetching: false,
        isError: false,
      });
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      expect(screen.getByText('3 notícias')).toBeInTheDocument();
    });

    it('should show the search-specific empty state with the failed term', () => {
      setUrl('search=zzzz');
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      expect(screen.getByText(/Nada encontrado para/)).toHaveTextContent('zzzz');
    });

    it('should say the archive is empty when nothing is filtered', () => {
      // Sem filtro e sem matéria, "limpar filtros" mandaria o leitor limpar o
      // que já está limpo.
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      expect(screen.getByText(/acervo ainda está vazio/)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Ver o acervo inteiro/ }),
      ).not.toBeInTheDocument();
    });

    it('should show the error state when the list fails', () => {
      useNewsListMock.mockReturnValue({
        data: undefined,
        isFetching: false,
        isError: true,
      });
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      expect(screen.getByText(/não foi possível carregar/i)).toBeInTheDocument();
    });

    it('should open with a lead story on the pristine first page', () => {
      useNewsListMock.mockReturnValue({
        data: listOf(6),
        isFetching: false,
        isError: false,
      });
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      expect(
        screen.getByRole('heading', { level: 2, name: 'Matéria 1' }),
      ).toBeInTheDocument();
    });

    it('should not elect a lead inside a search result', () => {
      setUrl('search=copa');
      useNewsListMock.mockReturnValue({
        data: listOf(6),
        isFetching: false,
        isError: false,
      });
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      expect(
        screen.queryByRole('heading', { level: 2, name: 'Matéria 1' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 3, name: 'Matéria 1' }),
      ).toBeInTheDocument();
    });

    it('should keep the heading order h1 → h2 → h3', () => {
      // O `h3` sem `h2` antes era o defeito registrado na ficha da tela.
      useNewsListMock.mockReturnValue({
        data: listOf(6),
        isFetching: false,
        isError: false,
      });
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      const levels = screen
        .getAllByRole('heading')
        .map((node) => Number(node.tagName.slice(1)));

      expect(levels[0]).toBe(1);
      for (let i = 1; i < levels.length; i += 1) {
        expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('paginação', () => {
    it('should push the page into the URL', () => {
      useNewsListMock.mockReturnValue({
        data: { ...listOf(20), meta: { total: 60, page: 1, limit: 20, totalPages: 3 } },
        isFetching: false,
        isError: false,
      });
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      fireEvent.click(screen.getByRole('button', { name: /Ir para a página 2/ }));

      expect(lastUrl()).toBe('/news?page=2');
    });

    it('should not render pagination for a single page', () => {
      useNewsListMock.mockReturnValue({
        data: listOf(3),
        isFetching: false,
        isError: false,
      });
      renderWithIntl(<NewsPageClient initialData={emptyList} />);

      expect(
        screen.queryByRole('navigation', { name: /Paginação/ }),
      ).not.toBeInTheDocument();
    });
  });
});
