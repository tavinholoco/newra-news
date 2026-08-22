import type {
  News,
  Article,
  ArticleWithSources,
  PaginatedResponse,
  ApiResponse,
  DashboardMetrics,
  ProductMetrics,
  Subscriber,
  FavoriteWithItem,
  FavoriteIds,
  FavoriteItemType,
  SavedFavorite,
  AccountOverview,
  UserPreferences,
  NewsletterStatus,
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

/**
 * Os salvos do leitor — a mesma rota que a tela "Salvos" e o "somente salvos"
 * do acervo usam, com **as mesmas dimensões de filtro da `/news`**.
 *
 * `newsFilterParams` é o mesmo helper da listagem pública, e não uma cópia: é o
 * que garante que ligar "somente salvos" não mude o significado de nenhum outro
 * controle da tela.
 */
export async function getFavorites(
  page = 1,
  limit = 100,
  filters: NewsFilters & { type?: FavoriteItemType } = {},
): Promise<PaginatedResponse<FavoriteWithItem>> {
  const { type, ...newsFilters } = filters;
  const params = newsFilterParams(newsFilters);
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (type) params.set('type', type);

  return fetchWebApi<PaginatedResponse<FavoriteWithItem>>(
    `/api/favorites?${params.toString()}`,
  );
}

/**
 * Só os ids do que está salvo.
 *
 * O botão de salvar precisa de uma resposta por item, e a alternativa era
 * baixar os favoritos com conteúdo e procurar no cliente — o que fazia o
 * coração mentir a partir do 101º favorito.
 */
export async function getFavoriteIds(): Promise<FavoriteIds> {
  const res = await fetchWebApi<ApiResponse<FavoriteIds>>('/api/favorites/ids');
  return res.data;
}

export async function addFavorite(
  itemType: FavoriteItemType,
  itemId: string,
): Promise<SavedFavorite> {
  const res = await fetchWebApi<ApiResponse<SavedFavorite>>('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ itemType, itemId }),
  });
  return res.data;
}

export async function removeFavorite(
  itemType: FavoriteItemType,
  itemId: string,
): Promise<{ removed: boolean }> {
  const res = await fetchWebApi<ApiResponse<{ removed: boolean }>>(
    `/api/favorites/${itemType.toLowerCase()}/${itemId}`,
    { method: 'DELETE' },
  );
  return res.data;
}

// ── Conta ──────────────────────────────────────────────────────────────
// Também por rota proxy: resposta por usuário, e por isso sem cache nenhum.

/** Perfil, preferências, inscrição e contagem de salvos numa chamada só. */
export async function getAccount(): Promise<AccountOverview> {
  const res = await fetchWebApi<ApiResponse<AccountOverview>>('/api/account');
  return res.data;
}

/** Campo ausente não é campo apagado — o `PUT` grava só o que recebe. */
export async function updatePreferences(
  input: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const res = await fetchWebApi<ApiResponse<UserPreferences>>(
    '/api/account/preferences',
    { method: 'PUT', body: JSON.stringify(input) },
  );
  return res.data;
}

export async function updateNewsletterSubscription(
  subscribed: boolean,
): Promise<NewsletterStatus> {
  const res = await fetchWebApi<ApiResponse<NewsletterStatus>>(
    '/api/account/newsletter',
    { method: 'PUT', body: JSON.stringify({ subscribed }) },
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

/**
 * Métricas de **produto**. O dashboard acima mede o pipeline; esta lê o
 * `ProductEvent` — comportamento de gente.
 */
export async function getProductMetrics(days = 30): Promise<ProductMetrics> {
  const res = await fetchWebApi<ApiResponse<ProductMetrics>>(
    `/api/admin/product-metrics?days=${days}`,
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
 * Relacionadas de uma notícia (§5 dos contratos, §9 do plano).
 *
 * Devolve lista vazia em qualquer falha, e **não** lança: a seção "leia
 * também" é complementar ao artigo. Derrubar a página inteira porque o bloco do
 * rodapé não carregou trocaria um problema pequeno por um grande.
 */
export async function getRelatedNews(
  id: string,
  limit = 4,
): Promise<EditorialStory[]> {
  try {
    const res = await fetchApi<ApiResponse<EditorialStory[]>>(
      `/news/${id}/related?limit=${limit}`,
    );
    return res.data;
  } catch {
    return [];
  }
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
