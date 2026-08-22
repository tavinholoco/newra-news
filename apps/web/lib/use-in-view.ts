'use client';

import { useEffect, useRef, type RefObject } from 'react';

interface InViewOptions {
  /** Fração do elemento que precisa estar visível. `0.5` = metade. */
  threshold: number;
  /** Quanto tempo ele precisa **permanecer** visível, em ms. */
  dwellMs: number;
  /** Disparado uma vez, quando os dois critérios são satisfeitos juntos. */
  onSeen: () => void;
  /** `false` desliga o observador sem desmontar quem o usa. */
  enabled?: boolean;
}

/**
 * "Este elemento foi realmente visto?"
 *
 * **Visível não basta, e é o ponto.** A definição de impressão que a §5 dos
 * slots usa — e que o mercado usa — é *metade do elemento, por pelo menos um
 * segundo*. Sem a permanência, uma rolagem rápida que atravessa a página
 * contaria impressão em todos os slots de uma vez, e a viewability medida seria
 * a de um leitor que não viu nada.
 *
 * **Dispara uma vez por montagem.** Rolar de volta para cima não é uma segunda
 * impressão; contá-la infla o denominador de todo CTR.
 *
 * Existe como hook porque duas coisas precisam exatamente disto: o `ad_view` e
 * os três eventos de profundidade de leitura. Duas implementações da mesma
 * regra divergiriam no primeiro ajuste de limiar.
 */
export function useInView<T extends Element>(
  ref: RefObject<T>,
  { threshold, dwellMs, onSeen, enabled = true }: InViewOptions,
): void {
  // O callback muda de identidade a cada render de quem chama; a ref evita que
  // o observador seja destruído e recriado por causa disso.
  const onSeenRef = useRef(onSeen);
  onSeenRef.current = onSeen;

  const fired = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    // Navegador sem `IntersectionObserver` simplesmente não mede — nunca
    // quebra a página por causa de analytics.
    if (typeof IntersectionObserver === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | null = null;

    const clear = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (fired.current) return;

          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            // O relógio começa aqui e é **cancelado** ao sair: quem passa
            // rolando não completa o segundo, que é exatamente a diferença
            // entre ter visto e ter passado por cima.
            if (timer === null) {
              timer = setTimeout(() => {
                fired.current = true;
                observer.disconnect();
                onSeenRef.current();
              }, dwellMs);
            }
          } else {
            clear();
          }
        }
      },
      { threshold: [threshold] },
    );

    observer.observe(element);

    return () => {
      clear();
      observer.disconnect();
    };
  }, [ref, threshold, dwellMs, enabled]);
}
