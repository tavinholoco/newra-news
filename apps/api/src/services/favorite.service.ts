import { prisma } from '@newranews/database';
import type { FavoriteItemType, Prisma } from '@newranews/database';
import { buildNewsWhere, type ListNewsFilters } from './news.service';

/**
 * Ordenação da lista de salvos.
 *
 * `saved` é a data em que o leitor salvou — é o que a tela "Salvos" quer, e o
 * padrão. `recent`/`oldest` são a data do **conteúdo**, que é o que o controle
 * de ordenação do acervo promete: com "somente salvos" ligado em `/news`, o
 * seletor tem de continuar significando a mesma coisa que significava sem ele.
 */
export type FavoriteSort = 'saved' | 'recent' | 'oldest';

export interface FavoriteFilters extends ListNewsFilters {
  /** Restringe a um tipo. Sem ele, a lista é única e mistura os dois. */
  type?: FavoriteItemType;
}

interface FavoritePagination {
  page: number;
  limit: number;
  sort?: FavoriteSort;
}

/** Os campos do briefing que cabem num card de salvos — não o corpo inteiro. */
const ARTICLE_CARD_SELECT = {
  id: true,
  title: true,
  summary: true,
  date: true,
  newsCount: true,
} satisfies Prisma.ArticleSelect;

type ArticleCard = Prisma.ArticleGetPayload<{ select: typeof ARTICLE_CARD_SELECT }>;
type NewsRecord = Prisma.NewsGetPayload<Record<string, never>>;

interface FavoriteRow {
  id: string;
  itemType: FavoriteItemType;
  itemId: string;
  createdAt: Date;
}

export type FavoriteItem =
  | { id: string; itemType: 'NEWS'; itemId: string; createdAt: Date; news: NewsRecord }
  | {
      id: string;
      itemType: 'ARTICLE';
      itemId: string;
      createdAt: Date;
      article: ArticleCard;
    };

/**
 * `category` e `source` são dimensões que **só a notícia tem**. Quando uma
 * delas está no recorte, briefing nenhum pode satisfazê-lo — e devolver
 * briefings ali seria a lista contradizendo o próprio filtro.
 */
function hasNewsOnlyDimension(filters: FavoriteFilters): boolean {
  return Boolean(filters.category || filters.source);
}

/** O predicado do briefing: busca no título/resumo e o período sobre `date`. */
function buildArticleWhere(filters: FavoriteFilters): Prisma.ArticleWhereInput {
  const date =
    filters.from || filters.to
      ? {
          ...(filters.from && { gte: new Date(filters.from) }),
          ...(filters.to && { lte: new Date(filters.to) }),
        }
      : undefined;

  return {
    ...(filters.search && {
      OR: [
        { title: { contains: filters.search, mode: 'insensitive' as const } },
        { summary: { contains: filters.search, mode: 'insensitive' as const } },
      ],
    }),
    ...(date && { date }),
  };
}

/**
 * Lista os salvos do usuário, com os mesmos filtros do acervo.
 *
 * **Por que a leitura passa pelos favoritos inteiros do usuário.** O favorito
 * mora numa tabela e o conteúdo em duas, então filtrar por dimensão de
 * conteúdo (categoria, fonte, busca, período) obriga a resolver o conjunto
 * antes de paginar. O conjunto é limitado pela conta — são os salvos de uma
 * pessoa —, e em troca o `meta.total` conta **o que a lista consegue mostrar**:
 * favorito cujo conteúdo o cleanup do Stage 8 já apagou não entra na conta nem
 * aparece. Contar a linha do favorito seria prometer um card que nunca vem.
 *
 * A junção com `News` usa o `buildNewsWhere` da listagem — o mesmo predicado,
 * e não uma cópia. É o que faz "somente salvos" filtrar exatamente como o
 * acervo filtra.
 */
export async function listFavorites(
  userId: string,
  filters: FavoriteFilters,
  { page, limit, sort = 'saved' }: FavoritePagination,
) {
  const rows = (await prisma.favorite.findMany({
    where: { userId, ...(filters.type && { itemType: filters.type }) },
    orderBy: { createdAt: 'desc' },
    select: { id: true, itemType: true, itemId: true, createdAt: true },
  })) as FavoriteRow[];

  const newsIds = idsOfType(rows, 'NEWS');
  const articleIds = idsOfType(rows, 'ARTICLE');
  const skipArticles = articleIds.length === 0 || hasNewsOnlyDimension(filters);

  const [matchedNews, matchedArticles] = await Promise.all([
    newsIds.length
      ? prisma.news.findMany({
          where: { id: { in: newsIds }, ...buildNewsWhere(filters) },
          select: { id: true, publishedAt: true },
        })
      : Promise.resolve([]),
    skipArticles
      ? Promise.resolve([])
      : prisma.article.findMany({
          where: { id: { in: articleIds }, ...buildArticleWhere(filters) },
          select: { id: true, date: true },
        }),
  ]);

  const contentDate = new Map<string, Date>([
    ...matchedNews.map((item) => [item.id, item.publishedAt] as const),
    ...matchedArticles.map((item) => [item.id, item.date] as const),
  ]);

  const matched = rows
    .filter((row) => contentDate.has(row.itemId))
    .map((row) => ({ row, contentDate: contentDate.get(row.itemId) as Date }));

  if (sort !== 'saved') {
    matched.sort((a, b) =>
      sort === 'oldest'
        ? a.contentDate.getTime() - b.contentDate.getTime()
        : b.contentDate.getTime() - a.contentDate.getTime(),
    );
  }

  const skip = (page - 1) * limit;
  const pageRows = matched.slice(skip, skip + limit).map((entry) => entry.row);

  return { data: await hydrate(pageRows), total: matched.length };
}

