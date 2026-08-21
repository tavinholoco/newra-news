import { prisma } from '@newranews/database';
import type { Category, Prisma } from '@newranews/database';

/** Ordenação do acervo. `recent` é o padrão histórico da listagem. */
export type NewsSort = 'recent' | 'oldest';

export interface ListNewsFilters {
  category?: Category;
  search?: string;
  /** Dia exato (ISO). Mantido por compatibilidade com quem já chamava assim. */
  date?: string;
  /** Início do período (ISO), inclusivo. */
  from?: string;
  /** Fim do período (ISO), inclusivo. */
  to?: string;
  source?: string;
}

interface ListNewsPagination {
  page: number;
  limit: number;
  sort?: NewsSort;
}

/** Um dia em milissegundos — a janela que o filtro `date` cobre. */
const ONE_DAY_MS = 86_400_000;

/**
 * O `where` da listagem, montado uma vez só.
 *
 * Existe separado porque as **facetas** precisam exatamente do mesmo predicado,
 * menos a dimensão que estão contando (`omit`). Duplicar a montagem foi o que
 * quase aconteceu aqui: a contagem por categoria ignorando o período daria
 * números que não batem com a lista logo abaixo dela, e ninguém veria o erro —
 * os dois lados renderizam sem reclamar.
 */
export function buildNewsWhere(
  filters: ListNewsFilters,
  omit?: 'category' | 'source',
): Prisma.NewsWhereInput {
  const publishedAt = buildPublishedAtRange(filters);

  return {
    ...(filters.category && omit !== 'category' && { category: filters.category }),
    ...(filters.source &&
      omit !== 'source' && {
        source: { equals: filters.source, mode: 'insensitive' as const },
      }),
    ...(filters.search && {
      OR: [
        { title: { contains: filters.search, mode: 'insensitive' as const } },
        { description: { contains: filters.search, mode: 'insensitive' as const } },
      ],
    }),
    ...(publishedAt && { publishedAt }),
  };
}

/**
 * `date` (dia exato) e `from`/`to` (período) colapsam na mesma faixa.
 *
 * `date` veio primeiro e continua valendo; `from`/`to` é o que o filtro de
 * período da §7 escreve. Quando os dois chegam, o período ganha — é o controle
 * que o leitor acabou de mexer.
 */
function buildPublishedAtRange(
  filters: ListNewsFilters,
): Prisma.DateTimeFilter | undefined {
  if (filters.from || filters.to) {
    return {
      ...(filters.from && { gte: new Date(filters.from) }),
      ...(filters.to && { lte: new Date(filters.to) }),
    };
  }

  if (filters.date) {
    const start = new Date(filters.date);
    return { gte: start, lt: new Date(start.getTime() + ONE_DAY_MS) };
  }

  return undefined;
}

export async function listNews(
  filters: ListNewsFilters,
  pagination: ListNewsPagination,
) {
  const { page, limit, sort = 'recent' } = pagination;
  const skip = (page - 1) * limit;
  const where = buildNewsWhere(filters);

  const [data, total] = await Promise.all([
    prisma.news.findMany({
      where,
      orderBy: { publishedAt: sort === 'oldest' ? 'asc' : 'desc' },
      skip,
      take: limit,
    }),
    prisma.news.count({ where }),
  ]);

  return { data, total };
}

export interface NewsFacetsResult {
  /** Total do acervo com **todos** os filtros aplicados. */
  total: number;
  categories: Array<{ category: Category; count: number }>;
  sources: Array<{ source: string; count: number }>;
}

/** Quantas fontes o filtro oferece. Além disso a lista deixa de ser escaneável. */
const SOURCE_FACET_LIMIT = 30;

/**
 * Contagem por categoria e por fonte para os controles de filtro (§7).
 *
 * **Cada faceta ignora a própria dimensão.** A contagem por categoria não
 * aplica o filtro de categoria, senão a categoria escolhida mostraria o seu
 * número e as outras sete zerariam — o leitor perderia justamente a informação
 * que o faz trocar de categoria. O mesmo vale para fonte. As demais dimensões
 * (busca, período) valem para as duas, porque elas restringem o universo do
 * qual se está escolhendo.
 */
export async function getNewsFacets(
  filters: ListNewsFilters,
): Promise<NewsFacetsResult> {
  const [total, categories, sources] = await Promise.all([
    prisma.news.count({ where: buildNewsWhere(filters) }),
    prisma.news.groupBy({
      by: ['category'],
      where: buildNewsWhere(filters, 'category'),
      _count: { _all: true },
    }),
    prisma.news.groupBy({
      by: ['source'],
      where: buildNewsWhere(filters, 'source'),
      _count: { _all: true },
      orderBy: { _count: { source: 'desc' } },
      take: SOURCE_FACET_LIMIT,
    }),
  ]);

  return {
    total,
    categories: categories
      .map((row) => ({ category: row.category, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    sources: sources.map((row) => ({
      source: row.source,
      count: row._count._all,
    })),
  };
}

export async function getNewsById(id: string) {
  return prisma.news.findUnique({ where: { id } });
}

/**
 * Remove uma notícia (admin). Retorna false se o id não existir — sem lançar,
 * para a rota traduzir em 404. Favoritos sem FK não são removidos (padrão do
 * schema); ficam órfãos e são ignorados na listagem via join.
 */
export async function deleteNews(id: string): Promise<boolean> {
  const { count } = await prisma.news.deleteMany({ where: { id } });
  return count > 0;
}
