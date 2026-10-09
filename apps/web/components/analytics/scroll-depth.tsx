'use client';

import { useEffect, useRef } from 'react';
import type { EventContentType } from '@newranews/types';
import { track } from '@/lib/analytics';

interface ScrollDepthProps {
  contentId: string;
  contentType: EventContentType;
  /** `id` do elemento que carrega o texto — é ele que é medido, não a página. */
  targetId: string;
}

/** Os três limiares da §3, e o evento de cada um. */
const THRESHOLDS = [
  { fraction: 0.25, type: 'article_scroll_25' },
  { fraction: 0.5, type: 'article_scroll_50' },
  { fraction: 0.9, type: 'article_scroll_90' },
] as const;

/**
 * Profundidade de leitura — a métrica que separa "viu" de "leu".
 *
 * **Registra as duas pontas.** `article_view` sai uma vez por montagem: é o
 * denominador da "leitura completa", que até 09/10/2026 dividia pelo clique
 * no card — e quem chega pelo buscador ou por link direto não clica em card
 * nenhum. Os três limiares são o numerador. Os dois carregam a mesma chave
 * (`contentId`, `contentType`), e a API cruza o par por sessão (13.4 do plano
 * de observabilidade).
 *
 * **Mede o corpo do texto, não a página.** A tela de leitura termina em
 * relacionadas e num CTA de newsletter; incluí-los faria "90% da página" ser
 * alcançável sem ler o último terço da matéria, e a métrica passaria a medir
 * rolagem em vez de leitura.
 *
 * **Só conta depois de o leitor rolar.** A medição da montagem e a do
 * redimensionamento não disparam limiar nenhum até o primeiro `scroll`: um
 * texto que cabia na tela "nascia 100% lido", e a captura de página inteira do
 * Lighthouse e do Playwright estica a viewport até o texto inteiro "passar"
 * por ela. Medido em 01/10/2026: 1.034 leituras a 90% contra zero aberturas.
 * Depois da primeira rolagem tudo conta, inclusive o que já estava à vista —
 * e girar o celular no meio da leitura também.
 *
 * **Cada limiar dispara uma vez por montagem**, no cruzamento — não a cada
 * evento de rolagem. Voltar para cima e descer de novo não é uma segunda
 * leitura.
 *
 * O cálculo roda dentro de `requestAnimationFrame` e os listeners são
 * `passive`: medir não pode disputar a fluidez da rolagem, que é o que o
 * leitor sente.
 */
export function ScrollDepth({
  contentId,
  contentType,
  targetId,
}: ScrollDepthProps) {
  const reached = useRef(new Set<string>());
  // O `useRef` guarda a montagem dupla do StrictMode, como no `PageView`: sem
  // ele, toda visualização sairia dobrada do ambiente de desenvolvimento.
  const viewed = useRef<string | null>(null);

  useEffect(() => {
    if (viewed.current !== contentId) {
      viewed.current = contentId;
      track('article_view', { contentId, contentType });
    }

    const target = document.getElementById(targetId);
    if (!target) return;

    let frame: number | null = null;
    let scheduled = false;
    let engaged = false;

    const measure = () => {
      if (!engaged) return;

      const rect = target.getBoundingClientRect();
      const height = rect.height;
      if (height <= 0) return;

      // Quanto do elemento já passou pela borda inferior da viewport.
      const seen = Math.min(window.innerHeight - rect.top, height);
      const ratio = Math.max(0, Math.min(1, seen / height));

      for (const { fraction, type } of THRESHOLDS) {
        if (ratio >= fraction && !reached.current.has(type)) {
          reached.current.add(type);
          track(type, { contentId, contentType });
        }
      }

      if (reached.current.size === THRESHOLDS.length) {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', schedule);
      }
    };

    // **O guard é o booleano, não o id do frame.** Zerar `frame` dentro de
    // `measure` só funciona porque o `requestAnimationFrame` do navegador é
    // assíncrono: a atribuição `frame = ...` acontece **depois** do callback, e
    // com uma implementação síncrona ela reescreveria o `null` e travaria o
    // agendamento para sempre. Foi assim que a suite pegou — o segundo
    // `scroll` nunca media.
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      frame = window.requestAnimationFrame(() => {
        scheduled = false;
        measure();
      });
    };

    // Só a rolagem prova que há alguém do outro lado; o `resize` mede, mas
    // não acorda a medição.
    const onScroll = () => {
      engaged = true;
      schedule();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', schedule);
    };
  }, [contentId, contentType, targetId]);

  return null;
}
