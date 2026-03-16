import type { Category } from '@newranews/database';

export interface RawNewsItem {
  title: string;
  description: string;
  content: string | null;
  source: string;
  sourceUrl: string;
  imageUrl: string | null;
  category: Category;
  publishedAt: Date;
}
