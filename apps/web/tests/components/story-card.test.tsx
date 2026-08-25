import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
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
    renderWithIntl(<StoryCard source='hero' position={0} story={makeStory()} />);

    const link = screen.getByRole('link', {
      name: /Matéria de teste do bloco editorial/,
    });
    expect(link).toHaveAttribute(
      'href',
      '/pt-BR/news/aaaaaaaa-0000-0000-0000-000000000001',
    );
  });

  it('should render the headline as h3 by default and honour headingLevel', () => {
    const { rerender } = renderWithIntl(<StoryCard source='hero' position={0} story={makeStory()} />);
    expect(
      screen.getByRole('heading', { level: 3, name: /Matéria de teste/ }),
    ).toBeInTheDocument();

    rerender(<StoryCard source='hero' position={0} story={makeStory()} headingLevel='h2' />);
    expect(
      screen.getByRole('heading', { level: 2, name: /Matéria de teste/ }),
    ).toBeInTheDocument();
  });

  it('should show category, source and reading time', () => {
    renderWithIntl(<StoryCard source='hero' position={0} story={makeStory()} />);

    expect(screen.getByText('Tecnologia')).toBeInTheDocument();
    expect(screen.getByText('G1')).toBeInTheDocument();
    expect(screen.getByText('3 min de leitura')).toBeInTheDocument();
  });

  /**
   * **Sem foto, o card é de texto — e isso vale para um quarto do acervo.**
   *
   * Medido em 25/08/2026 sobre as 6.669 linhas de produção: 1.703 notícias
   * (25,5%) não têm imagem em lugar nenhum do feed. Até a Fase 12 elas
   * recebiam a caixa de imagem com o placeholder de marca, e a grade repetia um
   * retângulo laranja com um "N" a cada quatro células.
   */
  it('should not draw an image box when the story has no photo', () => {
    renderWithIntl(<StoryCard source='hero' position={0} story={makeStory()} />);

    expect(screen.queryByRole('img', { name: 'Newra News' })).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('should still show category, headline, dek and metadata without a photo', () => {
    // A célula continua cheia — era a única coisa que o retângulo resolvia.
    renderWithIntl(<StoryCard source='hero' position={0} story={makeStory()} />);

    expect(screen.getByText('Tecnologia')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Matéria de teste/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Resumo da matéria de teste/)).toBeInTheDocument();
    expect(screen.getByText('G1')).toBeInTheDocument();
  });

  it('should give the headline and the dek the room the photo would have taken', () => {
    const { container, rerender } = renderWithIntl(
      <StoryCard source='hero' position={0} story={makeStory()} />,
    );
    const semFoto = container.querySelector('h3')!.className;

    rerender(
      <StoryCard
        source='hero'
        position={0}
        story={makeStory({ imageUrl: 'https://cdn.test/a.jpg' })}
      />,
    );
    const comFoto = container.querySelector('h3')!.className;

    // Medido no navegador: 22px contra 18px, e uma linha a mais antes de
    // truncar. As classes são o que a suíte consegue afirmar sem layout.
    expect(semFoto).toContain('text-h3');
    expect(semFoto).toContain('line-clamp-4');
    expect(comFoto).toContain('text-h4');
    expect(comFoto).toContain('line-clamp-3');
  });

  it('should keep the brand placeholder for a photo that exists and fails to load', () => {
    // O placeholder não sumiu — mudou de papel. Ele cobre o caso em que ele
    // sempre foi certo: a caixa já ocupa espaço no layout, e sumir com ela
    // depois do erro seria salto.
    renderWithIntl(
      <StoryCard
        source='hero'
        position={0}
        story={makeStory({ imageUrl: 'https://cdn.test/a.jpg' })}
      />,
    );

    const img = screen.getByRole('img', { name: /Matéria de teste/ });
    fireEvent.error(img);

    expect(screen.getByRole('img', { name: 'Newra News' })).toBeInTheDocument();
  });

  it('should render the image when the story has one', () => {
    renderWithIntl(
      <StoryCard source='hero' position={0} story={makeStory({ imageUrl: 'https://cdn.test/a.jpg' })} />,
    );

    expect(
      screen.getByRole('img', { name: /Matéria de teste/ }),
    ).toHaveAttribute('src', 'https://cdn.test/a.jpg');
  });

  it('should omit the dek when showDek is false', () => {
    renderWithIntl(<StoryCard source='hero' position={0} story={makeStory()} showDek={false} />);

    expect(screen.queryByText(/Resumo da matéria de teste/)).toBeNull();
  });

  // `readingTimeMinutes` é nulável no contrato: um terço do acervo vem do RSS
  // sem corpo, e nesse caso a linha de metadata não deve mostrar "0 min".
  it('should not render a reading time when the API sends null', () => {
    renderWithIntl(
      <StoryCard source='hero' position={0} story={makeStory({ readingTimeMinutes: null })} />,
    );

    expect(screen.queryByText(/min de leitura/)).toBeNull();
  });
});

describe('StoryCardHorizontal', () => {
  it('should render the category kicker and link to the story', () => {
    renderWithIntl(<StoryCardHorizontal source='hero' position={0} story={makeStory()} />);

    expect(screen.getByText('Tecnologia')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Matéria de teste/ }),
    ).toHaveAttribute(
      'href',
      '/pt-BR/news/aaaaaaaa-0000-0000-0000-000000000001',
    );
  });

  it('should drop the thumbnail when showImage is false', () => {
    renderWithIntl(<StoryCardHorizontal source='hero' position={0} story={makeStory({ imageUrl: 'https://cdn.test/a.jpg' })} showImage={false} />);

    expect(screen.queryByRole('img')).toBeNull();
  });

  // `showImage` é a decisão de quem posiciona; `imageUrl` é a de haver foto.
  // Sem ela, a miniatura seria um quadrado de 96px com um "N" ao lado de cada
  // quarto item da lista.
  it('should drop the thumbnail when the story has no photo', () => {
    renderWithIntl(<StoryCardHorizontal source='hero' position={0} story={makeStory()} />);

    expect(screen.queryByRole('img', { name: 'Newra News' })).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  // A coluna lateral é estreita: dek aqui empurra a próxima manchete para fora
  // da dobra e a lista deixa de ser escaneável.
  it('should never render the dek', () => {
    renderWithIntl(<StoryCardHorizontal source='hero' position={0} story={makeStory()} />);

    expect(screen.queryByText(/Resumo da matéria de teste/)).toBeNull();
  });
});

describe('StoryCardCompact', () => {
  // A posição já é semântica pelo `<ol>` que envolve a lista; o numeral
  // visível repetiria a mesma informação para quem usa leitor de tela.
  it('should hide the rank numeral from assistive technology', () => {
    renderWithIntl(<StoryCardCompact source='hero' position={0} story={makeStory()} rank={3} />);

    expect(screen.getByText('3')).toHaveAttribute('aria-hidden', 'true');
  });

  it('should render no numeral when rank is not provided', () => {
    renderWithIntl(<StoryCardCompact source='hero' position={0} story={makeStory()} />);

    expect(screen.queryByText('3')).toBeNull();
  });

  it('should never render an image', () => {
    renderWithIntl(<StoryCardCompact source='hero' position={0} story={makeStory({ imageUrl: 'https://cdn.test/a.jpg' })} />);

    expect(screen.queryByRole('img')).toBeNull();
  });
});
