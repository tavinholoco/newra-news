import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Navbar } from '@/components/layout/navbar';
import { NAV_LINKS } from '@/lib/constants';
import { renderWithIntl } from '@/tests/utils';

const useSessionMock = vi.fn();
const usePathnameMock = vi.fn();

vi.mock('next-auth/react', () => ({
  useSession: () => useSessionMock(),
}));

vi.mock('@/i18n/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/i18n/navigation')>();
  return { ...actual, usePathname: () => usePathnameMock() };
});

/** Só os links de desktop têm a classe de ativo que este teste inspeciona. */
function desktopLink(name: RegExp) {
  return screen.getAllByRole('link', { name })[0]!;
}

/**
 * Token exato, não substring: o link inativo carrega `hover:text-link`, que
 * contém `text-link` e faria um `toContain` passar nos dois estados.
 */
function isActive(element: Element) {
  return element.className.split(/\s+/).includes('text-link');
}

describe('Navbar', () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue('/');
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });
  });

  it('should not offer the metrics page to anonymous visitors', () => {
    renderWithIntl(<Navbar links={NAV_LINKS} />);

    expect(screen.queryByRole('link', { name: /métricas/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull();
  });

  it('should not offer the metrics page to a signed-in non-admin', () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: 'u1', role: 'USER' } },
      status: 'authenticated',
    });
    renderWithIntl(<Navbar links={NAV_LINKS} />);

    expect(screen.queryByRole('link', { name: /métricas/i })).toBeNull();
    expect(screen.getByRole('link', { name: /favoritos/i })).toBeInTheDocument();
  });

  it('should offer admin and metrics to an ADMIN', () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: 'u1', role: 'ADMIN' } },
      status: 'authenticated',
    });
    renderWithIntl(<Navbar links={NAV_LINKS} />);

    expect(desktopLink(/^admin$/i)).toHaveAttribute('href', '/pt-BR/admin');
    expect(desktopLink(/métricas/i)).toHaveAttribute(
      'href',
      '/pt-BR/admin/metrics',
    );
  });

  it('should mark only the deepest match as active', () => {
    // `startsWith` sozinho marcaria /admin e /admin/metrics ao mesmo tempo
    // quando os dois estão no menu.
    useSessionMock.mockReturnValue({
      data: { user: { id: 'u1', role: 'ADMIN' } },
      status: 'authenticated',
    });
    usePathnameMock.mockReturnValue('/admin/metrics');
    renderWithIntl(<Navbar links={NAV_LINKS} />);

    expect(isActive(desktopLink(/métricas/i))).toBe(true);
    expect(isActive(desktopLink(/^admin$/i))).toBe(false);
  });

  it('should keep a parent section active on its detail routes', () => {
    usePathnameMock.mockReturnValue('/article/2026-08-20');
    renderWithIntl(<Navbar links={NAV_LINKS} />);

    expect(isActive(desktopLink(/artigos/i))).toBe(true);
    expect(isActive(desktopLink(/início|home/i))).toBe(false);
  });

  it('should not mark home active on every route', () => {
    usePathnameMock.mockReturnValue('/news');
    renderWithIntl(<Navbar links={NAV_LINKS} />);

    expect(isActive(desktopLink(/notícias/i))).toBe(true);
    expect(isActive(desktopLink(/início|home/i))).toBe(false);
  });
});
