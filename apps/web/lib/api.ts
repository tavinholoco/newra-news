import type {
  News,
  Article,
  ArticleWithSources,
  PaginatedResponse,
  ApiResponse,
  DashboardMetrics,
  Subscriber,
  FavoriteWithNews,
  AddedFavorite,
  RunPipelineResult,
  DeleteNewsResult,
  HomeResponse,
  EditorialStory,
  TrendingWindow,
  NewsFilters,
  NewsFacets,
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

/**
 * Query string das dimensões de filtro, sem paginação.
 *
 * A listagem e as facetas mandam exatamente os mesmos parâmetros — é o que faz
 * a contagem do chip bater com a lista que ele abre. Campo vazio some da URL em
 * vez de virar `&search=`: string vazia é filtro, e filtrar por nada devolveria
 * o acervo inteiro sob uma chave de cache diferente.
 */
function newsFilterParams(filters: NewsFilters = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.search) params.set('search', filters.search);
  if (filters.source) params.set('source', filters.source);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  // `recent` é o default do backend: mandá-lo explicitamente só criaria duas
  // chaves de cache para a mesma resposta.
  if (filters.sort && filters.sort !== 'recent') params.set('sort', filters.sort);

  return params;
}

/**
 * Prefetch de server component que **falha em `undefined`, nunca em um
 * resultado vazio**.
 *
 * Isto custou uma tela errada em produção. O build da Vercel correu antes de o
 * deploy da API subir a rota de facetas; o `.catch(() => ({ ... vazio }))` da
 * `/news` devolveu `{ categories: [], sources: [] }`, e essa é uma **afirmação**
 * — "o acervo tem zero matérias em cada categoria" — que foi ao ar como
 * `initialData` de uma query com `staleTime` de 5 minutos. O TanStack Query a
 * considerou fresca e nunca buscou de novo: todo visitante via as oito pílulas
 * zeradas ao lado de "5.783 notícias".
 *
 * `undefined` é a outra coisa: "não medido". A query busca no cliente, e a tela
 * desenha o esqueleto até chegar — que é o que ela já sabe fazer.
 *
 * Vale para todo prefetch cujo resultado vira `initialData`. Onde o valor é só
 * renderizado no servidor, sem query atrás, `.catch(() => null)` continua certo:
 * ali `null` já significa ausência e a tela desenha o estado vazio.
 */
export async function prefetch<T>(promise: Promise<T>): Promise<T | undefined> {
  return promise.catch(() => undefined);
}

export async function getNews(
  page = 1,
  limit = 12,
  filters: NewsFilters = {},
): Promise<PaginatedResponse<News>> {
  const params = newsFilterParams(filters);
  params.set('page', String(page));
  params.set('limit', String(limit));

  return fetchApi<PaginatedResponse<News>>(`/news?${params.toString()}`);
}

/**
 * Contagem por categoria e por fonte do acervo sob o recorte atual.
 *
 * Chamada à parte da listagem de propósito: as facetas não mudam ao virar a
 * página, e juntas na mesma resposta seriam recalculadas a cada paginação.
 */
export async function getNewsFacets(
  filters: NewsFilters = {},
): Promise<NewsFacets> {
  const query = newsFilterParams(filters).toString();
  const res = await fetchApi<ApiResponse<NewsFacets>>(
    `/news/facets${query ? `?${query}` : ''}`,
  );
  return res.data;
}

export async function getNewsById(id: string): Promise<News> {
  const res = await fetchApi<ApiResponse<News>>(`/news/${id}`);
  return res.data;
}

/**
 * Os endpoints de **detalhe** devolvem `ArticleWithSources`: o artigo mais a
 * lista de notícias que entraram no briefing, que é o que a §8 exibe na área
 * "como este briefing foi produzido". A listagem paginada devolve `Article`
 * puro — ~15 fontes por artigo × 10 por página seria peso morto.
 */
export async function getLatestArticle(): Promise<ArticleWithSources | null> {
  try {
    const res = await fetchApi<ApiResponse<ArticleWithSources>>('/articles/latest');
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

export async function getArticleByDate(date: string): Promise<ArticleWithSources> {
  const res = await fetchApi<ApiResponse<ArticleWithSources>>(`/articles/${date}`);
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

// ── Editorial (V2) ─────────────────────────────────────────────────────
// Endpoints da Fase 0.5. A Home consome **um** deles: `/api/home` já traz
// hero, briefing, top stories, trending, categorias e latest numa resposta só,
// sem repetir notícia entre blocos.

/**
 * Resposta agregada da Home (§3 dos contratos da V2).
 *
 * `categories` é quantas *seções* por categoria voltar, não quantas matérias —
 * o default do backend é 4 e o teto, 8.
 */
export async function getHome(categories?: number): Promise<HomeResponse> {
  const params = new URLSearchParams();
  if (categories !== undefined) params.set('categories', String(categories));

  const query = params.toString();
  const res = await fetchApi<ApiResponse<HomeResponse>>(
    `/home${query ? `?${query}` : ''}`,
  );
  return res.data;
}

/**
 * Ranking de alta (§4 dos contratos). A Home **não** chama isto — o bloco dela
 * sai de `getHome().trending`, que já respeita a precedência entre blocos.
 * Existe para telas que mostram o ranking isolado.
 */
export async function getTrending(
  limit = 5,
  window: TrendingWindow = '24h',
): Promise<EditorialStory[]> {
  const params = new URLSearchParams({ limit: String(limit), window });
  const res = await fetchApi<ApiResponse<EditorialStory[]>>(
    `/trending?${params.toString()}`,
  );
  return res.data;
}
