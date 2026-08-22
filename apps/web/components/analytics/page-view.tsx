'use client';

import { useEffect, useRef } from 'react';
import type { Category } from '@newranews/types';
import { track } from '@/lib/analytics';

interface PageViewProps {
  /** `homepage_view` na Home; `category_view` quando há categoria em foco. */
  event: 'homepage_view' | 'category_view';
  /** Obrigatório quando `event` é `category_view`. */
  category?: Category;
  /** De onde a categoria foi aberta. */
  origin?: 'category-section' | 'search';
}

/**
 * O evento de visualização, disparado uma vez por montagem.
 *
 * **Existe como componente porque a página é server component.** A regra 3 da
 * §2 é que evento só sai de client component — um server component não tem
 * sessão para atribuir. Em vez de transformar a Home inteira em client
 * component por causa de uma chamada (o que a §17 proíbe em letras garrafais),
 * a página monta este componente vazio, que não renderiza nada.
 *
 * **Um `useRef` guarda a montagem, e não é zelo excessivo.** Em
 * desenvolvimento o StrictMode monta duas vezes de propósito; sem a guarda, a
 * contagem de sessões sairia dobrada de todo ambiente de dev — e ninguém
 * notaria até comparar com produção.
 */
export function PageView({ event, category, origin }: PageViewProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    if (event === 'homepage_view') {
      track('homepage_view');
      return;
    }

    // Sem categoria não há o que registrar: o payload a exige, e um
    // `category_view` sem categoria não responde a pergunta que ele existe
    // para responder.
    if (category) {
      track('category_view', { category, origin: origin ?? 'search' });
    }
  }, [event, category, origin]);

  return null;
}
