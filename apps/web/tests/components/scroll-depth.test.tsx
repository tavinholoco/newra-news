import { describe, it, expect, beforeEach, vi } from 'vitest';
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
  body.getBoundingClientRect = () =>
    ({ top, height, bottom: top + height, left: 0, right: 0, width: 800, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
  document.body.append(body);
  return body;
}

function scroll() {
  window.dispatchEvent(new Event('scroll'));
  // O componente mede dentro de `requestAnimationFrame`; o stub o torna
  // síncrono para o teste poder observar o resultado.
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

describe('ScrollDepth', () => {
  it('mede o corpo do texto, não a página', () => {
    // Texto que cabe inteiro na viewport já nasce lido — e é verdade.
    mountBody({ top: 0, height: 400 });

    render(
      <ScrollDepth contentId='c1' contentType='story' targetId='corpo' />,
    );

    expect(track).toHaveBeenCalledWith('article_scroll_25', {
      contentId: 'c1',
      contentType: 'story',
    });
    expect(track).toHaveBeenCalledWith('article_scroll_90', {
      contentId: 'c1',
      contentType: 'story',
    });
  });

  it('não dispara limiar que não foi alcançado', () => {
    // 2000px de texto começando no topo: 800 de viewport são 40%.
    mountBody({ top: 0, height: 2000 });

    render(
      <ScrollDepth contentId='c1' contentType='story' targetId='corpo' />,
    );

    expect(track).toHaveBeenCalledWith('article_scroll_25', expect.anything() as never);
    expect(track).not.toHaveBeenCalledWith(
      'article_scroll_50',
      expect.anything() as never,
    );
    expect(track).not.toHaveBeenCalledWith(
      'article_scroll_90',
      expect.anything() as never,
    );
  });

  it('dispara cada limiar uma vez só', () => {
    // Voltar para cima e descer de novo não é uma segunda leitura.
    const body = mountBody({ top: 0, height: 2000 });

    render(
      <ScrollDepth contentId='c1' contentType='story' targetId='corpo' />,
    );

    body.getBoundingClientRect = () =>
      ({ top: -1200, height: 2000, bottom: 800, left: 0, right: 0, width: 800, x: 0, y: -1200, toJSON: () => ({}) }) as DOMRect;
    scroll();
    scroll();
    scroll();

    const chamadas = track.mock.calls.filter(
      ([tipo]) => tipo === 'article_scroll_50',
    );
    expect(chamadas).toHaveLength(1);
  });

  it('não faz nada quando o alvo não existe', () => {
    expect(() =>
      render(
        <ScrollDepth contentId='c1' contentType='story' targetId='inexistente' />,
      ),
    ).not.toThrow();

    expect(track).not.toHaveBeenCalled();
  });

  it('carrega o tipo de conteúdo do briefing quando é briefing', () => {
    mountBody({ top: 0, height: 400 });

    render(
      <ScrollDepth contentId='b1' contentType='briefing' targetId='corpo' />,
    );

    expect(track).toHaveBeenCalledWith('article_scroll_25', {
      contentId: 'b1',
      contentType: 'briefing',
    });
  });
});
