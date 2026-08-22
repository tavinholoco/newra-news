import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { AccountNav } from '@/components/account/account-nav';
import { renderWithIntl } from '@/tests/utils';

const usePathnameMock = vi.fn();

vi.mock('@/i18n/navigation', async () => {
  const actual = await vi.importActual<typeof import('@/i18n/navigation')>(
    '@/i18n/navigation',
  );
  return { ...actual, usePathname: () => usePathnameMock() };
});

beforeEach(() => {
  usePathnameMock.mockReset();
});

describe('AccountNav', () => {
  it('should link the four screens of the account area', () => {
    usePathnameMock.mockReturnValue('/account');
    renderWithIntl(<AccountNav />);

    expect(screen.getByRole('link', { name: 'Conta' })).toHaveAttribute(
      'href',
      '/pt-BR/account',
    );
    expect(screen.getByRole('link', { name: 'Preferências' })).toHaveAttribute(
      'href',
      '/pt-BR/account/preferences',
    );
    expect(screen.getByRole('link', { name: 'Newsletter' })).toHaveAttribute(
      'href',
      '/pt-BR/account/newsletter',
    );
    // "Salvos" continua em /favorites: a URL veio da V1 e trocá-la pediria um
    // redirect permanente para não ganhar nada.
    expect(screen.getByRole('link', { name: 'Salvos' })).toHaveAttribute(
      'href',
      '/pt-BR/favorites',
    );
  });

  it('should mark the current screen', () => {
    usePathnameMock.mockReturnValue('/account/preferences');
    renderWithIntl(<AccountNav />);

    expect(screen.getByRole('link', { name: 'Preferências' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Conta' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('should not light up the hub on a child screen', () => {
    // Comparação por prefixo deixaria "/account" aceso em todas as telas.
    usePathnameMock.mockReturnValue('/account/newsletter');
    renderWithIntl(<AccountNav />);

    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');

    expect(current.map((link) => link.textContent)).toEqual(['Newsletter']);
  });
});
