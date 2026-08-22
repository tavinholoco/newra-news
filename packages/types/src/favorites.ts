import type { News } from './news';
import type { Article } from './article';

/**
 * O que um favorito alcança. `Favorite` guarda `itemType` + `itemId` desde a
 * Fase 6 — antes só alcançava notícia, e o briefing do dia não podia ser
 * salvo.
 */
export type FavoriteItemType = 'NEWS' | 'ARTICLE';

interface FavoriteBase {
  id: string;
  itemId: string;
  /** Quando o leitor salvou — é esta a data que ordena a tela "Salvos". */
  createdAt: string;
}

/** O briefing como ele aparece num card de salvos: sem o corpo inteiro. */
export type FavoriteArticle = Pick<
  Article,
  'id' | 'title' | 'summary' | 'date' | 'newsCount'
>;

export interface NewsFavorite extends FavoriteBase {
  itemType: 'NEWS';
  news: News;
}

export interface ArticleFavorite extends FavoriteBase {
  itemType: 'ARTICLE';
  article: FavoriteArticle;
}

/**
 * União discriminada por `itemType` — a lista de salvos é **uma só**, com os
 * dois tipos ordenados pela data em que foram salvos.
 */
export type FavoriteWithItem = NewsFavorite | ArticleFavorite;

/** O que `POST /api/favorites` devolve: a linha, sem o conteúdo embutido. */
export interface SavedFavorite extends FavoriteBase {
  userId: string;
  itemType: FavoriteItemType;
}

/**
 * Só os ids do que o usuário salvou.
 *
 * Existe porque o botão de salvar precisa saber se **este** item está salvo, e
 * a alternativa era baixar os favoritos com conteúdo e testar no cliente — o
 * que, a partir do 101º favorito, fazia o coração mentir.
 */
export interface FavoriteIds {
  news: string[];
  articles: string[];
}
