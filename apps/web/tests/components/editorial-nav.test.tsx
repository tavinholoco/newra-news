import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { Category } from '@newranews/types';
import { EditorialNav } from '@/components/layout/editorial-nav';
import { renderWithIntl } from '@/tests/utils';

const usePathnameMock = vi.fn();
const searchParamsMock = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParamsMock(),
}));

vi.mock('@/i18n/navigation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/i18n/navigation')>();
  return { ...actual, usePathname: () => usePathnameMock() };
});

function isActive(element: Element) {
  // Token exato: o item inativo carrega `hover:text-link`, que contém
  // `text-link` e faria um `toContain` passar nos dois estados.
  return element.className.split(/\s+/).includes('text-link');
}

describe('EditorialNav', () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue('/');
    searchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it('should list every category plus an "all" entry', () => {
    renderWithIntl(<EditorialNav />);

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(Object.values(Category).length + 1);
    expect(screen.getByRole('link', { name: 'Todas' })).toHaveAttribute(
      'href',
      '/pt-BR/news',
    );
  });

  it('should point each category at a shareable URL', () => {
    renderWithIntl(<EditorialNav />);

    expect(screen.getByRole('link', { name: 'Tecnologia' })).toHaveAttribute(
      'href',
      '/pt-BR/news?category=TECHNOLOGY',
    );
  });

  it('should localize the labels and the locale prefix', () => {
    renderWithIntl(<EditorialNav />, 'en');

    expect(screen.getByRole('link', { name: 'Technology' })).toHaveAttribute(
      'href',
      '/en/news?category=TECHNOLOGY',
    );
  });

  it('should mark the current category when on the news route', () => {
    usePathnameMock.mockReturnValue('/news');
    searchParamsMock.mockReturnValue(new URLSearchParams('category=SPORTS'));
    renderWithIntl(<EditorialNav />);

    const sports = screen.getByRole('link', { name: 'Esportes' });
    expect(isActive(sports)).toBe(true);
    expect(sports).toHaveAttribute('aria-current', 'page');
    expect(isActive(screen.getByRole('link', { name: 'Economia' }))).toBe(false);
  });

  it('should mark "all" when on the news route with no category', () => {
    usePathnameMock.mockReturnValue('/news');
    renderWithIntl(<EditorialNav />);

    expect(isActive(screen.getByRole('link', { name: 'Todas' }))).toBe(true);
  });

  it('should mark nothing outside the news route', () => {
    // A faixa aparece em todas as telas; marcar "Todas" na home diria que o
    // leitor está no acervo, o que não é verdade.
    usePathnameMock.mockReturnValue('/');
    renderWithIntl(<EditorialNav />);

    for (const link of screen.getAllByRole('link')) {
      expect(isActive(link)).toBe(false);
    }
    expect(screen.queryByRole('link', { current: 'page' })).toBeNull();
  });
});
