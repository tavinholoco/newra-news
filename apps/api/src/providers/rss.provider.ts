import Parser from 'rss-parser';
import { Category } from '@newranews/database';
import type { RawNewsItem } from './types';
import { rssSources, type RssSource } from '../config/rss-sources';

const parser = new Parser();

export async function fetchFromRss(sources: RssSource[] = rssSources): Promise<RawNewsItem[]> {
  const results = await Promise.allSettled(sources.map((source) => fetchSource(source)));

  return results
    .filter((r): r is PromiseFulfilledResult<RawNewsItem[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);
}

async function fetchSource(source: RssSource): Promise<RawNewsItem[]> {
  const feed = await parser.parseURL(source.url);

  return feed.items
    .filter((item) => item.title && (item.contentSnippet || item.content))
    .map((item) => {
      const description = (item.contentSnippet || item.content) as string;
      return {
        title: item.title as string,
        description,
        content: item.content ?? null,
        source: source.name,
        sourceUrl: item.link ?? source.url,
        imageUrl: item.enclosure?.url ?? null,
        category: source.category ?? Category.WORLD,
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      };
    });
}
