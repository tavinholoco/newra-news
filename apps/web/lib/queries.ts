import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type {
  News,
  Article,
  ArticleWithSources,
  PaginatedResponse,
  AccountOverview,
  DashboardMetrics,
  FavoriteIds,
  FavoriteItemType,
  RunPipelineResult,
  DeleteNewsResult,
  NewsFilters,
  NewsFacets,
  NewsletterStatus,
  UserPreferences,
} from '@newranews/types';
import {
  getNews,
  getNewsFacets,
  getNewsById,
  getArticles,
  getArticleByDate,
  getLatestArticle,
  getDashboardMetrics,
  getAccount,
  updatePreferences,
  updateNewsletterSubscription,
  getFavorites,
  getFavoriteIds,
  addFavorite,
  removeFavorite,
  runDailyPipeline,
  deleteNewsAdmin,
} from '@/lib/api';

// ── Query Key Factories ──────────────────────────────────────────────

interface NewsListFilters extends NewsFilters {
  page: number;
  limit: number;
}

interface ArticleListFilters {
  page: number;
  limit: number;
}

type FavoriteListFilters = NewsFilters & { type?: FavoriteItemType };

export const newsKeys = {
  all: ['news'] as const,
  lists: () => [...newsKeys.all, 'list'] as const,
  list: (filters: NewsListFilters) => [...newsKeys.lists(), filters] as const,
  details: () => [...newsKeys.all, 'detail'] as const,
  detail: (id: string) => [...newsKeys.details(), id] as const,
  // As facetas ficam fora de `lists()`: elas não mudam ao virar a página, e
  // pendurá-las na chave da lista as recarregaria a cada paginação.
  facets: (filters: NewsFilters) => [...newsKeys.all, 'facets', filters] as const,
};

export const articleKeys = {
  all: ['articles'] as const,
  lists: () => [...articleKeys.all, 'list'] as const,
  list: (filters: ArticleListFilters) =>
    [...articleKeys.lists(), filters] as const,
  details: () => [...articleKeys.all, 'detail'] as const,
  detail: (date: string) => [...articleKeys.details(), date] as const,
  latest: () => [...articleKeys.all, 'latest'] as const,
};

export const metricsKeys = {
  all: ['metrics'] as const,
  dashboard: () => [...metricsKeys.all, 'dashboard'] as const,
};

export const favoritesKeys = {
  all: ['favorites'] as const,
  list: (filters: FavoriteListFilters = {}) =>
    [...favoritesKeys.all, 'list', filters] as const,
  // Os ids ficam fora de `list()`: eles não mudam ao filtrar a tela, e o botão
  // de salvar de qualquer card lê esta mesma chave.
  ids: () => [...favoritesKeys.all, 'ids'] as const,
};

export const accountKeys = {
  all: ['account'] as const,
  overview: () => [...accountKeys.all, 'overview'] as const,
};

export const adminKeys = {
  all: ['admin'] as const,
  newsList: () => [...adminKeys.all, 'news-list'] as const,
};

// ── News Hooks ───────────────────────────────────────────────────────

export function useNewsList(
  filters: NewsListFilters,
  initialData?: PaginatedResponse<News>,
) {
  const { page, limit, ...rest } = filters;

  return useQuery({
    queryKey: newsKeys.list(filters),
    queryFn: () => getNews(page, limit, rest),
    initialData,
    placeholderData: keepPreviousData,
  });
}

/**
 * Contagem por categoria e por fonte para os controles de filtro de `/news`.
 *
 * `placeholderData` segura os números anteriores enquanto a nova contagem
 * chega: sem ele o chip pisca de "41" para nada e volta, e a barra inteira
 * muda de largura no meio do clique.
 */
export function useNewsFacets(filters: NewsFilters, initialData?: NewsFacets) {
  return useQuery({
    queryKey: newsKeys.facets(filters),
    queryFn: () => getNewsFacets(filters),
    initialData,
    placeholderData: keepPreviousData,
  });
}

export function useNewsDetail(id: string, initialData?: News) {
  return useQuery({
    queryKey: newsKeys.detail(id),
    queryFn: () => getNewsById(id),
    initialData,
  });
}

// ── Article Hooks ────────────────────────────────────────────────────

export function useArticleList(
  filters: ArticleListFilters,
  initialData?: PaginatedResponse<Article>,
) {
  return useQuery({
    queryKey: articleKeys.list(filters),
    queryFn: () => getArticles(filters.page, filters.limit),
    initialData,
    placeholderData: keepPreviousData,
  });
}

export function useArticleByDate(
  date: string,
  initialData?: ArticleWithSources,
) {
  return useQuery({
    queryKey: articleKeys.detail(date),
    queryFn: () => getArticleByDate(date),
    initialData,
  });
}

