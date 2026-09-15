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
  ErrorSummaryWindow,
} from '@newranews/types';
import {
  getNews,
  getNewsFacets,
  getNewsById,
  getArticles,
  getArticleByDate,
  getDashboardMetrics,
  getProductMetrics,
  getAccount,
  updatePreferences,
  updateNewsletterSubscription,
  getFavorites,
  getFavoriteIds,
  addFavorite,
  removeFavorite,
  runDailyPipeline,
  deleteNewsAdmin,
  getPipelineRuns,
  getPipelineRunDetail,
  getHttpMetrics,
  getErrorSummary,
  getAuditTrail,
} from '@/lib/api';
import { OUTCOME_WINDOW_DAYS } from '@/lib/outcome-days';

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
};

export const metricsKeys = {
  all: ['metrics'] as const,
  dashboard: () => [...metricsKeys.all, 'dashboard'] as const,
};

export const favoritesKeys = {
  all: ['favorites'] as const,
  list: (filters: FavoriteListFilters & { page: number; limit: number }) =>
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

/**
 * Os runs do pipeline — **uma subárvore própria dentro de `['admin']`**, ao lado
 * de `adminKeys.newsList()`.
 *
 * A distinção importa porque o TanStack Query invalida **por prefixo**:
 * `['admin']` alcança as duas, `['admin', 'pipeline']` alcança só esta. Por isso
 * o disparo do pipeline invalida a chave estreita — recarregar a lista de
 * notícias junto seria uma consulta jogada fora, já que o disparo não a muda.
 */
export const pipelineKeys = {
  all: ['admin', 'pipeline'] as const,
  runs: (limit: number) => [...pipelineKeys.all, 'runs', limit] as const,
  detail: (pipelineId: string) =>
    [...pipelineKeys.all, 'detail', pipelineId] as const,
};

/**
 * As três leituras de observabilidade da Fase 5 (PR 5c), cada uma na sua
 * subárvore de `['admin']` — pelo mesmo motivo de `pipelineKeys`: invalidar
 * uma não recarrega as outras.
 *
 * A janela entra na chave onde há janela (`errors`, `audit`), senão trocar de
 * 24 h para 7 d mostraria a contagem anterior enquanto a nova não chega — e
 * quem lê concluiria que a semana teve os mesmos erros que o dia.
 */
export const observabilityKeys = {
  http: () => [...adminKeys.all, 'http-metrics'] as const,
  errors: (window: ErrorSummaryWindow) => [...adminKeys.all, 'errors', window] as const,
  audit: (days: number) => [...adminKeys.all, 'audit', days] as const,
};

// ── News Hooks ───────────────────────────────────────────────────────

export function useNewsList(
  filters: NewsListFilters,
  initialData?: PaginatedResponse<News>,
  enabled = true,
) {
  const { page, limit, ...rest } = filters;

  return useQuery({
    queryKey: newsKeys.list(filters),
    queryFn: () => getNews(page, limit, rest),
    initialData,
    placeholderData: keepPreviousData,
    enabled,
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

// ── Metrics Hooks ───────────────────────────────────────────────────────

export function useDashboardMetrics(initialData?: DashboardMetrics) {
  return useQuery({
    queryKey: metricsKeys.dashboard(),
    queryFn: () => getDashboardMetrics(),
    initialData,
  });
}

/**
 * Métricas de produto.
 *
 * **A janela entra na chave**, senão trocar de 30 para 7 dias mostraria o
 * número anterior enquanto a consulta nova não resolve — e o leitor
 * concluiria que a janela menor tem o mesmo volume.
 */
export function useProductMetrics(days: number) {
  return useQuery({
    queryKey: [...metricsKeys.dashboard(), 'product', days],
    queryFn: () => getProductMetrics(days),
  });
}

// ── Favorites Hooks ───────────────────────────────────────────────────

const FAVORITES_LIMIT = 100;

/**
 * Os salvos do leitor.
 *
 * A tela "Salvos" pede tudo de uma vez (`FAVORITES_LIMIT`); a `/news` com
 * "somente salvos" ligado pede a página que está sendo lida, com o mesmo
 * tamanho do acervo — é a mesma rota servindo as duas.
 */
export function useFavorites(
  filters: FavoriteListFilters = {},
  { page = 1, limit = FAVORITES_LIMIT, enabled = true } = {},
) {
  return useQuery({
    queryKey: favoritesKeys.list({ ...filters, page, limit }),
    queryFn: () => getFavorites(page, limit, filters),
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
      queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
      // A tela de conta anuncia quantos itens estão salvos. Sem isto, salvar
      // uma matéria e voltar para lá mostraria o número de antes.
      queryClient.invalidateQueries({ queryKey: accountKeys.overview() });
    },
  });
}

// ── Admin Hooks ───────────────────────────────────────────────────────────

/**
 * Dispara o pipeline manualmente (admin) e **recarrega a lista de runs**.
 *
 * A invalidação não é enfeite: o painel põe o histórico logo abaixo do botão,
 * e sem ela o clique confirmava o disparo com a lista ainda mostrando o run de
 * ontem — a tela dizendo uma coisa na primeira seção e outra na segunda, que é
 * a família do defeito de 25/08 ("Pipeline disparado com sucesso" sem ter
 * disparado nada) em outra forma.
 *
 * Invalida `pipelineKeys.all` e não `adminKeys.all`: o disparo não muda a lista
 * de notícias, e recarregá-la seria uma consulta jogada fora.
 */
export function useRunPipeline() {
  const queryClient = useQueryClient();

  return useMutation<RunPipelineResult, Error>({
    mutationFn: () => runDailyPipeline(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pipelineKeys.all });
    },
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

/**
 * Quantos runs a consulta pede: a janela da faixa de desfechos inteira, com
 * folga para mais de um run por dia (o cron e um disparo manual). É o teto do
 * `limit` da rota, e cabe: a etapa 8 apaga `PipelineLog` aos 30 dias, então a
 * tabela inteira raramente passa de ~40 linhas.
 */
export const PIPELINE_RUNS_LIMIT = 100;

/**
 * Os últimos runs do pipeline, mais os que falharam — **a janela de 30 dias
 * inteira, numa requisição** (Fase 8).
 *
 * A lista mostra as últimas 20 (`PIPELINE_RUNS_SHOWN`, no componente); a faixa de desfechos precisa
 * de todos os runs da janela para dizer qual dia não rodou. Uma consulta serve
 * as duas leituras, e é o `OUTCOME_WINDOW_DAYS` que define o `since`: a faixa
 * e a listagem falam do mesmo recorte por construção.
 *
 * **Sem `refetchInterval`, e é decisão medida.** Aba de admin deixada aberta
 * com polling é tráfego constante contra um plano que cobra tempo ligado: o
 * free do Render dá 750 h/mês, e esta API já foi suspensa uma vez por isso em
 * 29/08/2026, com três briefings perdidos. O pipeline roda **uma vez por dia**
 * — o dado desta tela muda uma vez a cada 24 h, e recarregar a página é o gesto
 * certo para vê-lo. Se um dia houver polling aqui, ele pede
 * `refetchIntervalInBackground: false`.
 */
export function usePipelineRuns(limit = PIPELINE_RUNS_LIMIT) {
  return useQuery({
    queryKey: pipelineKeys.runs(limit),
    queryFn: () => getPipelineRuns({ since: OUTCOME_WINDOW_DAYS, limit }),
  });
}

/**
 * O detalhe de um run — os ~19 eventos daquele dia, agrupados por etapa.
 *
 * **Não tem `enabled`, e é o componente quem decide.** Quem chama só monta a
 * linha expandida do run que alguém abriu — a lista mostra 20, e carregar o
 * diário das 20 seriam 20 requisições para ler uma. Um `enabled` aqui, sobre um
 * id que já chega definido, seria um controle sem consequência: um segundo lugar
 * a manter, protegendo um caso que não existe.
 */
export function usePipelineRunDetail(pipelineId: string) {
  return useQuery({
    queryKey: pipelineKeys.detail(pipelineId),
    queryFn: () => getPipelineRunDetail(pipelineId),
  });
}

// ── Observabilidade (Fase 5 do plano, PR 5c) ──────────────────────────────
// **Nenhum dos três tem `refetchInterval`**, e é a mesma decisão medida do
// `usePipelineRuns`: aba de admin aberta com polling é tráfego constante contra
// um plano que cobra tempo ligado (armadilha 3 do §17). Recarregar a página é o
// gesto — e é o único que existe, de propósito.

/**
 * Os quatro sinais de ouro. A mesma chave serve o arco da `/admin` e o painel
 * de sinais da `/admin/metrics`: quem abrir as duas abas na mesma sessão faz
 * uma requisição, não duas.
 */
export function useHttpMetrics() {
  return useQuery({
    queryKey: observabilityKeys.http(),
    queryFn: () => getHttpMetrics(),
  });
}

/** As falhas registradas na janela, agrupadas por fingerprint. */
export function useErrorSummary(window: ErrorSummaryWindow) {
  return useQuery({
    queryKey: observabilityKeys.errors(window),
    queryFn: () => getErrorSummary(window),
    // Trocar a janela mantém a tabela anterior no lugar enquanto a nova chega —
    // sem isto ela pisca para o esqueleto e volta, e os filtros perdem o foco.
    placeholderData: keepPreviousData,
  });
}

/** Quantas linhas da trilha a tela pede. Abaixo do teto da API (200). */
export const AUDIT_TRAIL_LIMIT = 100;

/** A trilha de ação de admin na janela, mais recente primeiro. */
export function useAuditTrail(days: number) {
  return useQuery({
    queryKey: observabilityKeys.audit(days),
    queryFn: () => getAuditTrail({ days, limit: AUDIT_TRAIL_LIMIT }),
    placeholderData: keepPreviousData,
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
