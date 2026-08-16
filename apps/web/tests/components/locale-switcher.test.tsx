import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { renderWithIntl } from '@/tests/utils';

const replaceMock = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/news',
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
  redirect: () => {},
  getPathname: () => '/news',
}));

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    replaceMock.mockClear();
  });

  it('highlights the current locale (pt-BR by default)', () => {
    renderWithIntl(<LocaleSwitcher />);

    expect(screen.getByRole('button', { name: 'PT' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('navigates to the same path in the other locale when switching', async () => {
    const user = userEvent.setup();
    renderWithIntl(<LocaleSwitcher />);

    await user.click(screen.getByRole('button', { name: 'EN' }));

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith('/news', { locale: 'en' });
  });

  it('highlights EN when rendered with the en locale', () => {
    renderWithIntl(<LocaleSwitcher />, 'en');

    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'PT' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
