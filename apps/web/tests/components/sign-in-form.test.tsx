import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignInForm } from '@/components/auth/sign-in-form';
import { renderWithIntl } from '@/tests/utils';

const signInMock = vi.fn();

vi.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => signInMock(...args),
}));

describe('SignInForm', () => {
  beforeEach(() => {
    signInMock.mockClear();
  });

  it('should render the Google and GitHub buttons plus the back link', () => {
    renderWithIntl(<SignInForm callbackUrl='/pt-BR/admin' />);

    expect(
      screen.getByRole('button', { name: 'Continuar com Google' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Continuar com GitHub' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Voltar para a Home' }),
    ).toBeInTheDocument();
  });

  it('should call signIn with google and the callbackUrl', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SignInForm callbackUrl='/pt-BR/admin' />);

    await user.click(
      screen.getByRole('button', { name: 'Continuar com Google' }),
    );

    expect(signInMock).toHaveBeenCalledWith('google', {
      callbackUrl: '/pt-BR/admin',
    });
  });

  it('should call signIn with github and the callbackUrl', async () => {
    const user = userEvent.setup();
    renderWithIntl(<SignInForm callbackUrl='/pt-BR/admin' />);

    await user.click(
      screen.getByRole('button', { name: 'Continuar com GitHub' }),
    );

    expect(signInMock).toHaveBeenCalledWith('github', {
      callbackUrl: '/pt-BR/admin',
    });
  });
});