function idsOfType(rows: FavoriteRow[], type: FavoriteItemType): string[] {
  return rows.filter((row) => row.itemType === type).map((row) => row.itemId);
}

/** Busca o conteúdo só dos itens da página — nunca do conjunto inteiro. */
async function hydrate(rows: FavoriteRow[]): Promise<FavoriteItem[]> {
  const newsIds = idsOfType(rows, 'NEWS');
  const articleIds = idsOfType(rows, 'ARTICLE');

  const [news, articles] = await Promise.all([
    newsIds.length
      ? prisma.news.findMany({ where: { id: { in: newsIds } } })
      : Promise.resolve([]),
    articleIds.length
      ? prisma.article.findMany({
          where: { id: { in: articleIds } },
          select: ARTICLE_CARD_SELECT,
        })
      : Promise.resolve([]),
  ]);

  const newsById = new Map(news.map((item) => [item.id, item]));
  const articleById = new Map(articles.map((item) => [item.id, item]));

  return rows
    .map((row): FavoriteItem | null => {
      if (row.itemType === 'NEWS') {
        const item = newsById.get(row.itemId);
        return item ? { ...row, itemType: 'NEWS', news: item } : null;
      }
      const item = articleById.get(row.itemId);
      return item ? { ...row, itemType: 'ARTICLE', article: item } : null;
    })
    .filter((item): item is FavoriteItem => item !== null);
}

/**
 * Os ids do que o usuário salvou, sem conteúdo nenhum.
 *
 * O botão de salvar precisa saber se **este** item está salvo. Antes disto
 * existir, a tela baixava os 100 primeiros favoritos com a notícia embutida e
 * testava no cliente — do 101º em diante o coração mentia.
 */
export async function listFavoriteIds(userId: string) {
  const rows = (await prisma.favorite.findMany({
    where: { userId },
    select: { itemType: true, itemId: true },
  })) as Array<Pick<FavoriteRow, 'itemType' | 'itemId'>>;

  return {
    news: rows.filter((row) => row.itemType === 'NEWS').map((row) => row.itemId),
    articles: rows.filter((row) => row.itemType === 'ARTICLE').map((row) => row.itemId),
  };
}

/** Quantos itens de cada tipo o usuário salvou — para a tela de conta. */
export async function countFavorites(userId: string) {
  const grouped = await prisma.favorite.groupBy({
    by: ['itemType'],
    where: { userId },
    _count: { _all: true },
  });

  const countOf = (type: FavoriteItemType) =>
    grouped.find((row) => row.itemType === type)?._count._all ?? 0;

  return { news: countOf('NEWS'), articles: countOf('ARTICLE') };
}

/** Existe o conteúdo que está sendo salvo? A rota devolve 404 quando não. */
async function itemExists(itemType: FavoriteItemType, itemId: string): Promise<boolean> {
  if (itemType === 'NEWS') {
    const news = await prisma.news.findUnique({
      where: { id: itemId },
      select: { id: true },
    });
    return news !== null;
  }

  const article = await prisma.article.findUnique({
    where: { id: itemId },
    select: { id: true },
  });
  return article !== null;
}

/**
 * Salva um item. Retorna null se o conteúdo não existe (rota → 404).
 * Idempotente: salvar o que já está salvo devolve o que já estava lá.
 */
export async function addFavorite(
  userId: string,
  itemType: FavoriteItemType,
  itemId: string,
) {
  if (!(await itemExists(itemType, itemId))) return null;

  return prisma.favorite.upsert({
    where: { userId_itemType_itemId: { userId, itemType, itemId } },
    create: { userId, itemType, itemId },
    update: {},
  });
}

/** Remove um salvo. Retorna false se não existia (rota → 404). */
export async function removeFavorite(
  userId: string,
  itemType: FavoriteItemType,
  itemId: string,
) {
  const existing = await prisma.favorite.findUnique({
    where: { userId_itemType_itemId: { userId, itemType, itemId } },
  });
  if (!existing) return false;

  await prisma.favorite.delete({ where: { id: existing.id } });
  return true;
}
