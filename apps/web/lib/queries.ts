import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type {
  Category,
  News,
  Article,
  PaginatedResponse,
  DashboardMetrics,
} from '@newranews/types';
import {
  getNews,
  getNewsById,
  getArticles,
  getArticleByDate,
  getLatestArticle,
  getDashboardMetrics,
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
