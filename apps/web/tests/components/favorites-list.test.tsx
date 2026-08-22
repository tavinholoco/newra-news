import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FavoritesList } from '@/components/favorites/favorites-list';
import { renderWithIntl } from '@/tests/utils';

const useFavoritesMock = vi.fn();

vi.mock('@/lib/queries', () => ({
  useFavorites: (...args: unknown[]) => useFavoritesMock(...args),
}));

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

  it('should ask only for what the reader saved, without filtering by type', () => {
    mockList([]);
    renderWithIntl(<FavoritesList />);

    expect(useFavoritesMock).toHaveBeenCalledWith();
  });
});
