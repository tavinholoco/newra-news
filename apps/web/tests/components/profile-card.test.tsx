import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileCard } from '@/components/account/profile-card';
import { renderWithIntl } from '@/tests/utils';

const useAccountMock = vi.fn();
const signOutMock = vi.fn();

vi.mock('@/lib/queries', () => ({
  useAccount: () => useAccountMock(),
}));

vi.mock('next-auth/react', () => ({
  signOut: (options: unknown) => signOutMock(options),
}));

const account = {
  user: {
    id: 'user-1',
    email: 'leitor@test.com',
    name: 'Leitor Teste',
    image: null,
    role: 'USER',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  preferences: { categories: [], theme: 'SYSTEM' },
  newsletter: { subscribed: false, email: null },
  saved: { news: 4, articles: 1 },
};

beforeEach(() => {
  useAccountMock.mockReset();
  signOutMock.mockReset();
});

describe('ProfileCard', () => {
  it('should show who the reader is and how much they saved', () => {
    useAccountMock.mockReturnValue({ data: account, isLoading: false, isError: false });
    renderWithIntl(<ProfileCard />);

    expect(screen.getByText('Leitor Teste')).toBeInTheDocument();
    expect(screen.getByText('leitor@test.com')).toBeInTheDocument();
    expect(screen.getByText('Notícias salvas')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should not offer to edit the name — the provider rewrites it on every sign-in', () => {
    useAccountMock.mockReturnValue({ data: account, isLoading: false, isError: false });
    renderWithIntl(<ProfileCard />);

    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('should sign the reader out back to the home of their locale', async () => {
    useAccountMock.mockReturnValue({ data: account, isLoading: false, isError: false });
    const person = userEvent.setup();
    renderWithIntl(<ProfileCard />);

    await person.click(screen.getByRole('button', { name: 'Sair da conta' }));

    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/pt-BR' });
  });

  it('should report a failed load', () => {
    useAccountMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithIntl(<ProfileCard />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível carregar sua conta.',
    );
  });
});
