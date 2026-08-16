import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerPipeline } from '../../src/services/pipeline.service';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      pipelineLog: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        deleteMany: vi.fn(),
      },
      news: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      article: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      dailyMetric: {
        upsert: vi.fn(),
      },
    },
  };
});

vi.mock('../../src/services/news-fetcher.service');
vi.mock('../../src/services/ai.service');

import { prisma } from '@newranews/database';
import { fetchAll } from '../../src/services/news-fetcher.service';
import { generateArticle } from '../../src/services/ai.service';

const mockFetchResult = {
  newsDataItems: [
    {
      title: 'NewsData Article',
      description: 'Description',
      content: null,
      source: 'G1',
      sourceUrl: 'https://g1.com/1',
      imageUrl: null,
      category: 'TECHNOLOGY' as const,
      publishedAt: new Date('2024-01-01T10:00:00Z'),
    },
  ],
  rssItems: [
    {
      title: 'RSS Article',
      description: 'Description',
      content: null,
      source: 'BBC',
      sourceUrl: 'https://bbc.com/1',
      imageUrl: null,
      category: 'WORLD' as const,
      publishedAt: new Date('2024-01-01T09:00:00Z'),
    },
  ],
  allItems: [
    {
      title: 'NewsData Article',
      description: 'Description',
      content: null,
      source: 'G1',
      sourceUrl: 'https://g1.com/1',
      imageUrl: null,
      category: 'TECHNOLOGY' as const,
      publishedAt: new Date('2024-01-01T10:00:00Z'),
    },
    {
      title: 'RSS Article',
      description: 'Description',
      content: null,
      source: 'BBC',
      sourceUrl: 'https://bbc.com/1',
      imageUrl: null,
      category: 'WORLD' as const,
      publishedAt: new Date('2024-01-01T09:00:00Z'),
    },
  ],
};

const mockGeneratedArticle = {
  article: {
    title: 'Artigo do Dia',
    summary: 'Resumo do artigo.',
    content: 'Conteúdo completo.',
  },
  provider: 'gemini' as const,
};

const mockSavedArticle = { id: 'article-uuid-123' };
const mockLog = { id: 'log-uuid-456', status: 'RUNNING' };

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(prisma.pipelineLog.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.pipelineLog.create).mockResolvedValue(mockLog as never);
  vi.mocked(prisma.pipelineLog.update).mockResolvedValue(mockLog as never);
  vi.mocked(prisma.pipelineLog.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.news.createMany).mockResolvedValue({ count: 2 });
  vi.mocked(prisma.news.deleteMany).mockResolvedValue({ count: 5 });
  vi.mocked(prisma.article.upsert).mockResolvedValue(mockSavedArticle as never);
  vi.mocked(prisma.article.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.dailyMetric.upsert).mockResolvedValue({} as never);
  vi.mocked(fetchAll).mockResolvedValue(mockFetchResult);
  vi.mocked(generateArticle).mockResolvedValue(mockGeneratedArticle);
});

describe('PipelineService', () => {
  it('should execute all pipeline steps in order', async () => {
    await triggerPipeline();

    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(prisma.pipelineLog.create).toHaveBeenCalledWith({ data: { status: 'RUNNING' } });
    expect(fetchAll).toHaveBeenCalled();
    expect(prisma.news.createMany).toHaveBeenCalled();
    expect(generateArticle).toHaveBeenCalled();
    expect(prisma.article.upsert).toHaveBeenCalled();
    expect(prisma.dailyMetric.upsert).toHaveBeenCalled();

    const successUpdate = vi.mocked(prisma.pipelineLog.update).mock.calls.find(
      (call) => (call[0] as { data: { status?: string } }).data?.status === 'SUCCESS',
    );
    expect(successUpdate).toBeDefined();
  });

  it('should skip if pipeline already ran today', async () => {
    vi.mocked(prisma.pipelineLog.findFirst).mockResolvedValue({
      id: 'existing-log-id',
      status: 'SUCCESS',
    } as never);

    const result = await triggerPipeline();

    expect(result).toBe('existing-log-id');
    expect(prisma.pipelineLog.create).not.toHaveBeenCalled();
    expect(fetchAll).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(fetchAll).mockRejectedValue(new Error('Network failure'));

    await triggerPipeline();

    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10));

    const failedUpdate = vi.mocked(prisma.pipelineLog.update).mock.calls.find(
      (call) => (call[0] as { data: { status?: string } }).data?.status === 'FAILED',
    );
    expect(failedUpdate).toBeDefined();
    expect(
      (failedUpdate?.[0] as { data: { error?: string } }).data?.error,
    ).toBe('Network failure');
  });

  it('should record metrics after completion', async () => {
    await triggerPipeline();

    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(prisma.dailyMetric.upsert).toHaveBeenCalled();

    const upsertCall = vi.mocked(prisma.dailyMetric.upsert).mock.calls[0];
    const createData = (upsertCall?.[0] as { create?: Record<string, unknown> })?.create;
    expect(createData?.articleGenerated).toBe(true);
    expect(createData?.aiProvider).toBe('gemini');
    expect(typeof createData?.newsCollected).toBe('number');
  });
});
