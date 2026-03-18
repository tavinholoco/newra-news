import type {
  News,
  Article,
  Category,
  PaginatedResponse,
  ApiResponse,
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
