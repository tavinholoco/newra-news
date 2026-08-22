import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithIntl } from '../utils';
import { Breadcrumb } from '@/components/editorial/breadcrumb';
import { JsonLd } from '@/components/seo/json-ld';
import { breadcrumbJsonLd, type BreadcrumbStep } from '@/lib/json-ld';

const steps: BreadcrumbStep[] = [
  { name: 'Home', path: '' },
  { name: 'Notícias', path: '/news' },
  { name: 'Política', path: '/news?category=POLITICS' },
  { name: 'A manchete inteira da matéria coletada' },
];

describe('Breadcrumb', () => {
  it('marca o degrau atual e não o transforma em link', () => {
    // Link para a própria página é destino que não muda nada, e para quem
    // navega por teclado é uma parada a mais sem função.
    renderWithIntl(<Breadcrumb steps={steps} ariaLabel='Trilha' />);

    const current = screen.getByText('A manchete inteira da matéria coletada');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current.tagName).not.toBe('A');
  });

  it('a Home vira `/pt-BR` e não `/pt-BR/`', () => {
    // O caminho canônico da Home é `''`; o `Link` do next-intl fala `'/'`.
    renderWithIntl(<Breadcrumb steps={steps} ariaLabel='Trilha' />);

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/pt-BR',
    );
  });

  it('o degrau de categoria leva ao recorte real do acervo', () => {
    renderWithIntl(<Breadcrumb steps={steps} ariaLabel='Trilha' />);

    expect(screen.getByRole('link', { name: 'Política' })).toHaveAttribute(
      'href',
      '/pt-BR/news?category=POLITICS',
    );
  });

  it('só o degrau atual encolhe — os ancestrais são shrink-0', () => {
    // O `shrink-0` precisa estar no `li`, não só no `<a>`: quem o flex encolhe
    // é o item da linha, e um `li` que encolhe com `min-w-0` clipa o próprio
    // conteúdo. Em produção "Notícias" pedia 77px e recebia 51, comendo o
    // chevron e o gap — a trilha saiu com os degraus grudados e sem separador.
    renderWithIntl(<Breadcrumb steps={steps} ariaLabel='Trilha' />);

    const itens = screen.getAllByRole('listitem');
    const ancestrais = itens.slice(0, -1);
    const atual = itens[itens.length - 1]!;

    for (const li of ancestrais) {
      expect(li.className).toContain('shrink-0');
      expect(li.className).not.toContain('min-w-0');
    }
    expect(atual.className).toContain('min-w-0');
    expect(atual.className).not.toContain('shrink-0');
  });

  it('cada degrau depois do primeiro tem um separador', () => {
    const { container } = renderWithIntl(
      <Breadcrumb steps={steps} ariaLabel='Trilha' />,
    );

    // Um a menos que os degraus: o primeiro não tem o que separar.
    expect(container.querySelectorAll('li svg[aria-hidden="true"]')).toHaveLength(
      steps.length - 1,
    );
  });

  it('é uma lista ordenada dentro de um nav rotulado', () => {
    renderWithIntl(<Breadcrumb steps={steps} ariaLabel='Trilha' />);

    const nav = screen.getByRole('navigation', { name: 'Trilha' });
    expect(nav.querySelector('ol')).not.toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });

  it('a trilha visível e o BreadcrumbList descrevem os mesmos degraus', () => {
    // É a garantia que justifica as duas pontas receberem a *mesma* lista:
    // marcação de trilha que não descreve a trilha visível é dado errado.
    const { container } = renderWithIntl(
      <>
        <Breadcrumb steps={steps} ariaLabel='Trilha' />
        <JsonLd data={breadcrumbJsonLd('pt-BR', steps)} />
      </>,
    );

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    const parsed = JSON.parse(script?.textContent ?? '{}') as {
      itemListElement: Array<{ name: string }>;
    };

    const visible = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent?.trim());

    expect(parsed.itemListElement.map((entry) => entry.name)).toEqual(visible);
  });
});
