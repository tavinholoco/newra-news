import { Category } from '@newranews/database';
import { fetchFromNewsData } from '../providers/news/newsdata.provider';
import { fetchFromRss } from '../providers/news/rss.provider';
import type { RawNewsItem } from '../providers/types';

const ALL_CATEGORIES = Object.values(Category) as Category[];

export interface FetchResult {
  newsDataItems: RawNewsItem[];
  rssItems: RawNewsItem[];
  allItems: RawNewsItem[];
}

export async function fetchAll(): Promise<FetchResult> {
  const [newsDataResult, rssResult] = await Promise.allSettled([
    fetchFromNewsData(ALL_CATEGORIES),
    fetchFromRss(),
  ]);

  const newsDataItems =
    newsDataResult.status === 'fulfilled' ? newsDataResult.value : [];
  const rssItems = rssResult.status === 'fulfilled' ? rssResult.value : [];

  if (newsDataResult.status === 'rejected') {
    console.warn('[pipeline] NewsData fetch failed:', newsDataResult.reason);
  }
  if (rssResult.status === 'rejected') {
    console.warn('[pipeline] RSS fetch failed:', rssResult.reason);
  }

  return { newsDataItems, rssItems, allItems: [...newsDataItems, ...rssItems] };
}
