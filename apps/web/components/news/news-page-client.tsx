'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import type { News, NewsFacets, PaginatedResponse } from '@newranews/types';
import { useFavorites, useNewsFacets, useNewsList } from '@/lib/queries';
import { useNewsFilters } from '@/lib/use-news-filters';
import { countActiveFilters, toApiFilters } from '@/lib/news-filters';
import { newsToStory } from '@/lib/story';
import { SaveButton } from '@/components/editorial/save-button';
import { CategoryNav } from './category-nav';
import { NewsArchiveHeader } from './news-archive-header';
import { NewsEmptyState } from './news-empty-state';
import { NewsFilterBar } from './news-filter-bar';
import { NewsList } from './news-list';
import { NewsListSkeleton } from './news-list-skeleton';
import { Pagination } from '@/components/editorial/pagination';
import { NewsSearch } from './news-search';

interface NewsPageClientProps {
  /**
   * Primeira página sem filtro, resolvida no servidor (ISR).
   *
   * Opcional porque o prefetch pode falhar, e nesse caso o valor é `undefined`
   * e não uma lista vazia — que a query trataria como resposta boa e não
   * buscaria de novo. Ver `prefetch` em `app/[locale]/news/page.tsx`.
   */
  initialData?: PaginatedResponse<News>;
  initialFacets?: NewsFacets;
}

const PAGE_SIZE = 20;

/**
 * O acervo: busca, filtros, lista e paginação (§7, Fase 4).
 *
 * **Nenhum `useState` de filtro.** O estado mora na URL (`useNewsFilters`), e é
 * isso que faz a tela ser compartilhável, responder ao botão Voltar e nunca
 * divergir do que a `editorial-nav` aponta. Até a Fase 3 aqui havia três
 * `useState` ressincronizados por efeito — a fonte dupla que a Fase 2 registrou
 * como dívida.
 */
export function NewsPageClient({
  initialData,
  initialFacets,
}: NewsPageClientProps) {
  const t = useTranslations('news');
  const tPagination = useTranslations('pagination');
  const { state, setFilters, setPage, clearFilters } = useNewsFilters();

  const { status } = useSession();

  const activeFilters = countActiveFilters(state);
  const isPristine = activeFilters === 0 && state.page === 1;

  /**
   * "Somente salvos" só vale com sessão — a lista é por usuário, e sem ela não
   * há o que mostrar. Deslogado, o `?saved=1` da URL não derruba a tela: ela
   * mostra o acervo, como qualquer valor que a query string não consiga honrar.
   */
  const savedOnly = state.saved && status === 'authenticated';

  // `state` muda de identidade a cada leitura da URL; sem o memo, o objeto de
  // filtros seria novo a cada render e viraria uma chave de query diferente.
  const apiFilters = useMemo(() => toApiFilters(state), [state]);

  const archive = useNewsList(
    { ...apiFilters, page: state.page, limit: PAGE_SIZE },
    // O dado do servidor é a primeira página sem filtro; com qualquer recorte
    // na URL ele não corresponde ao que se está pedindo.
    isPristine ? initialData : undefined,
    !savedOnly,
  );

  /**
   * A mesma tela, outra fonte.
   *
   * O acervo é público e cacheável; a lista de salvos é **por usuário** e vem
   * pela rota autenticada, que aceita as mesmas dimensões de filtro. As duas
   * consultas nunca correm juntas — `enabled` desliga a que não está valendo.
   */
  const saved = useFavorites(
    { ...apiFilters, type: 'NEWS' },
    { page: state.page, limit: PAGE_SIZE, enabled: savedOnly },
  );

  const { isFetching, isError } = savedOnly ? saved : archive;

  const { data: facets } = useNewsFacets(
    apiFilters,
    isPristine ? initialFacets : undefined,
  );

  // Memo e não `data?.data ?? []`: o literal vazio é um array novo a cada
  // render enquanto a consulta não resolve, e ele é dependência dos dois memos
  // abaixo — que passariam a recalcular sempre.
  const news: News[] = useMemo(() => {
    if (!savedOnly) return archive.data?.data ?? [];
    // `type: 'NEWS'` já restringe a consulta; o filtro aqui é o que convence o
    // TypeScript de que a união não traz briefing.
    return (saved.data?.data ?? []).flatMap((item) =>
      item.itemType === 'NEWS' ? [item.news] : [],
    );
  }, [savedOnly, archive.data, saved.data]);

  const meta = (savedOnly ? saved.data : archive.data)?.meta ?? {
    total: 0,
    page: state.page,
    limit: PAGE_SIZE,
    totalPages: 0,
  };

  const stories = useMemo(() => news.map(newsToStory), [news]);

  // O favoritar da listagem, que a V1 já tinha. Chega por prop para o
  // `NewsList` não passar a depender de sessão e de favoritos.
  const renderAction = useCallback(
    (storyId: string) => <SaveButton itemId={storyId} />,
    [],
  );

  // Virar a página sem rolar deixa o leitor no meio de uma lista nova, olhando
  // para a matéria número 12 de outro conjunto. A primeira renderização não
  // rola: ninguém pediu.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state.page]);

  const showSkeleton = isFetching && news.length === 0;

  return (
    <div className='flex flex-col gap-6'>
      <NewsArchiveHeader category={state.category} />

      <NewsSearch
        value={state.search}
        onChange={(search) => setFilters({ search })}
      />

      {/* As facetas contam o **acervo**. Com "somente salvos" ligado elas
          prometeriam um número que o clique não devolve — o mesmo defeito da
          pílula "Todas" da Fase 4 —, então a contagem sai e o controle fica. */}
      <CategoryNav
        selected={state.category}
        facets={facets}
        showCounts={!savedOnly}
        onChange={(category) => setFilters({ category })}
      />

      <NewsFilterBar
        source={state.source}
        period={state.period}
        sort={state.sort}
        saved={state.saved}
        canFilterSaved={status === 'authenticated'}
        facets={facets}
        showCounts={!savedOnly}
        activeFilters={activeFilters}
        onChange={setFilters}
        onClear={clearFilters}
      />

      {/* A contagem é `aria-live`: quem filtra por teclado precisa ouvir que o
          resultado mudou de tamanho sem ter de sair procurando pela lista.

          Fica de fora enquanto o esqueleto está no ar. Sem resposta ainda,
          `meta.total` é zero, e a linha anunciaria "Nenhuma notícia encontrada"
          logo acima de uma lista que está justamente carregando. */}
      {showSkeleton ? null : (
        <p
          aria-live='polite'
          className='border-t border-line pt-4 text-body-sm text-ink-secondary'
        >
          {activeFilters > 0
            ? t('resultCountFiltered', { count: meta.total })
            : t('resultCount', { count: meta.total })}
        </p>
      )}

      {isError ? (
        <p className='rounded-md border border-danger/30 px-4 py-3 text-body-sm text-danger'>
          {t('loadError')}
        </p>
      ) : showSkeleton ? (
        <NewsListSkeleton showLead={isPristine} />
      ) : stories.length === 0 ? (
        <NewsEmptyState
          search={state.search}
          activeFilters={activeFilters}
          savedOnly={savedOnly}
          onClear={clearFilters}
        />
      ) : (
        <NewsList
          stories={stories}
          highlight={state.search}
          // Sem hero na busca, em página interna nem no recorte de salvos:
          // eleger um destaque ali seria a tela inventando uma edição que
          // ninguém fez.
          showLead={state.page === 1 && !state.search && !savedOnly}
          renderAction={renderAction}
        />
      )}

      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        disabled={isFetching}
        label={tPagination('label')}
        onChange={setPage}
      />
    </div>
  );
}
