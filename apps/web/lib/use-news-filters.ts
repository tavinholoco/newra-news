'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';
import {
  DEFAULT_NEWS_FILTERS,
  readNewsFilters,
  writeNewsFilters,
  type NewsFilterState,
} from '@/lib/news-filters';

export interface UseNewsFilters {
  state: NewsFilterState;
  /**
   * Altera filtros e volta para a página 1.
   *
   * Sempre: qualquer filtro muda o tamanho do resultado, e ficar na página 7 de
   * uma busca que agora tem duas páginas devolve uma tela vazia que parece
   * defeito.
   */
  setFilters: (patch: Partial<Omit<NewsFilterState, 'page'>>) => void;
  setPage: (page: number) => void;
  clearFilters: () => void;
}

/**
 * O "filter state" da Fase 4: o estado da `/news` **mora na URL**.
 *
 * Até a Fase 3 a `/news` só *lia* `?category=` e `?search=` — quem clicava num
 * filtro mudava `useState` e a URL passava a mentir sobre o que estava na tela.
 * Aqui a URL é a única fonte: o componente não guarda cópia do filtro, então
 * não há o que dessincronizar, e voltar/avançar no navegador funciona de graça.
 *
 * **`push` para escolha, `replace` para digitação.** Cada clique em categoria,
 * fonte, período, ordem ou página é uma decisão que o leitor pode querer
 * desfazer com o botão Voltar. A busca é debounced e escreveria uma entrada de
 * histórico por pausa de digitação — "copa do mundo" viraria quatro entradas.
 */
export function useNewsFilters(): UseNewsFilters {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // `toString()` na dependência, e não o objeto: o Next devolve uma instância
  // nova de `ReadonlyURLSearchParams` a cada render, e o `useMemo` nunca
  // acertaria.
  const key = searchParams.toString();
  const state = useMemo(() => readNewsFilters(new URLSearchParams(key)), [key]);

  const navigate = useCallback(
    (next: NewsFilterState, mode: 'push' | 'replace') => {
      const query = writeNewsFilters(next).toString();
      router[mode](`${pathname}${query ? `?${query}` : ''}`, { scroll: false });
    },
    [pathname, router],
  );

  const setFilters = useCallback(
    (patch: Partial<Omit<NewsFilterState, 'page'>>) => {
      const next = { ...state, ...patch, page: 1 };
      // Só a busca chega por digitação; o resto é clique.
      const typed = 'search' in patch && Object.keys(patch).length === 1;
      navigate(next, typed ? 'replace' : 'push');
    },
    [navigate, state],
  );

  const setPage = useCallback(
    (page: number) => navigate({ ...state, page }, 'push'),
    [navigate, state],
  );

  const clearFilters = useCallback(
    // A ordenação sobrevive: não é filtro, e zerá-la junto tiraria do leitor
    // uma escolha que ele não pediu para desfazer.
    () => navigate({ ...DEFAULT_NEWS_FILTERS, sort: state.sort }, 'push'),
    [navigate, state.sort],
  );

  return { state, setFilters, setPage, clearFilters };
}
