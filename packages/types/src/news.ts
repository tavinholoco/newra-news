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
