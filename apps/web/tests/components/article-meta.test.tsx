import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { ArticleMeta } from '@/components/editorial/article-meta';
import { renderWithIntl } from '@/tests/utils';

describe('ArticleMeta', () => {
  it('should render source, date and reading time together', () => {
    renderWithIntl(
      <ArticleMeta
        source='G1'
        publishedAt='2024-01-01T12:00:00.000Z'
        readingTimeMinutes={4}
      />,
    );

    expect(screen.getByText('G1')).toBeInTheDocument();
    expect(screen.getByText('4 min de leitura')).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it('should localize the reading time label', () => {
    renderWithIntl(<ArticleMeta readingTimeMinutes={7} />, 'en');

    expect(screen.getByText('7 min read')).toBeInTheDocument();
  });

  it('should expose the publication date as a machine-readable time element', () => {
    const { container } = renderWithIntl(
      <ArticleMeta publishedAt='2024-01-01T12:00:00.000Z' />,
    );

    expect(container.querySelector('time')).toHaveAttribute(
      'dateTime',
      '2024-01-01T12:00:00.000Z',
    );
  });

  it('should omit the pieces it did not receive', () => {
    renderWithIntl(<ArticleMeta source='G1' />);

    expect(screen.getByText('G1')).toBeInTheDocument();
    expect(screen.queryByText(/min de leitura/)).not.toBeInTheDocument();
    expect(document.querySelector('time')).toBeNull();
  });

  it('should keep the other fields when the source comes back empty', () => {
    // A API devolve `source: ''` quando o feed não traz o veículo. Com `??`
    // no lugar de `||`, a string vazia contava como "tem conteúdo" e o
    // componente engolia data e tempo de leitura junto.
    renderWithIntl(
      <ArticleMeta
        source=''
        publishedAt='2024-01-01T12:00:00.000Z'
        readingTimeMinutes={3}
      />,
    );

    expect(screen.getByText('3 min de leitura')).toBeInTheDocument();
    expect(document.querySelector('time')).not.toBeNull();
  });

  it('should render nothing when it has no metadata at all', () => {
    const { container } = renderWithIntl(<ArticleMeta />);

    expect(container).toBeEmptyDOMElement();
  });

  it('should not emit an anchor for the source without a href', () => {
    // Cards inteiros já são link: uma âncora aninhada seria HTML inválido.
    renderWithIntl(<ArticleMeta source='G1' />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should link the source to the original story when given a href', () => {
    renderWithIntl(
      <ArticleMeta source='G1' sourceHref='https://g1.globo.com/teste' />,
    );

    const link = screen.getByRole('link', { name: /G1/ });
    expect(link).toHaveAttribute('href', 'https://g1.globo.com/teste');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should never show a reading time below one minute', () => {
    renderWithIntl(<ArticleMeta readingTimeMinutes={0.2} />);

    expect(screen.getByText('1 min de leitura')).toBeInTheDocument();
  });
});
