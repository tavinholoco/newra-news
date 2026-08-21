import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import type { Article } from '@newranews/types';
import { ArticleStatus } from '@newranews/types';
import { ArticleGrid } from '@/components/article/article-grid';
import { renderWithIntl } from '@/tests/utils';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function makeArticle(date: string, title = `Briefing de ${date}`): Article {
  return {
    id: `id-${date}`,
    title,
    content: 'Corpo do briefing.',
    summary: 'Resumo do briefing.',
    date: `${date}T00:00:00.000Z`,
    newsCount: 15,
    createdAt: `${date}T11:00:00.000Z`,
    updatedAt: `${date}T11:00:00.000Z`,
    generatedAt: `${date}T11:00:00.000Z`,
    promptVersion: 'v1',
    modelVersion: 'gemini-2.5-flash',
    status: ArticleStatus.PUBLISHED,
  };
}

afterEach(() => vi.useRealTimers());

describe('ArticleGrid', () => {
  it('should group the briefings by month', () => {
    // Sem agrupar são 89 datas seguidas e nenhuma âncora.
    renderWithIntl(
      <ArticleGrid
        articles={[
          makeArticle('2026-08-21'),
          makeArticle('2026-08-01'),
          makeArticle('2026-07-30'),
        ]}
      />,
    );

    const months = screen.getAllByRole('heading', { level: 2 });
    expect(months).toHaveLength(2);
    expect(months[0]).toHaveTextContent(/agosto de 2026/i);
    expect(months[1]).toHaveTextContent(/julho de 2026/i);
  });

  it('should count only the briefings on this page of that month', () => {
    // A lista é paginada: o mês pode estar partido entre duas páginas.
    renderWithIntl(
      <ArticleGrid
        articles={[makeArticle('2026-08-21'), makeArticle('2026-08-20')]}
      />,
    );

    expect(screen.getByText('2 briefings')).toBeInTheDocument();
  });

  it('should preserve the server order instead of re-sorting', () => {
    renderWithIntl(
      <ArticleGrid
        articles={[
          makeArticle('2026-08-21', 'Mais recente'),
          makeArticle('2026-08-20', 'Anterior'),
        ]}
      />,
    );

    const titles = screen
      .getAllByRole('heading', { level: 3 })
      .map((node) => node.textContent);
    expect(titles).toEqual(['Mais recente', 'Anterior']);
  });

  it('should badge the briefing of the current day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T15:00:00.000Z'));

    renderWithIntl(
      <ArticleGrid
        articles={[makeArticle('2026-08-21'), makeArticle('2026-08-20')]}
      />,
    );

    expect(screen.getAllByText('Hoje')).toHaveLength(1);
  });

  it('should badge nothing when today has no briefing yet', () => {
    // O pipeline roda às 11h UTC; antes disso o dia corrente não tem briefing.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-22T09:00:00.000Z'));

    renderWithIntl(<ArticleGrid articles={[makeArticle('2026-08-21')]} />);

    expect(screen.queryByText('Hoje')).not.toBeInTheDocument();
  });

  it('should link each item to its date slug', () => {
    renderWithIntl(<ArticleGrid articles={[makeArticle('2026-08-21')]} />);

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/article/2026-08-21',
    );
  });

  it('should show the empty state when there is no briefing at all', () => {
    renderWithIntl(<ArticleGrid articles={[]} />);

    expect(screen.getByText(/Nenhum artigo encontrado/i)).toBeInTheDocument();
  });

  it('should show the skeleton instead of the empty state while loading', () => {
    // "Nenhum artigo" sobre uma lista que está carregando parece defeito.
    renderWithIntl(<ArticleGrid articles={[]} isLoading />);

    expect(screen.queryByText(/Nenhum artigo encontrado/i)).not.toBeInTheDocument();
  });
});
