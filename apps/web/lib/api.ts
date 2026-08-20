import type {
  News,
  Article,
  Category,
  PaginatedResponse,
  ApiResponse,
  DashboardMetrics,
  Subscriber,
  FavoriteWithNews,
  AddedFavorite,
  RunPipelineResult,
  DeleteNewsResult,
} from '@newranews/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function getNews(
  page = 1,
  limit = 12,
  category?: Category,
  search?: string,
): Promise<PaginatedResponse<News>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (category) params.set('category', category);
  if (search) params.set('search', search);

  return fetchApi<PaginatedResponse<News>>(`/news?${params.toString()}`);
}

export async function getNewsById(id: string): Promise<News> {
  const res = await fetchApi<ApiResponse<News>>(`/news/${id}`);
  return res.data;
}

export async function getLatestArticle(): Promise<Article | null> {
  try {
    const res = await fetchApi<ApiResponse<Article>>('/articles/latest');
    return res.data;
  } catch {
    return null;
  }
}

export async function getArticles(
  page = 1,
  limit = 10,
): Promise<PaginatedResponse<Article>> {
  return fetchApi<PaginatedResponse<Article>>(
    `/articles?page=${page}&limit=${limit}`,
  );
}

export async function getArticleByDate(date: string): Promise<Article> {
  const res = await fetchApi<ApiResponse<Article>>(`/articles/${date}`);
  return res.data;
}

export async function subscribeToNewsletter(email: string): Promise<Subscriber> {
  const res = await fetchApi<ApiResponse<Subscriber>>('/newsletter/subscribe', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return res.data;
}

export async function unsubscribeFromNewsletter(
  token: string,
): Promise<{ unsubscribed: boolean }> {
  const params = new URLSearchParams({ token });
  const res = await fetchApi<ApiResponse<{ unsubscribed: boolean }>>(
    `/newsletter/unsubscribe?${params.toString()}`,
  );
  return res.data;
}

// ── Favoritos ──────────────────────────────────────────────────────────
// Chamadas de mesmo-origem para as rotas proxy do Next (app/api/favorites),
// que leem a sessão do next-auth e assinam o JWT server-side.

async function fetchWebApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function getFavorites(
  page = 1,
  limit = 100,
): Promise<PaginatedResponse<FavoriteWithNews>> {
  return fetchWebApi<PaginatedResponse<FavoriteWithNews>>(
    `/api/favorites?page=${page}&limit=${limit}`,
  );
}

export async function addFavorite(newsId: string): Promise<AddedFavorite> {
  const res = await fetchWebApi<ApiResponse<AddedFavorite>>('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ newsId }),
  });
  return res.data;
}

export async function removeFavorite(
  newsId: string,
): Promise<{ removed: boolean }> {
  const res = await fetchWebApi<ApiResponse<{ removed: boolean }>>(
    `/api/favorites/${newsId}`,
    { method: 'DELETE' },
  );
  return res.data;
}

// ── Admin (painel dev) ─────────────────────────────────────────────────
// Rotas proxy do Next que validam sessão + role ADMIN server-side.

/** Dispara o pipeline manualmente (admin). Retorna o corpo da rota do cron. */
export async function runDailyPipeline(): Promise<RunPipelineResult> {
  const response = await fetch('/api/admin/run-pipeline', { method: 'POST' });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<RunPipelineResult>;
}

/**
 * Métricas do pipeline (admin). Passa pelo proxy porque
 * `GET /api/metrics/dashboard` exige JWT com role ADMIN — o dado é operacional
 * e deixou de ser público na V2.
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await fetchWebApi<ApiResponse<DashboardMetrics>>(
    '/api/admin/metrics',
  );
  return res.data;
}

/** Remove uma notícia (admin). */
export async function deleteNewsAdmin(id: string): Promise<DeleteNewsResult> {
  const response = await fetch(`/api/admin/news/${id}`, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const res = (await response.json()) as ApiResponse<DeleteNewsResult>;
  return res.data;
}
