import type { News } from './news';

export interface Favorite {
  id: string;
  newsId: string;
  createdAt: string;
}

export interface FavoriteWithNews extends Favorite {
  news: News;
}

export interface AddedFavorite extends Favorite {
  userId: string;
}
