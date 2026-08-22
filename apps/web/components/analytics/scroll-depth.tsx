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
 * Profundidade de leitura — a métrica que separa "abriu" de "leu".
 *
 * **Mede o corpo do texto, não a página.** A tela de leitura termina em
 * relacionadas e num CTA de newsletter; incluí-los faria "90% da página" ser
 * alcançável sem ler o último terço da matéria, e a métrica passaria a medir
 * rolagem em vez de leitura.
 *
 * **Cada limiar dispara uma vez por montagem**, no cruzamento — não a cada
 * evento de rolagem. Voltar para cima e descer de novo não é uma segunda
 * leitura.
 *
 * O cálculo roda dentro de `requestAnimationFrame` e o listener é `passive`:
 * medir não pode disputar a fluidez da rolagem, que é o que o leitor sente.
 * Um artigo mais curto que a viewport já nasce 100% lido — e é verdade, ele
 * cabe inteiro na tela.
 */
export function ScrollDepth({
  contentId,
  contentType,
  targetId,
}: ScrollDepthProps) {
  const reached = useRef(new Set<string>());

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    let frame: number | null = null;
    let scheduled = false;

    const measure = () => {
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
        window.removeEventListener('scroll', schedule);
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

    // Uma medição imediata: um texto curto pode já estar inteiro na tela, e
    // esperar por um `scroll` que nunca vem perderia os três limiares.
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [contentId, contentType, targetId]);

  return null;
}
