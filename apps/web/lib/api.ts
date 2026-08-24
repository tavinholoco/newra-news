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
import {
  API_TIMEOUT_MS,
  BFF_TIMEOUT_MS,
  PIPELINE_TRIGGER_TIMEOUT_MS,
} from '@/lib/timeouts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * A falha de uma chamada à API, **com a diferença que decide a tela**.
 *
 * Antes desta fase o `fetchApi` lançava um `Error` de texto corrido, e nenhum
 * chamador conseguia separar *"a API respondeu que não existe"* de *"a API não
 * respondeu"*. Sem essa distinção, todos os quatro pontos que a revisão 10.4
 * auditou colapsavam no pessimista, e cada um de um jeito diferente:
 *
 * - a **Home** desenhava "sem notícias hoje" e a ISR guardava essa página por
 *   uma hora — a mesma classe de defeito que pôs as oito categorias zeradas na
 *   `/news`, agora na tela mais vista;
 * - `/news/[id]` e `/article/[date]` chamavam `notFound()`, então um soluço da
 *   API virava **404 numa matéria que existe** — cacheado por uma hora e visto
 *   também pelo buscador;
 * - o cancelamento da newsletter dizia **"link inválido"** para quem só tinha
 *   pegado a API dormindo. Dizer a alguém que o link de descadastro dele não
 *   presta é o erro mais caro desta lista.
 *
 * `status === null` é o caso de transporte: DNS, conexão recusada, TLS. Não é
 * "não existe", é "não deu para perguntar".
 */
export class ApiError extends Error {
  readonly status: number | null;
  /**
   * O erro de rede original, quando houve um.
   *
   * Campo próprio e não a opção `cause` do `Error`: o `lib` do TypeScript aqui
   * é ES2017, onde `ErrorOptions` não existe. Guardar à mão custa uma linha e
   * mantém o rastro para o log do servidor.
   */
  readonly cause?: unknown;

  constructor(message: string, status: number | null, cause?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.cause = cause;
  }

  /** A API respondeu, e a resposta foi "não existe". */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  /**
   * A API respondeu que o **pedido** não serve — 404 porque o recurso não
   * existe, 400 porque o identificador não é sequer válido.
   *
   * Os dois casos são a mesma coisa para quem está lendo: `/news/banana` não é
   * uma matéria. Foi medido contra a API: id fora do formato UUID devolve
   * **400** com o erro do Zod, e UUID válido sem linha devolve **404**.
   * Tratar só o 404 mandaria a URL digitada errada para a página de erro — que
   * responde 200 e diria "algo deu errado" onde o certo é "não encontrada",
   * inclusive para o buscador.
   */
  get isAboutTheRequest(): boolean {
    return this.status === 404 || this.status === 400;
  }

  /** Não houve resposta. */
  get isUnreachable(): boolean {
    return this.status === null;
  }
}

/**
 * `null` quando o recurso **de fato** não pode existir; relança o resto.
 *
 * A linha é entre *"o pedido não se sustenta"* (4xx sobre o próprio recurso) e
 * *"o servidor não conseguiu responder"* (5xx, ou nenhuma resposta). O primeiro
 * é uma página de "não encontrada"; o segundo é uma página de erro — e, numa
 * rota com ISR, é o que faz o Next manter a página boa anterior no ar em vez de
 * assar um 404 sobre uma matéria que existe.
 *
 * Passar por aqui é obrigatório em qualquer `catch` que alimente um
 * `notFound()`: a guarda `tests/lib/api-failure.test.ts` reprova o
 * `.catch(() => null)` cru.
 */
