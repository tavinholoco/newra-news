import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { StoryCard } from '@/components/editorial/story-card';
import { StoryCardHorizontal } from '@/components/editorial/story-card-horizontal';
import { StoryCardCompact } from '@/components/editorial/story-card-compact';
import { renderWithIntl } from '@/tests/utils';
import { makeStory } from '@/tests/fixtures/editorial';

vi.mock('next/image', async () => ({
  default: (await import('@/tests/mocks/next-image')).MockNextImage,
}));

describe('StoryCard', () => {
  it('should link the whole card to the story detail page', () => {
    renderWithIntl(<StoryCard story={makeStory()} />);

    const link = screen.getByRole('link', {
      name: /Matéria de teste do bloco editorial/,
    });
    expect(link).toHaveAttribute(
      'href',
      '/pt-BR/news/aaaaaaaa-0000-0000-0000-000000000001',
    );
  });

  it('should render the headline as h3 by default and honour headingLevel', () => {
    const { rerender } = renderWithIntl(<StoryCard story={makeStory()} />);
    expect(
      screen.getByRole('heading', { level: 3, name: /Matéria de teste/ }),
    ).toBeInTheDocument();

    rerender(<StoryCard story={makeStory()} headingLevel='h2' />);
    expect(
      screen.getByRole('heading', { level: 2, name: /Matéria de teste/ }),
    ).toBeInTheDocument();
  });

  it('should show category, source and reading time', () => {
    renderWithIntl(<StoryCard story={makeStory()} />);

    expect(screen.getByText('Tecnologia')).toBeInTheDocument();
    expect(screen.getByText('G1')).toBeInTheDocument();
    expect(screen.getByText('3 min de leitura')).toBeInTheDocument();
  });

  it('should fall back to the brand placeholder when the story has no image', () => {
    renderWithIntl(<StoryCard story={makeStory()} />);

    expect(screen.getByRole('img', { name: 'Newra News' })).toBeInTheDocument();
  });

  it('should render the image when the story has one', () => {
    renderWithIntl(
      <StoryCard story={makeStory({ imageUrl: 'https://cdn.test/a.jpg' })} />,
    );

    expect(
      screen.getByRole('img', { name: /Matéria de teste/ }),
    ).toHaveAttribute('src', 'https://cdn.test/a.jpg');
  });

  it('should omit the dek when showDek is false', () => {
    renderWithIntl(<StoryCard story={makeStory()} showDek={false} />);

    expect(screen.queryByText(/Resumo da matéria de teste/)).toBeNull();
  });

  // `readingTimeMinutes` é nulável no contrato: um terço do acervo vem do RSS
  // sem corpo, e nesse caso a linha de metadata não deve mostrar "0 min".
  it('should not render a reading time when the API sends null', () => {
    renderWithIntl(
      <StoryCard story={makeStory({ readingTimeMinutes: null })} />,
    );

    expect(screen.queryByText(/min de leitura/)).toBeNull();
  });
});

describe('StoryCardHorizontal', () => {
  it('should render the category kicker and link to the story', () => {
    renderWithIntl(<StoryCardHorizontal story={makeStory()} />);

    expect(screen.getByText('Tecnologia')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Matéria de teste/ }),
    ).toHaveAttribute(
      'href',
      '/pt-BR/news/aaaaaaaa-0000-0000-0000-000000000001',
    );
  });

  it('should drop the thumbnail when showImage is false', () => {
    renderWithIntl(<StoryCardHorizontal story={makeStory()} showImage={false} />);

    expect(screen.queryByRole('img', { name: 'Newra News' })).toBeNull();
  });

  // A coluna lateral é estreita: dek aqui empurra a próxima manchete para fora
  // da dobra e a lista deixa de ser escaneável.
  it('should never render the dek', () => {
    renderWithIntl(<StoryCardHorizontal story={makeStory()} />);

    expect(screen.queryByText(/Resumo da matéria de teste/)).toBeNull();
  });
});

describe('StoryCardCompact', () => {
  // A posição já é semântica pelo `<ol>` que envolve a lista; o numeral
  // visível repetiria a mesma informação para quem usa leitor de tela.
  it('should hide the rank numeral from assistive technology', () => {
    renderWithIntl(<StoryCardCompact story={makeStory()} rank={3} />);

    expect(screen.getByText('3')).toHaveAttribute('aria-hidden', 'true');
  });

  it('should render no numeral when rank is not provided', () => {
    renderWithIntl(<StoryCardCompact story={makeStory()} />);

    expect(screen.queryByText('3')).toBeNull();
  });

  it('should never render an image', () => {
    renderWithIntl(<StoryCardCompact story={makeStory({ imageUrl: 'https://cdn.test/a.jpg' })} />);

    expect(screen.queryByRole('img')).toBeNull();
  });
});