export function useLatestArticle(initialData?: ArticleWithSources | null) {
  return useQuery({
    queryKey: articleKeys.latest(),
    queryFn: () => getLatestArticle(),
    initialData: initialData ?? undefined,
  });
}

// ── Metrics Hooks ───────────────────────────────────────────────────────

export function useDashboardMetrics(initialData?: DashboardMetrics) {
  return useQuery({
    queryKey: metricsKeys.dashboard(),
    queryFn: () => getDashboardMetrics(),
    initialData,
  });
}

// ── Favorites Hooks ───────────────────────────────────────────────────

const FAVORITES_LIMIT = 100;

export function useFavorites(filters: FavoriteListFilters = {}, enabled = true) {
  return useQuery({
    queryKey: favoritesKeys.list(filters),
    queryFn: () => getFavorites(1, FAVORITES_LIMIT, filters),
    enabled,
  });
}

/**
 * Os ids do que está salvo — uma consulta por sessão, compartilhada por todos
 * os botões de salvar da página.
 */
export function useFavoriteIds(enabled = true) {
  return useQuery({
    queryKey: favoritesKeys.ids(),
    queryFn: () => getFavoriteIds(),
    enabled,
  });
}

/** True se este item está salvo. */
export function useIsFavorite(
  itemId: string,
  itemType: FavoriteItemType = 'NEWS',
  enabled = true,
) {
  const { data } = useFavoriteIds(enabled);
  const ids = itemType === 'NEWS' ? data?.news : data?.articles;
  return ids?.includes(itemId) ?? false;
}

/**
 * Toggle otimista.
 *
 * O estado otimista mexe na **lista de ids**, não na lista com conteúdo: é ela
 * que o botão lê, e ela não depende de nenhum recorte de filtro. A lista com
 * conteúdo é invalidada no fim — o card certo aparece quando a resposta chega,
 * em vez de ser fabricado aqui.
 */
export function useToggleFavorite(
  itemId: string,
  itemType: FavoriteItemType = 'NEWS',
) {
  const queryClient = useQueryClient();

  return useMutation<unknown, Error, boolean, { previous?: FavoriteIds }>({
    mutationFn: (favorited: boolean) =>
      favorited ? removeFavorite(itemType, itemId) : addFavorite(itemType, itemId),
    onMutate: async (favorited) => {
      await queryClient.cancelQueries({ queryKey: favoritesKeys.ids() });
      const previous = queryClient.getQueryData<FavoriteIds>(favoritesKeys.ids());

      queryClient.setQueryData<FavoriteIds>(favoritesKeys.ids(), (old) => {
        if (!old) return old;
        const key = itemType === 'NEWS' ? 'news' : 'articles';
        const ids = favorited
          ? old[key].filter((id) => id !== itemId)
          : [...old[key], itemId];

        return { ...old, [key]: ids };
      });

      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(favoritesKeys.ids(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoritesKeys.ids() });
      queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
    },
  });
}

// ── Admin Hooks ───────────────────────────────────────────────────────────

/** Dispara o pipeline manualmente (admin). */
export function useRunPipeline() {
  return useMutation<RunPipelineResult, Error>({
    mutationFn: () => runDailyPipeline(),
  });
}

/** Remove uma notícia (admin) e invalida a lista de notícias do painel. */
export function useDeleteNews() {
  const queryClient = useQueryClient();

  return useMutation<DeleteNewsResult, Error, string>({
    mutationFn: (id: string) => deleteNewsAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.newsList() });
      queryClient.invalidateQueries({ queryKey: newsKeys.lists() });
    },
  });
}


// ── Account Hooks ─────────────────────────────────────────────────────

/** Perfil, preferências, inscrição e contagem de salvos — uma chamada só. */
export function useAccount() {
  return useQuery({
    queryKey: accountKeys.overview(),
    queryFn: () => getAccount(),
  });
}

/**
 * Grava as preferências e **corrige o cache no lugar**, em vez de invalidar: a
 * resposta do `PUT` já é o estado novo, e uma invalidação faria a tela piscar o
 * valor antigo enquanto refaz a consulta que acabou de ser respondida.
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation<UserPreferences, Error, Partial<UserPreferences>>({
    mutationFn: (input) => updatePreferences(input),
    onSuccess: (preferences) => {
      queryClient.setQueryData<AccountOverview>(accountKeys.overview(), (old) =>
        old ? { ...old, preferences } : old,
      );
    },
  });
}

export function useUpdateNewsletterSubscription() {
  const queryClient = useQueryClient();

  return useMutation<NewsletterStatus, Error, boolean>({
    mutationFn: (subscribed) => updateNewsletterSubscription(subscribed),
    onSuccess: (newsletter) => {
      queryClient.setQueryData<AccountOverview>(accountKeys.overview(), (old) =>
        old ? { ...old, newsletter } : old,
      );
    },
  });
}
