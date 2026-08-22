import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FavoritesList } from '@/components/favorites/favorites-list';
import { renderWithIntl } from '@/tests/utils';

const useFavoritesMock = vi.fn();
const searchParamsMock = vi.fn();
const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('@/lib/queries', () => ({
  useFavorites: (...args: unknown[]) => useFavoritesMock(...args),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsMock(),
}));

// `Link` continua o de verdade — é ele que põe o prefixo de locale no href, e
// é isso que os testes de destino conferem.
vi.mock('@/i18n/navigation', async () => {
  const actual = await vi.importActual<typeof import('@/i18n/navigation')>(
    '@/i18n/navigation',
  );
  return {
    ...actual,
    usePathname: () => '/favorites',
    useRouter: () => ({ push: pushMock, replace: replaceMock }),
  };
});

// O `SaveButton` de cada linha depende de sessão e dos ids salvos — o que
// interessa aqui é a lista, não o botão (que tem suíte própria).
vi.mock('@/components/editorial/save-button', () => ({
  SaveButton: () => null,
}));

const savedNews = {
  id: 'fav-1',
  itemType: 'NEWS',
  itemId: 'uuid-1',
  createdAt: '2024-01-02T08:00:00.000Z',
  news: {
    id: 'uuid-1',
    title: 'Notícia Salva',
    description: 'Descrição da notícia salva.',
    content: null,
    source: 'G1',
    sourceUrl: 'https://g1.globo.com/x',
    imageUrl: null,
    category: 'TECHNOLOGY',
    publishedAt: '2024-01-01T12:00:00.000Z',
    createdAt: '2024-01-01T12:00:00.000Z',
    updatedAt: '2024-01-01T12:00:00.000Z',
  },
};

const savedBriefing = {
  id: 'fav-2',
  itemType: 'ARTICLE',
  itemId: 'uuid-2',
  createdAt: '2024-01-03T08:00:00.000Z',
  article: {
    id: 'uuid-2',
    title: 'Briefing Salvo',
    summary: 'Resumo do briefing.',
    date: '2024-01-03T00:00:00.000Z',
    newsCount: 15,
  },
};

function mockList(data: unknown[]) {
  useFavoritesMock.mockReturnValue({
    data: {
      data,
      meta: { total: data.length, page: 1, limit: 100, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
  });
}

beforeEach(() => {
  useFavoritesMock.mockReset();
  pushMock.mockReset();
  replaceMock.mockReset();
  searchParamsMock.mockReturnValue(new URLSearchParams(''));
});

describe('FavoritesList', () => {
  it('should show skeletons while loading without data', () => {
    useFavoritesMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithIntl(<FavoritesList />);

    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('should show an error state with retry when the request fails', async () => {
    const refetch = vi.fn();
    useFavoritesMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    const user = userEvent.setup();
    renderWithIntl(<FavoritesList />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o que você salvou.',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('should show an empty state when nothing was saved', () => {
    mockList([]);
    renderWithIntl(<FavoritesList />);

    expect(screen.getByText(/ainda não salvou nada/i)).toBeInTheDocument();
  });

  it('should render news and briefings in a single list', () => {
    mockList([savedBriefing, savedNews]);
    renderWithIntl(<FavoritesList />);

    const headings = screen.getAllByRole('heading', { level: 2 });
    // A ordem é a que a API devolveu — quando o leitor salvou —, e não uma
    // reordenação por tipo: a lista é uma só de propósito.
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Briefing Salvo',
      'Notícia Salva',
    ]);
  });

  it('should send each type to its own screen', () => {
    mockList([savedNews, savedBriefing]);
    renderWithIntl(<FavoritesList />);

    expect(screen.getByRole('link', { name: /Notícia Salva/ })).toHaveAttribute(
      'href',
      '/pt-BR/news/uuid-1',
    );
    // O briefing vai para a data, não para o id — `/article/[date]`.
    expect(screen.getByRole('link', { name: /Briefing Salvo/ })).toHaveAttribute(
      'href',
      '/pt-BR/article/2024-01-03',
    );
  });

  it('should ask for every type, and for the page in the URL', () => {
    searchParamsMock.mockReturnValue(new URLSearchParams('page=2'));
    mockList([savedNews]);
    renderWithIntl(<FavoritesList />);

    // Sem `type`: a lista é uma só. Com paginação: a conta anuncia o total, e
    // uma tela que mostrasse só os 100 primeiros mentiria sobre o resto.
    expect(useFavoritesMock).toHaveBeenCalledWith({}, { page: 2, limit: 20 });
  });

  it('should fall back to the first page on a bogus ?page=', () => {
    searchParamsMock.mockReturnValue(new URLSearchParams('page=banana'));
    mockList([savedNews]);
    renderWithIntl(<FavoritesList />);

    expect(useFavoritesMock).toHaveBeenCalledWith({}, { page: 1, limit: 20 });
  });

  it('should leave an emptied inner page instead of saying nothing was saved', () => {
    // Tirar o último item da página 3 deixaria o leitor olhando para "você não
    // salvou nada" com dezenas de itens salvos.
    searchParamsMock.mockReturnValue(new URLSearchParams('page=3'));
    useFavoritesMock.mockReturnValue({
      data: { data: [], meta: { total: 40, page: 3, limit: 20, totalPages: 2 } },
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<FavoritesList />);

    expect(replaceMock).toHaveBeenCalledWith('/favorites', { scroll: false });
  });
});
