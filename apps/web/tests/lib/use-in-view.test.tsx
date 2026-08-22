import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { useInView } from '@/lib/use-in-view';

/**
 * Um `IntersectionObserver` de mentira, com o gatilho na mão.
 *
 * **O painel do navegador não serve para isto.** Ele não compõe frames, e sem
 * composição não há interseção a calcular: um observador de verdade, num
 * elemento inteiramente visível, não recebe callback nenhum ali. Este mock é o
 * que faz a regra de permanência ser verificável.
 */
let disparar: (ratio: number) => void = () => {};
let desconectado = false;

class FakeObserver {
  constructor(private cb: IntersectionObserverCallback) {
    disparar = (ratio: number) => {
      this.cb(
        [
          {
            isIntersecting: ratio > 0,
            intersectionRatio: ratio,
          } as IntersectionObserverEntry,
        ],
        this as unknown as IntersectionObserver,
      );
    };
  }
  observe() {}
  disconnect() {
    desconectado = true;
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
}

function Alvo({ onSeen, enabled = true }: { onSeen: () => void; enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useInView(ref, { threshold: 0.5, dwellMs: 1000, onSeen, enabled });
  return <div ref={ref} />;
}

beforeEach(() => {
  vi.useFakeTimers();
  desconectado = false;
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useInView', () => {
  it('não conta nada enquanto o tempo de permanência não passa', () => {
    const onSeen = vi.fn();
    render(<Alvo onSeen={onSeen} />);

    disparar(1);
    vi.advanceTimersByTime(999);

    expect(onSeen).not.toHaveBeenCalled();
  });

  it('conta quando o elemento permanece visível o tempo todo', () => {
    const onSeen = vi.fn();
    render(<Alvo onSeen={onSeen} />);

    disparar(1);
    vi.advanceTimersByTime(1000);

    expect(onSeen).toHaveBeenCalledTimes(1);
  });

  it('não conta quem passou rolando', () => {
    // É a diferença entre ter visto e ter passado por cima — e sem ela a
    // viewability medida seria a de um leitor que não viu nada.
    const onSeen = vi.fn();
    render(<Alvo onSeen={onSeen} />);

    disparar(1);
    vi.advanceTimersByTime(400);
    disparar(0);
    vi.advanceTimersByTime(5000);

    expect(onSeen).not.toHaveBeenCalled();
  });

  it('não conta visibilidade abaixo do limiar', () => {
    const onSeen = vi.fn();
    render(<Alvo onSeen={onSeen} />);

    disparar(0.3);
    vi.advanceTimersByTime(5000);

    expect(onSeen).not.toHaveBeenCalled();
  });

  it('conta uma vez só — voltar para cima não é segunda impressão', () => {
    const onSeen = vi.fn();
    render(<Alvo onSeen={onSeen} />);

    disparar(1);
    vi.advanceTimersByTime(1000);
    disparar(0);
    disparar(1);
    vi.advanceTimersByTime(5000);

    expect(onSeen).toHaveBeenCalledTimes(1);
    expect(desconectado).toBe(true);
  });

  it('não observa nada quando desligado', () => {
    const onSeen = vi.fn();
    render(<Alvo onSeen={onSeen} enabled={false} />);

    disparar(1);
    vi.advanceTimersByTime(5000);

    expect(onSeen).not.toHaveBeenCalled();
  });

  it('não quebra em navegador sem IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const onSeen = vi.fn();

    expect(() => render(<Alvo onSeen={onSeen} />)).not.toThrow();
    expect(onSeen).not.toHaveBeenCalled();
  });
});
