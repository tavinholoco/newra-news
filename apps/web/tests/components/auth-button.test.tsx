import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthButton } from '@/components/auth/auth-button';
import { renderWithIntl } from '@/tests/utils';

const signInMock = vi.fn();
const signOutMock = vi.fn();
const useSessionMock = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
  signIn: () => signInMock(),
  signOut: () => signOutMock(),
}));

describe('AuthButton', () => {
  beforeEach(() => {
    signInMock.mockClear();
    signOutMock.mockClear();
  });

  it('should show the sign-in button when unauthenticated', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });
    renderWithIntl(<AuthButton />);

    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('should call signIn when clicked', async () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });
    const user = userEvent.setup();
    renderWithIntl(<AuthButton />);

    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(signInMock).toHaveBeenCalledTimes(1);
  });

  it('should show the user name and sign-out button when authenticated', () => {
    useSessionMock.mockReturnValue({
      data: {
        user: {
          name: 'Maria Silva',
          email: 'maria@test.com',
          image: null,
          id: 'user-uuid',
        },
      },
      status: 'authenticated',
    });
    renderWithIntl(<AuthButton />);

    expect(screen.getByText('Maria')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });

  it('should call signOut when the logout button is clicked', async () => {
    useSessionMock.mockReturnValue({
      data: {
        user: { name: 'Maria', email: 'maria@test.com', image: null, id: 'u' },
      },
      status: 'authenticated',
    });
    const user = userEvent.setup();
    renderWithIntl(<AuthButton />);

    await user.click(screen.getByRole('button', { name: /sair/i }));

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
