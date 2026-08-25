import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { AdminNav } from '@/components/admin/admin-nav';
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

describe('AdminNav', () => {
  it('should link the two screens of the admin area', () => {
    usePathnameMock.mockReturnValue('/admin');
    renderWithIntl(<AdminNav />);

    expect(screen.getByRole('link', { name: 'Painel' })).toHaveAttribute(
      'href',
      '/pt-BR/admin',
    );
    expect(screen.getByRole('link', { name: 'Métricas' })).toHaveAttribute(
      'href',
      '/pt-BR/admin/metrics',
    );
  });

  it('should mark the current screen', () => {
    usePathnameMock.mockReturnValue('/admin/metrics');
    renderWithIntl(<AdminNav />);

    expect(screen.getByRole('link', { name: 'Métricas' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('should not light up the panel on the metrics screen', () => {
    // Comparação por prefixo deixaria "/admin" aceso nas duas abas.
    usePathnameMock.mockReturnValue('/admin/metrics');
    renderWithIntl(<AdminNav />);

    const current = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');

    expect(current.map((link) => link.textContent)).toEqual(['Métricas']);
  });

  it('should not collapse its tabs: no shadowed display utility', () => {
    // O defeito que a `/account` teve: `inline-block` está sombreado pelo token
    // `--spacing-block` e a aba mede 33 px. A guarda exaustiva é a de
    // `tests/lib/design-tokens.test.ts`; esta aqui é a do componente.
    usePathnameMock.mockReturnValue('/admin');
    renderWithIntl(<AdminNav />);

    for (const link of screen.getAllByRole('link')) {
      expect(link.className).not.toMatch(/\binline-block\b/);
      expect(link.className).toMatch(/\binline-flex\b/);
    }
  });
});
