import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type {
  Category,
  News,
  Article,
  PaginatedResponse,
  DashboardMetrics,
  FavoriteWithNews,
} from '@newranews/types';
import {
  getNews,
  getNewsById,
  getArticles,
  getArticleByDate,
  getLatestArticle,
  getDashboardMetrics,
  getFavorites,
  addFavorite,
  removeFavorite,
} from '@/lib/api';

// ── Query Key Factories ──────────────────────────────────────────────

interface NewsListFilters {
  page: number;
  limit: number;
  category?: Category;
  search?: string;
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

// ── News Hooks ───────────────────────────────────────────────────────

export function useNewsList(
  filters: NewsListFilters,
  initialData?: PaginatedResponse<News>,
) {
  return useQuery({
    queryKey: newsKeys.list(filters),
    queryFn: () =>
      getNews(filters.page, filters.limit, filters.category, filters.search),
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

export function useArticleByDate(date: string, initialData?: Article) {
  return useQuery({
    queryKey: articleKeys.detail(date),
    queryFn: () => getArticleByDate(date),
    initialData,
  });
}

export function useLatestArticle(initialData?: Article | null) {
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
