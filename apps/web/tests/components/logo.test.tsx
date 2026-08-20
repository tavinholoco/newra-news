import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Logo, LogoMark } from '@/components/layout/logo';

describe('Logo', () => {
  it('should render the wordmark as real text, not an image', () => {
    // §40.3-A: o wordmark é tipográfico justamente para continuar selecionável,
    // achável no Ctrl+F e lido sem depender de `aria-label`.
    render(<Logo variant='full' />);

    expect(screen.getByText('Newra News')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('should keep an accessible name when the wordmark is hidden', () => {
    const { container } = render(<Logo variant='mark' />);

    expect(container.querySelector('.sr-only')).toHaveTextContent('Newra News');
  });

  it('should name the brand exactly once in the fixed variants', () => {
    // A marca é `aria-hidden`; um texto a mais faria o leitor de tela anunciar
    // "Newra News Newra News".
    for (const variant of ['full', 'mark'] as const) {
      const { container, unmount } = render(<Logo variant={variant} />);
      expect(container.textContent, variant).toBe('Newra News');
      unmount();
    }
  });

  it('should swap wordmark and sr-only fallback, never showing both', () => {
    // No `responsive` os dois textos existem no DOM e a exclusão é por CSS: o
    // wordmark é `hidden sm:inline` e o fallback `sr-only sm:hidden`. O jsdom
    // não avalia Tailwind, então o par de classes é o que dá para verificar —
    // e é o que impede a dupla leitura em qualquer largura.
    const { container } = render(<Logo variant='responsive' />);
    const spans = [...container.querySelectorAll('span')].filter(
      (node) => node.textContent === 'Newra News' && node.children.length === 0,
    );

    expect(spans).toHaveLength(2);
    // Tokens, não substring: `hidden` também aparece dentro de `sm:hidden`.
    const classes = spans.map((node) => node.className.split(/\s+/));
    expect(classes.some((c) => c.includes('hidden') && c.includes('sm:inline'))).toBe(true);
    expect(classes.some((c) => c.includes('sr-only') && c.includes('sm:hidden'))).toBe(true);
  });

  it('should hide the decorative mark from assistive tech', () => {
    const { container } = render(<LogoMark />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
  });

  it('should pin the mark to the brand colour by default and inherit on request', () => {
    const { container, rerender } = render(<Logo variant='mark' />);
    expect(container.querySelector('svg')?.getAttribute('class')).toContain(
      'text-brand-mark',
    );

    rerender(<Logo variant='mark' tone='inherit' />);
    expect(container.querySelector('svg')?.getAttribute('class')).not.toContain(
      'text-brand-mark',
    );
  });

  it('should paint the mark with currentColor so it follows its context', () => {
    const { container } = render(<LogoMark />);

    expect(container.querySelector('path')).toHaveAttribute(
      'fill',
      'currentColor',
    );
  });
});
