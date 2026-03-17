import { Category } from '@newranews/database';
import { env } from '../../config/env';
import type { RawNewsItem } from '../types';

const REMOVED_SENTINEL = '[Removed]';

const CATEGORY_MAP: Record<Category, string> = {
  TECHNOLOGY: 'technology',
  POLITICS: 'general',
  ECONOMY: 'business',
  SPORTS: 'sports',
  SCIENCE: 'science',
  ENTERTAINMENT: 'entertainment',
  WORLD: 'general',
  HEALTH: 'health',
};

interface NewsApiArticle {
  source: { name: string };
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsApiResponse {
  status: string;
  articles: NewsApiArticle[];
}

export async function fetchFromNewsApi(categories: Category[]): Promise<RawNewsItem[]> {
  // Deduplicate by mapped API category to avoid redundant calls
  // (e.g., POLITICS and WORLD both map to 'general')
  const seenApiCategories = new Set<string>();
  const uniqueCategories = categories.filter((cat) => {
    const apiCat = CATEGORY_MAP[cat];
    if (seenApiCategories.has(apiCat)) return false;
    seenApiCategories.add(apiCat);
    return true;
  });

  const results = await Promise.all(uniqueCategories.map((cat) => fetchCategory(cat)));
  return results.flat();
}

async function fetchCategory(category: Category): Promise<RawNewsItem[]> {
  const apiCategory = CATEGORY_MAP[category];
  const url = `https://newsapi.org/v2/top-headlines?country=br&category=${apiCategory}&pageSize=10&apiKey=${env.NEWSAPI_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`NewsAPI error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as NewsApiResponse;

  if (data.status !== 'ok') {
    throw new Error(`NewsAPI returned status: ${data.status}`);
  }

  return data.articles
    .filter((article) => article.title !== REMOVED_SENTINEL && article.description !== null)
    .map((article) => ({
      title: article.title,
      description: article.description as string,
      content: article.content === REMOVED_SENTINEL ? null : article.content,
      source: article.source.name,
      sourceUrl: article.url,
      imageUrl: article.urlToImage,
      category,
      publishedAt: new Date(article.publishedAt),
    }));
}