export function nullIfNotFound(error: unknown): null {
  if (error instanceof ApiError && error.isAboutTheRequest) return null;
  throw error;
}

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      // O prazo do servidor do Next para a API. Sem ele, uma API dormindo ou
      // pendurada segurava a função até o limite da Vercel, e a tela era uma
      // página que nunca respondia — ver `lib/timeouts.ts` para os números.
      signal: options?.signal ?? AbortSignal.timeout(API_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch (cause) {
    // Estourar o prazo cai aqui, e vira `status: null` — "não houve resposta",
    // que é literalmente o que aconteceu. É o que faz a Home manter a última
    // página boa em vez de assar "sem notícias hoje" por uma hora, e o detalhe
    // não virar 404 sobre uma matéria que existe.
    throw new ApiError(`API unreachable: ${endpoint}`, null, cause);
  }

  if (!response.ok) {
    throw new ApiError(
      `API error: ${response.status} ${response.statusText}`,
      response.status,
    );
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

/**
 * `null` quando não há backend configurado; **relança onde o resultado é
 * publicado**.
 *
 * Existe por causa de uma diferença que a revisão 10.4 só viu quando o CI
 * reprovou. Tirar o `catch` da Home é a correção certa — sem ele, uma falha da
 * API vira build vermelho em vez de uma Home dizendo "sem notícias hoje" e
 * guardada por uma hora pela ISR. **Mas "build" não é uma coisa só:**
 *
 * - o **build da Vercel** recebe `NEXT_PUBLIC_API_URL` e produz o que vai ao
 *   ar. Ali, falhar é o comportamento desejado: a Vercel preserva o deploy
 *   anterior, e o `CLAUDE.md` já registra que os deploys do web e da API
 *   disparam juntos e não terminam juntos;
 * - o **build do CI** roda sem API nenhuma, de propósito — o `CLAUDE.md`
 *   afirma que `build` não precisa de banco, como `lint` e `typecheck`. Ali
 *   ele só confere que o projeto compila, e nada é publicado.
 *
 * `VERCEL` é a variável de sistema que separa os dois, e ela vale também em
 * **runtime**: na revalidação da ISR a exceção sobe, o Next mantém a última
 * página boa no ar e tenta de novo. É esse o caso que mais importa, porque é o
 * único que acontece com gente lendo.
 *
 * Só para o valor que **é a tela inteira**. Bloco que falta é estado normal e
 * continua com `prefetch` (que falha em `undefined`, nunca em valor vazio).
 */
export async function nullUnlessPublishing<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (process.env.VERCEL) throw error;
    return null;
  }
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
 *
 * **`getLatestArticle` saiu na revisão 10.4.** Ela e o `useLatestArticle`
 * existiam desde a V1 e nenhuma tela as chamava: a Home resolve tudo por
 * `getHome()`. O que sobrou delas foi um `try { } catch { return null }` que
 * apagava qualquer falha — inclusive a de transporte —, ou seja, exatamente o
 * padrão que esta revisão foi caçar, mantido vivo por código morto.
 */
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
  let response: Response;

  try {
    response = await fetch(endpoint, {
      ...options,
      // O prazo **de fora**, e ele é maior que o de dentro de propósito: assim
      // quem desiste primeiro é sempre o BFF, que ainda está vivo para devolver
      // um status. Se os dois estourassem juntos, o navegador ficaria com uma
      // requisição abortada — sem status, sem corpo, nada a dizer na tela.
      signal: options?.signal ?? AbortSignal.timeout(BFF_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch (cause) {
    throw new ApiError(`BFF unreachable: ${endpoint}`, null, cause);
  }

  if (!response.ok) {
    throw new ApiError(
      `API error: ${response.status} ${response.statusText}`,
      response.status,
    );
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

/**
 * Dispara o pipeline manualmente (admin). Retorna o corpo da rota do cron.
 *
 * **Passava por `fetch` cru e lançava `Error` de texto corrido**, como o
 * `deleteNewsAdmin` abaixo — as duas únicas chamadas do web que ficaram de fora
 * quando o `ApiError` nasceu, porque não respondem no envelope `{ data }`. Sem
 * timeout e sem status, elas eram exatamente o par de pontos que a revisão 10.4
 * corrigiu no resto do app. Agora usam o mesmo cliente.
 *
 * O prazo é o do disparo, não o da execução: a rota responde
 * `{ status: 'started' }` e o pipeline segue no servidor.
 */
export async function runDailyPipeline(): Promise<RunPipelineResult> {
  return fetchWebApi<RunPipelineResult>('/api/admin/run-pipeline', {
    method: 'POST',
    signal: AbortSignal.timeout(PIPELINE_TRIGGER_TIMEOUT_MS),
  });
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
  const res = await fetchWebApi<ApiResponse<DeleteNewsResult>>(
    `/api/admin/news/${id}`,
    { method: 'DELETE' },
  );
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
