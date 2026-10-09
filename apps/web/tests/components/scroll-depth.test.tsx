import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StrictMode } from 'react';
import { render } from '@testing-library/react';

const { track } = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock('@/lib/analytics', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/analytics')>('@/lib/analytics');
  return { ...actual, track };
});

const { ScrollDepth } = await import('@/components/analytics/scroll-depth');

/**
 * O corpo do texto, com altura e posição controladas.
 *
 * `getBoundingClientRect` é o que a jsdom não implementa de verdade — todo
 * elemento mede zero. Sem este stub o componente não teria o que medir e os
 * testes provariam nada.
 */
function mountBody({ top, height }: { top: number; height: number }) {
  const body = document.createElement('div');
  body.id = 'corpo';
  placeBody(body, { top, height });
  document.body.append(body);
  return body;
}

function placeBody(body: HTMLElement, { top, height }: { top: number; height: number }) {
  body.getBoundingClientRect = () =>
    ({ top, height, bottom: top + height, left: 0, right: 0, width: 800, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
}

function scroll() {
  window.dispatchEvent(new Event('scroll'));
  // O componente mede dentro de `requestAnimationFrame`; o stub o torna
  // síncrono para o teste poder observar o resultado.
}

function resize() {
  window.dispatchEvent(new Event('resize'));
}

function scrollEvents(): string[] {
  return track.mock.calls
    .map(([tipo]) => tipo as string)
    .filter((tipo) => tipo.startsWith('article_scroll_'));
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  window.innerHeight = 800;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

describe('ScrollDepth — a visualização (o denominador)', () => {
  it('registra a tela de leitura vista, uma vez, na montagem', () => {
    // A "leitura completa" dividia pelo clique no card — que nunca acontece
    // para quem chega pelo buscador ou por link direto. O denominador é a
    // tela vista (13.4 do plano de observabilidade).
    mountBody({ top: 0, height: 2000 });

    render(<ScrollDepth contentId='c1' contentType='story' targetId='corpo' />);

    expect(track).toHaveBeenCalledWith('article_view', {
      contentId: 'c1',
      contentType: 'story',
    });
    expect(track.mock.calls.filter(([tipo]) => tipo === 'article_view')).toHaveLength(1);
  });

  it('não registra duas visualizações na montagem dupla do StrictMode', () => {
    mountBody({ top: 0, height: 2000 });

    render(
      <StrictMode>
        <ScrollDepth contentId='c1' contentType='story' targetId='corpo' />
      </StrictMode>,
    );

    expect(track.mock.calls.filter(([tipo]) => tipo === 'article_view')).toHaveLength(1);
  });

  it('registra a visualização mesmo sem o corpo para medir', () => {
    // A tela foi vista; sem o alvo, só a leitura não pode ser medida — e
    // isso conta como "não lida", que é o lado honesto do erro.
    render(
      <ScrollDepth contentId='c1' contentType='story' targetId='inexistente' />,
    );

    expect(track).toHaveBeenCalledWith('article_view', {
      contentId: 'c1',
      contentType: 'story',
    });
    expect(scrollEvents()).toEqual([]);
  });

  it('carrega o tipo de conteúdo do briefing quando é briefing', () => {
    mountBody({ top: 0, height: 2000 });

    render(<ScrollDepth contentId='b1' contentType='briefing' targetId='corpo' />);

    expect(track).toHaveBeenCalledWith('article_view', {
      contentId: 'b1',
      contentType: 'briefing',
    });
  });
});

describe('ScrollDepth — a profundidade (o numerador)', () => {
  it('não conta como lido o texto que cabe na tela sem o leitor rolar', () => {
    // Era o "nasce 100% lido": o Lighthouse, o Smoke e as capturas abrem a
    // tela e saem, e cada abertura virava os três limiares.
    mountBody({ top: 0, height: 400 });

    render(<ScrollDepth contentId='c1' contentType='story' targetId='corpo' />);

    expect(scrollEvents()).toEqual([]);
  });

  it('não conta o redimensionamento como leitura', () => {
    // A captura de página inteira (Lighthouse, Playwright `fullPage`) estica a
    // viewport — o texto inteiro "passa" pela tela sem ninguém rolar.
    const body = mountBody({ top: 0, height: 2000 });

    render(<ScrollDepth contentId='c1' contentType='story' targetId='corpo' />);
    window.innerHeight = 4000;
    placeBody(body, { top: 0, height: 2000 });
    resize();

    expect(scrollEvents()).toEqual([]);
  });

  it('a partir da primeira rolagem, mede o quanto do corpo passou pela tela', () => {
    const body = mountBody({ top: 0, height: 400 });

    render(<ScrollDepth contentId='c1' contentType='story' targetId='corpo' />);
    placeBody(body, { top: -10, height: 400 });
    scroll();

    expect(scrollEvents()).toEqual([
      'article_scroll_25',
      'article_scroll_50',
      'article_scroll_90',
    ]);
    expect(track).toHaveBeenCalledWith('article_scroll_90', {
      contentId: 'c1',
      contentType: 'story',
    });
  });

  it('depois da rolagem, o redimensionamento volta a medir', () => {
    // Girar o celular no meio da leitura é leitura — o que não é leitura é
    // redimensionar antes de o leitor tocar na página.
    const body = mountBody({ top: 0, height: 2000 });

    render(<ScrollDepth contentId='c1' contentType='story' targetId='corpo' />);
    scroll();
    window.innerHeight = 1100;
    placeBody(body, { top: 0, height: 2000 });
    resize();

    expect(scrollEvents()).toEqual(['article_scroll_25', 'article_scroll_50']);
  });

  it('não dispara limiar que não foi alcançado', () => {
    // 2000px de texto começando no topo: 800 de viewport são 40%.
    mountBody({ top: 0, height: 2000 });

    render(<ScrollDepth contentId='c1' contentType='story' targetId='corpo' />);
    scroll();

    expect(scrollEvents()).toEqual(['article_scroll_25']);
  });

  it('dispara cada limiar uma vez só', () => {
    // Voltar para cima e descer de novo não é uma segunda leitura.
    const body = mountBody({ top: 0, height: 2000 });

    render(<ScrollDepth contentId='c1' contentType='story' targetId='corpo' />);

    placeBody(body, { top: -1200, height: 2000 });
    scroll();
    scroll();
    scroll();

    expect(scrollEvents().filter((tipo) => tipo === 'article_scroll_50')).toHaveLength(1);
  });
});
