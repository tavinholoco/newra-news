import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type {
  News,
  Article,
  ArticleWithSources,
  PaginatedResponse,
  DashboardMetrics,
  FavoriteWithNews,
  RunPipelineResult,
  DeleteNewsResult,
  NewsFilters,
  NewsFacets,
} from '@newranews/types';
import {
  getNews,
  getNewsFacets,
  getNewsById,
  getArticles,
  getArticleByDate,
  getLatestArticle,
  getDashboardMetrics,
  getFavorites,
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
  list: () => [...favoritesKeys.all, 'list'] as const,
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

export function useFavorites(enabled = true) {
  return useQuery({
    queryKey: favoritesKeys.list(),
    queryFn: () => getFavorites(1, FAVORITES_LIMIT),
    enabled,
  });
}

/** True se `newsId` está entre os favoritos do usuário. */
export function useIsFavorite(newsId: string, enabled = true) {
  const { data } = useFavorites(enabled);
  return data?.data.some((favorite) => favorite.newsId === newsId) ?? false;
}

/**
 * Toggle otimista: adiciona ou remove o favorito e invalida a lista.
 * `news` (opcional) permite inserir a notícia completa na lista otimista,
 * deixando o heart preenchido imediatamente ao favoritar.
 */
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

export function useToggleFavorite(newsId: string, news?: News) {
  const queryClient = useQueryClient();

  return useMutation<
    unknown,
    Error,
    boolean,
    { previous?: PaginatedResponse<FavoriteWithNews> }
  >({
    mutationFn: (favorited: boolean) =>
      favorited ? removeFavorite(newsId) : addFavorite(newsId),
    onMutate: async (favorited) => {
      await queryClient.cancelQueries({ queryKey: favoritesKeys.list() });
      const previous = queryClient.getQueryData<PaginatedResponse<FavoriteWithNews>>(
        favoritesKeys.list(),
      );

      queryClient.setQueryData<PaginatedResponse<FavoriteWithNews>>(
        favoritesKeys.list(),
        (old) => {
          if (!old) return old;
          if (favorited) {
            return {
              ...old,
              data: old.data.filter((item) => item.newsId !== newsId),
              meta: { ...old.meta, total: Math.max(0, old.meta.total - 1) },
            };
          }
          if (news) {
            return {
              ...old,
              data: [
                {
                  id: 'pending',
                  newsId,
                  createdAt: new Date().toISOString(),
                  news,
                },
                ...old.data,
              ],
              meta: { ...old.meta, total: old.meta.total + 1 },
            };
          }
          return old;
        },
      );

      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(favoritesKeys.list(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoritesKeys.list() });
    },
  });
}
