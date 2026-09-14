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
  it('should link the three screens of the admin area, in the order of §4.1', () => {
    // As três abas do §4.1 do plano de observabilidade: "está tudo de pé?",
    // "como o produto vai?", "o que quebrou e quem tentou o quê?". A ordem é
    // a das perguntas, e uma quarta aba tem gatilho, não opinião.
    usePathnameMock.mockReturnValue('/admin');
    renderWithIntl(<AdminNav />);

    expect(
      screen.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['Painel', '/pt-BR/admin'],
      ['Métricas', '/pt-BR/admin/metrics'],
      ['Logs e segurança', '/pt-BR/admin/security'],
    ]);
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
