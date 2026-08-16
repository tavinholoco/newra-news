import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FavoritesList } from '@/components/favorites/favorites-list';
import { renderWithIntl } from '@/tests/utils';

const useFavoritesMock = vi.fn();

vi.mock('@/lib/queries', () => ({
  useFavorites: () => useFavoritesMock(),
}));

// NewsCard renderiza o FavoriteButton (useSession + useIsFavorite)
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: 'user-1' } }, status: 'authenticated' }),
  signIn: vi.fn(),
}));

vi.mock('@/components/news/favorite-button', () => ({
  FavoriteButton: () => null,
}));

const favorite = {
  id: 'fav-1',
  newsId: 'uuid-1',
  createdAt: '2024-01-02T08:00:00.000Z',
  news: {
    id: 'uuid-1',
    title: 'Notícia Favorita',
    description: 'Descrição da notícia favorita.',
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
      'Não foi possível carregar seus favoritos.',
    );
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('should show an empty state when there are no favorites', () => {
    useFavoritesMock.mockReturnValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } },
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<FavoritesList />);

    expect(screen.getByText(/ainda não favoritou nenhuma notícia/i)).toBeInTheDocument();
  });

  it('should render the favorited news cards', () => {
    useFavoritesMock.mockReturnValue({
      data: {
        data: [favorite],
        meta: { total: 1, page: 1, limit: 100, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
    });
    renderWithIntl(<FavoritesList />);

    expect(screen.getByText('Notícia Favorita')).toBeInTheDocument();
  });
});
