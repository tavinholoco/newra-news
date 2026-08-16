import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import type { News, Category } from '@newranews/types';
import { NewsCard } from '@/components/news/news-card';
import { renderWithIntl } from '@/tests/utils';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} />
  ),
}));

// FavoriteButton renderizado pelo card (useSession + hooks de favoritos)
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signIn: vi.fn(),
}));

vi.mock('@/lib/queries', () => ({
  useIsFavorite: () => false,
  useToggleFavorite: () => ({ mutate: vi.fn(), isPending: false }),
}));

const mockNews: News = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  title: 'Notícia de Teste do Card',
  description: 'Descrição da notícia de teste',
  content: null,
  source: 'G1',
  sourceUrl: 'https://g1.globo.com/teste',
  imageUrl: null,
  category: 'TECHNOLOGY' as Category,
  publishedAt: '2024-01-01T12:00:00.000Z',
  createdAt: '2024-01-01T12:00:00.000Z',
  updatedAt: '2024-01-01T12:00:00.000Z',
};

describe('NewsCard', () => {
  it('should render the news title as a link to the detail page', () => {
    renderWithIntl(<NewsCard news={mockNews} />);

    const link = screen.getByRole('link', { name: /Notícia de Teste do Card/ });
    expect(link).toHaveAttribute(
      'href',
      '/pt-BR/news/aaaaaaaa-0000-0000-0000-000000000001',
    );
  });

  it('should localize the detail link with the en locale prefix', () => {
    renderWithIntl(<NewsCard news={mockNews} />, 'en');

    const link = screen.getByRole('link', { name: /Notícia de Teste do Card/ });
    expect(link).toHaveAttribute(
      'href',
      '/en/news/aaaaaaaa-0000-0000-0000-000000000001',
    );
  });

  it('should show the category label and source', () => {
    renderWithIntl(<NewsCard news={mockNews} />);

    expect(screen.getByText('Tecnologia')).toBeInTheDocument();
    expect(screen.getByText('G1')).toBeInTheDocument();
  });

  it('should render a placeholder image when imageUrl is missing', () => {
    renderWithIntl(<NewsCard news={mockNews} />);

    expect(screen.getByRole('img', { name: 'Newra News' })).toBeInTheDocument();
  });
});
