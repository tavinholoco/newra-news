import { Category } from '@newranews/database';
import { fetchFromNewsApi } from '../providers/newsapi.provider';
import { fetchFromRss } from '../providers/rss.provider';
import type { RawNewsItem } from '../providers/types';

const ALL_CATEGORIES = Object.values(Category) as Category[];

export interface FetchResult {
  newsApiItems: RawNewsItem[];
  rssItems: RawNewsItem[];
  allItems: RawNewsItem[];
}

export async function fetchAll(): Promise<FetchResult> {
  const [newsApiResult, rssResult] = await Promise.allSettled([
    fetchFromNewsApi(ALL_CATEGORIES),
    fetchFromRss(),
  ]);

  const newsApiItems = newsApiResult.status === 'fulfilled' ? newsApiResult.value : [];
  const rssItems = rssResult.status === 'fulfilled' ? rssResult.value : [];

  if (newsApiResult.status === 'rejected') {
    console.warn('[pipeline] NewsAPI fetch failed:', newsApiResult.reason);
  }
  if (rssResult.status === 'rejected') {
    console.warn('[pipeline] RSS fetch failed:', rssResult.reason);
  }

  return { newsApiItems, rssItems, allItems: [...newsApiItems, ...rssItems] };
}
