export interface News {
  id: string;
  title: string;
  description: string;
  content: string | null;
  source: string;
  sourceUrl: string;
  imageUrl: string | null;
  category: Category;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export enum Category {
  TECHNOLOGY = 'TECHNOLOGY',
  POLITICS = 'POLITICS',
  ECONOMY = 'ECONOMY',
  SPORTS = 'SPORTS',
  SCIENCE = 'SCIENCE',
  ENTERTAINMENT = 'ENTERTAINMENT',
  WORLD = 'WORLD',
  HEALTH = 'HEALTH',
}

/** Ordenação do acervo em `/news`. Só há data: a busca é `contains`, sem ranking. */
export type NewsSort = 'recent' | 'oldest';

/**
 * As dimensões de filtro da listagem (§7 do plano V2).
 *
 * É o mesmo conjunto que `GET /api/news` e `GET /api/news/facets` aceitam, e o
 * mesmo que a URL de `/news` carrega — um lugar só evita que a query string, o
 * hook e o cliente HTTP discordem sobre o nome de um parâmetro.
 */
export interface NewsFilters {
  category?: Category;
  search?: string;
  source?: string;
  /** Início do período (ISO), inclusivo. */
  from?: string;
  /** Fim do período (ISO), inclusivo. */
  to?: string;
  sort?: NewsSort;
}

/**
 * Contagem do acervo por dimensão, para os controles de filtro.
 *
 * `categories` e `sources` **ignoram cada uma o seu próprio filtro**: com uma
 * categoria selecionada, as outras ainda reportam quantas matérias têm — que é
 * a informação que faz alguém trocar de categoria.
 *
 * Não há um total do recorte: esse número é o `meta.total` da listagem, que sai
 * da mesma consulta que trouxe as matérias visíveis.
 */
export interface NewsFacets {
  categories: Array<{ category: Category; count: number }>;
  sources: Array<{ source: string; count: number }>;
}
