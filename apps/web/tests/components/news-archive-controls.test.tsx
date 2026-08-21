import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import type { NewsFacets } from '@newranews/types';
import { CategoryNav } from '@/components/news/category-nav';
import { NewsFilterBar } from '@/components/news/news-filter-bar';
import {
  NewsPagination,
  paginationRange,
} from '@/components/news/news-pagination';
import { HighlightTerm } from '@/components/editorial/highlight-term';
import { renderWithIntl } from '@/tests/utils';

const facets: NewsFacets = {
  total: 48,
  categories: [
    { category: 'SPORTS', count: 21 },
    { category: 'WORLD', count: 9 },
  ],
  sources: [
    { source: 'G1', count: 30 },
    { source: 'Agência Brasil', count: 18 },
  ],
};

describe('CategoryNav', () => {
  it('should show the count next to each category', () => {
    renderWithIntl(
      <CategoryNav selected={null} facets={facets} onChange={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /Esportes/ })).toHaveTextContent(
      '21',
    );
  });

  it('should show zero for a category with no story in the current slice', () => {
    // Zero é informação: diz que trocar para lá não adianta. Omitir o número
    // faria a categoria parecer não medida.
    renderWithIntl(
      <CategoryNav selected={null} facets={facets} onChange={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /Saúde/ })).toHaveTextContent('0');
  });

  it('should put the total on the "all" chip', () => {
    renderWithIntl(
      <CategoryNav selected={null} facets={facets} onChange={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /Todas/ })).toHaveTextContent('48');
  });

  it('should render without counts while the facets have not arrived', () => {
    renderWithIntl(<CategoryNav selected={null} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Todas/ })).toHaveTextContent(
      'Todas',
    );
    expect(screen.getByRole('button', { name: /Esportes/ })).toBeInTheDocument();
  });

  it('should mark the selected category as pressed', () => {
    renderWithIntl(
      <CategoryNav selected={'SPORTS' as never} facets={facets} onChange={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /Esportes/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Todas/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('should report null when "all" is picked', () => {
    const onChange = vi.fn();
    renderWithIntl(
      <CategoryNav selected={'SPORTS' as never} facets={facets} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Todas/ }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe('NewsFilterBar', () => {
  const base = {
    source: null,
    period: 'all' as const,
    sort: 'recent' as const,
    activeFilters: 0,
    onChange: vi.fn(),
    onClear: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('should list the sources from the facets, with their counts', () => {
    renderWithIntl(<NewsFilterBar {...base} facets={facets} />);

    expect(screen.getByRole('combobox', { name: 'Fonte' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'G1 (30)' })).toBeInTheDocument();
  });

  it('should hide the source picker when there is only one source', () => {
    // Um seletor de item único é decoração que ocupa uma coluna.
    renderWithIntl(
      <NewsFilterBar
        {...base}
        facets={{ ...facets, sources: [{ source: 'G1', count: 30 }] }}
      />,
    );

    expect(
      screen.queryByRole('combobox', { name: 'Fonte' }),
    ).not.toBeInTheDocument();
  });

  it('should report a cleared source as null, not an empty string', () => {
    const onChange = vi.fn();
    renderWithIntl(
      <NewsFilterBar {...base} source='G1' facets={facets} onChange={onChange} />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Fonte' }), {
      target: { value: '' },
    });

    expect(onChange).toHaveBeenCalledWith({ source: null });
  });

  it('should only offer to clear when something is filtered', () => {
    const { rerender } = renderWithIntl(
      <NewsFilterBar {...base} facets={facets} />,
    );
    expect(
      screen.queryByRole('button', { name: /Limpar filtros/ }),
    ).not.toBeInTheDocument();

    rerender(<NewsFilterBar {...base} facets={facets} activeFilters={2} />);
    expect(
      screen.getByRole('button', { name: /Limpar filtros/ }),
    ).toBeInTheDocument();
  });
});

describe('paginationRange', () => {
  it('should list every page while they still fit', () => {
    expect(paginationRange(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('should always keep the first and the last page reachable', () => {
    const range = paginationRange(50, 180);
    expect(range[0]).toBe(1);
    expect(range[range.length - 1]).toBe(180);
  });

  it('should cut with an ellipsis on both sides of a middle page', () => {
    expect(paginationRange(50, 180)).toEqual([1, null, 49, 50, 51, null, 180]);
  });

  it('should spell out a gap of exactly one page instead of hiding it', () => {
    // "1 … 3" esconderia a página 2 atrás de um símbolo mais largo que ela.
    expect(paginationRange(3, 9)).toEqual([1, 2, 3, 4, null, 9]);
  });

  it('should never repeat a page', () => {
    const range = paginationRange(2, 3).filter((v): v is number => v !== null);
    expect(new Set(range).size).toBe(range.length);
  });
});

describe('NewsPagination', () => {
  it('should render nothing for a single page', () => {
    const { container } = renderWithIntl(
      <NewsPagination page={1} totalPages={1} onChange={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('should mark the current page for assistive tech', () => {
    renderWithIntl(
      <NewsPagination page={2} totalPages={4} onChange={vi.fn()} />,
    );

    expect(
      screen.getByRole('button', { name: /página atual/ }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('should disable the arrows at the ends', () => {
    const { rerender } = renderWithIntl(
      <NewsPagination page={1} totalPages={4} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    rerender(<NewsPagination page={4} totalPages={4} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  });
});

describe('HighlightTerm', () => {
  it('should return the text untouched when there is no term', () => {
    const { container } = renderWithIntl(
      <HighlightTerm text='Copa do mundo' term='' />,
    );

    expect(container.querySelector('mark')).toBeNull();
    expect(container).toHaveTextContent('Copa do mundo');
  });

  it('should mark every occurrence, ignoring case', () => {
    const { container } = renderWithIntl(
      <HighlightTerm text='Copa: a copa começou' term='copa' />,
    );

    const marks = [...container.querySelectorAll('mark')];
    expect(marks).toHaveLength(2);
    expect(marks[0]).toHaveTextContent('Copa');
    expect(marks[1]).toHaveTextContent('copa');
  });

  it('should keep the original casing of the matched text', () => {
    const { container } = renderWithIntl(
      <HighlightTerm text='NASA lança sonda' term='nasa' />,
    );

    expect(container.querySelector('mark')).toHaveTextContent('NASA');
  });

  it('should treat regex characters as literal text', () => {
    // `C++` como regex é um quantificador inválido — sem escape, isto lança.
    const { container } = renderWithIntl(
      <HighlightTerm text='Curso de C++ para iniciantes' term='C++' />,
    );

    expect(container.querySelector('mark')).toHaveTextContent('C++');
  });

  it('should leave the text alone when the term does not occur', () => {
    const { container } = renderWithIntl(
      <HighlightTerm text='Copa do mundo' term='xyz' />,
    );

    expect(container.querySelector('mark')).toBeNull();
  });
});
