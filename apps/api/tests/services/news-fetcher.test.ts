import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAll } from '../../src/services/news-fetcher.service';

vi.mock('../../src/providers/news/newsdata.provider');
vi.mock('../../src/providers/news/rss.provider');

import { fetchFromNewsData } from '../../src/providers/news/newsdata.provider';
import { fetchFromRss } from '../../src/providers/news/rss.provider';

const mockNewsDataItems = [
  {
    title: 'NewsData Article',
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
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRss).mockResolvedValue(mockRssItems);

    const result = await fetchAll();

    expect(result.newsDataItems).toEqual(mockNewsDataItems);
    expect(result.rssItems).toEqual(mockRssItems);
    expect(result.allItems).toHaveLength(2);
    expect(result.allItems).toEqual([...mockNewsDataItems, ...mockRssItems]);
  });

  it('should return empty newsDataItems when NewsData fails', async () => {
    vi.mocked(fetchFromNewsData).mockRejectedValue(new Error('NewsData down'));
    vi.mocked(fetchFromRss).mockResolvedValue(mockRssItems);

    const result = await fetchAll();

    expect(result.newsDataItems).toEqual([]);
    expect(result.rssItems).toEqual(mockRssItems);
    expect(result.allItems).toEqual(mockRssItems);
  });

  it('should return empty rssItems when RSS fails', async () => {
    vi.mocked(fetchFromNewsData).mockResolvedValue(mockNewsDataItems);
    vi.mocked(fetchFromRss).mockRejectedValue(new Error('RSS down'));

    const result = await fetchAll();

    expect(result.newsDataItems).toEqual(mockNewsDataItems);
    expect(result.rssItems).toEqual([]);
    expect(result.allItems).toEqual(mockNewsDataItems);
  });

  it('should return empty allItems when both sources fail', async () => {
    vi.mocked(fetchFromNewsData).mockRejectedValue(new Error('NewsData down'));
    vi.mocked(fetchFromRss).mockRejectedValue(new Error('RSS down'));

    const result = await fetchAll();

    expect(result.newsDataItems).toEqual([]);
    expect(result.rssItems).toEqual([]);
    expect(result.allItems).toEqual([]);
  });
});
