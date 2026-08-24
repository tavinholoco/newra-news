'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Devolve o foco e a viewport ao topo dos resultados quando a página muda.
 *
 * **Duas coisas que a auditoria 10.2 mediu, e o Lighthouse não vê.**
 *
 * A primeira é o foco. As duas listagens paginadas rolavam a janela para o topo
 * e deixavam o foco onde estava — no botão de paginação, agora fora da tela.
 * Para quem navega por teclado, viewport e foco em lugares diferentes fazem o
 * próximo Tab saltar de volta para o rodapé sem explicação; para quem lê por
 * leitor de tela, **nada anuncia que a página mudou** — a lista simplesmente
 * passa a ser outra. Mover o foco para a região de resultados resolve os dois
 * de uma vez, e é por isso que o alvo tem `aria-labelledby` apontando para a
 * contagem: ao receber foco, o leitor anuncia "1.234 notícias encontradas",
 * que é exatamente o que mudou.
 *
 * A segunda é o `prefers-reduced-motion`. O `globals.css` já derruba animação e
 * `scroll-behavior` globalmente, mas **`scrollTo({ behavior: 'smooth' })` passa
 * por cima da regra de CSS**: `behavior` explícito no JavaScript vence o
 * `scroll-behavior: auto !important`. Ou seja, a preferência do sistema estava
 * declarada e desrespeitada nos dois únicos lugares onde há rolagem
 * programática. Aqui ela é lida em tempo de execução.
 *
 * **A primeira renderização não faz nada**: ninguém pediu, e roubar o foco de
 * quem acabou de abrir a tela é pior do que não mover.
 */
export function useResultsFocus(
  page: number,
  target: RefObject<HTMLElement>,
): void {
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const element = target.current;
    if (!element) return;

    // `preventScroll`: o foco entra sem arrastar a página, e a rolagem abaixo
    // é quem decide como chegar lá — com ou sem animação.
    element.focus({ preventScroll: true });

    const reduzMovimento =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({ top: 0, behavior: reduzMovimento ? 'auto' : 'smooth' });
  }, [page, target]);
}
