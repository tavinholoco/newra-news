import { Category, type NewsFilters, type NewsSort } from '@newranews/types';

/**
 * Períodos oferecidos pelo filtro (§7).
 *
 * São rótulos e não um par de datas na URL de propósito: `?period=7d` é
 * compartilhável e continua significando "os últimos sete dias" amanhã, o que
 * `?from=2026-08-14` deixa de significar. O par de datas ainda existe — é o
 * que vai para a API —, mas é derivado, não digitado.
 */
export const NEWS_PERIODS = ['all', 'today', '7d', '30d'] as const;
export type NewsPeriod = (typeof NEWS_PERIODS)[number];

const PERIOD_DAYS: Record<Exclude<NewsPeriod, 'all'>, number> = {
  today: 0,
  '7d': 6,
  '30d': 29,
};

/** O estado completo da tela de acervo, do jeito que a URL o carrega. */
export interface NewsFilterState {
  category: Category | null;
  search: string;
  source: string | null;
  period: NewsPeriod;
  sort: NewsSort;
  /**
   * "Somente salvos" (§7).
   *
   * É filtro como os outros — mora na URL, zera a página e entra na contagem
   * de ativos —, mas com uma diferença: ele **troca a fonte de dados**. O
   * acervo público não sabe quem está pedindo; a lista de salvos é por usuário
   * e vem pela rota autenticada. Por isso ele não entra em `toApiFilters`.
   */
  saved: boolean;
  page: number;
}

export const DEFAULT_NEWS_FILTERS: NewsFilterState = {
  category: null,
  search: '',
  source: null,
  period: 'all',
  sort: 'recent',
  saved: false,
  page: 1,
};

/**
 * Início do período, ancorado na **meia-noite UTC**.
 *
 * Não é preciosismo de fuso: ancorar em `Date.now()` cru faria o `from` mudar a
 * cada milissegundo, e ele entra na chave de cache do TanStack Query e na URL
 * da API. Cada render viraria uma consulta nova e o CDN nunca acertaria. Com a
 * âncora no dia, a chave é estável por 24h.
 */
export function periodStart(period: NewsPeriod, now = new Date()): string | undefined {
  if (period === 'all') return undefined;

  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  start.setUTCDate(start.getUTCDate() - PERIOD_DAYS[period]);

  return start.toISOString();
}

function isCategory(value: string | null): value is Category {
  return value !== null && value in Category;
}

function isPeriod(value: string | null): value is NewsPeriod {
  return value !== null && (NEWS_PERIODS as readonly string[]).includes(value);
}

/**
 * A URL para o estado da tela.
 *
 * Valor desconhecido cai no default em silêncio em vez de virar erro: a query
 * string é editável por qualquer um, e `?category=BANANA` deve mostrar o acervo
 * inteiro, não uma tela quebrada.
 */
export function readNewsFilters(params: URLSearchParams): NewsFilterState {
  const category = params.get('category');
  const period = params.get('period');
  const sort = params.get('sort');
  const page = Number.parseInt(params.get('page') ?? '', 10);

  return {
    category: isCategory(category) ? category : null,
    search: params.get('search') ?? '',
    source: params.get('source') || null,
    period: isPeriod(period) ? period : 'all',
    sort: sort === 'oldest' ? 'oldest' : 'recent',
    saved: params.get('saved') === '1',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/**
 * O estado da tela para a URL — só o que difere do default.
 *
 * `/news` limpa tem de ser `/news`, e não `/news?category=&period=all&page=1`:
 * é a URL que a `editorial-nav` aponta, a que entra no sitemap e a que o leitor
 * copia. Um parâmetro redundante também partiria o cache em duas entradas para
 * a mesma tela.
 */
export function writeNewsFilters(state: NewsFilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.category) params.set('category', state.category);
  if (state.search) params.set('search', state.search);
  if (state.source) params.set('source', state.source);
  if (state.period !== 'all') params.set('period', state.period);
  if (state.sort !== 'recent') params.set('sort', state.sort);
  if (state.saved) params.set('saved', '1');
  if (state.page > 1) params.set('page', String(state.page));

  return params;
}

/** O recorte que a API recebe — `period` já resolvido em data. */
export function toApiFilters(
  state: NewsFilterState,
  now = new Date(),
): NewsFilters {
  return {
    ...(state.category && { category: state.category }),
    ...(state.search && { search: state.search }),
    ...(state.source && { source: state.source }),
    ...(periodStart(state.period, now) && { from: periodStart(state.period, now) }),
    sort: state.sort,
  };
}

/**
 * Quantos filtros estão ativos — o número que o botão "limpar filtros" mostra.
 *
 * `page` e `sort` ficam de fora: virar a página não é filtrar, e ordenação não
 * esconde matéria nenhuma. Contá-los faria "3 filtros ativos" aparecer numa
 * tela que mostra o acervo inteiro.
 */
export function countActiveFilters(state: NewsFilterState): number {
  return [
    state.category,
    state.search,
    state.source,
    state.period !== 'all',
    state.saved,
  ].filter(Boolean).length;
}
