import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FavoriteButton } from '@/components/news/favorite-button';

const signInMock = vi.fn();
const useSessionMock = vi.fn();
const useIsFavoriteMock = vi.fn();
const useToggleFavoriteMock = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
  signIn: () => signInMock(),
}));

vi.mock('@/lib/queries', () => ({
  useIsFavorite: () => useIsFavoriteMock(),
  useToggleFavorite: () => useToggleFavoriteMock(),
}));

const NEWS_ID = 'uuid-1';

function mockAuthenticated(favorited: boolean) {
  useSessionMock.mockReturnValue({ data: { user: { id: 'user-1' } }, status: 'authenticated' });
  useIsFavoriteMock.mockReturnValue(favorited);
}

describe('FavoriteButton', () => {
  beforeEach(() => {
    signInMock.mockClear();
    useSessionMock.mockReset();
    useIsFavoriteMock.mockReset();
    useToggleFavoriteMock.mockReset();
    useToggleFavoriteMock.mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it('should call signIn when clicked while unauthenticated', async () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });
    useIsFavoriteMock.mockReturnValue(false);
    const user = userEvent.setup();
    render(<FavoriteButton newsId={NEWS_ID} />);

    await user.click(
      screen.getByRole('button', { name: 'Salvar nos favoritos' }),
    );

    expect(signInMock).toHaveBeenCalledTimes(1);
  });

  it('should add a favorite when clicked and not favorited', async () => {
    mockAuthenticated(false);
    const mutate = vi.fn();
    useToggleFavoriteMock.mockReturnValue({ mutate, isPending: false });
    const user = userEvent.setup();
    render(<FavoriteButton newsId={NEWS_ID} />);

    const button = screen.getByRole('button', { name: 'Salvar nos favoritos' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);

    expect(mutate).toHaveBeenCalledWith(false);
  });

  it('should remove a favorite when clicked and already favorited', async () => {
    mockAuthenticated(true);
    const mutate = vi.fn();
    useToggleFavoriteMock.mockReturnValue({ mutate, isPending: false });
    const user = userEvent.setup();
    render(<FavoriteButton newsId={NEWS_ID} />);

    const button = screen.getByRole('button', { name: 'Remover dos favoritos' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await user.click(button);

    expect(mutate).toHaveBeenCalledWith(true);
  });

  it('should disable the button while the toggle is pending', () => {
    mockAuthenticated(false);
    useToggleFavoriteMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    });
    render(<FavoriteButton newsId={NEWS_ID} />);

    expect(
      screen.getByRole('button', { name: 'Salvar nos favoritos' }),
    ).toBeDisabled();
  });
});
