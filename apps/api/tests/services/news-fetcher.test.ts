import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAll } from '../../src/services/news-fetcher.service';

vi.mock('../../src/providers/newsapi.provider');
vi.mock('../../src/providers/rss.provider');

import { fetchFromNewsApi } from '../../src/providers/newsapi.provider';
import { fetchFromRss } from '../../src/providers/rss.provider';

const mockNewsApiItems = [
  {
    title: 'NewsAPI Article',
    description: 'Descrição',
    content: null,
    source: 'G1',
    sourceUrl: 'https://g1.com/1',
    imageUrl: null,
    category: 'TECHNOLOGY' as const,
    publishedAt: new Date('2024-01-01T10:00:00Z'),
  },
];

const mockRssItems = [
  {
    title: 'RSS Article',
    description: 'Descrição',
    content: null,
    source: 'BBC',
    sourceUrl: 'https://bbc.com/1',
    imageUrl: null,
    category: 'WORLD' as const,
    publishedAt: new Date('2024-01-01T09:00:00Z'),
  },
];

beforeEach(() => {
  vi.resetAllMocks();
});

describe('NewsFetcherService', () => {
  it('should combine items from both sources', async () => {
    vi.mocked(fetchFromNewsApi).mockResolvedValue(mockNewsApiItems);
    vi.mocked(fetchFromRss).mockResolvedValue(mockRssItems);

    const result = await fetchAll();

    expect(result.newsApiItems).toEqual(mockNewsApiItems);
    expect(result.rssItems).toEqual(mockRssItems);
    expect(result.allItems).toHaveLength(2);
    expect(result.allItems).toEqual([...mockNewsApiItems, ...mockRssItems]);
  });

  it('should return empty newsApiItems when NewsAPI fails', async () => {
    vi.mocked(fetchFromNewsApi).mockRejectedValue(new Error('NewsAPI down'));
    vi.mocked(fetchFromRss).mockResolvedValue(mockRssItems);

    const result = await fetchAll();

    expect(result.newsApiItems).toEqual([]);
    expect(result.rssItems).toEqual(mockRssItems);
    expect(result.allItems).toEqual(mockRssItems);
  });

  it('should return empty rssItems when RSS fails', async () => {
    vi.mocked(fetchFromNewsApi).mockResolvedValue(mockNewsApiItems);
    vi.mocked(fetchFromRss).mockRejectedValue(new Error('RSS down'));

    const result = await fetchAll();

    expect(result.newsApiItems).toEqual(mockNewsApiItems);
    expect(result.rssItems).toEqual([]);
    expect(result.allItems).toEqual(mockNewsApiItems);
  });

  it('should return empty allItems when both sources fail', async () => {
    vi.mocked(fetchFromNewsApi).mockRejectedValue(new Error('NewsAPI down'));
    vi.mocked(fetchFromRss).mockRejectedValue(new Error('RSS down'));

    const result = await fetchAll();

    expect(result.newsApiItems).toEqual([]);
    expect(result.rssItems).toEqual([]);
    expect(result.allItems).toEqual([]);
  });
});
