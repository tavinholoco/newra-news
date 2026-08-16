import { prisma } from '@newranews/database';
import { fetchAll } from './news-fetcher.service';
import { generateArticle } from './ai.service';
import type { RawNewsItem } from '../providers/types';

// ── Helpers ────────────────────────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function deduplicateByUrl(items: RawNewsItem[]): RawNewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.sourceUrl)) return false;
    seen.add(item.sourceUrl);
    return true;
  });
}

function countByCategory(items: RawNewsItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  return counts;
}

function selectTopItems(items: RawNewsItem[], limit = 15): RawNewsItem[] {
  return [...items]
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, limit);
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function triggerPipeline(): Promise<string> {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  // Idempotency: skip if pipeline already succeeded or is running today
  const existingLog = await prisma.pipelineLog.findFirst({
    where: {
      startedAt: { gte: today, lt: tomorrow },
      status: { in: ['SUCCESS', 'RUNNING'] },
    },
  });
  if (existingLog) return existingLog.id;

  const log = await prisma.pipelineLog.create({
    data: { status: 'RUNNING' },
  });

  void runPipeline(log.id).catch((err: unknown) => {
    console.error(`[pipeline] unhandled error for log ${log.id}:`, err);
  });

  return log.id;
}

// ── Core pipeline ───────────────────────────────────────────────────────────

async function runPipeline(pipelineLogId: string): Promise<void> {
  const startedAt = Date.now();
  const today = startOfDay(new Date());

  const metrics = {
    newsDataCount: 0,
    rssCount: 0,
    newsCollected: 0,
    newsByCategory: {} as Record<string, number>,
    articleGenerated: false,
    aiProvider: undefined as string | undefined,
    cleanupCount: 0,
    pipelineErrors: 0,
  };

  try {
    // Stage 1: Collect news (NewsData.io + RSS)
    const { newsDataItems, rssItems, allItems } = await fetchAll();
    metrics.newsDataCount = newsDataItems.length;
    metrics.rssCount = rssItems.length;

    // Stage 2: Normalization already handled by providers (RawNewsItem format)

    // Stage 3: Deduplicate by sourceUrl
    const deduplicated = deduplicateByUrl(allItems);
    metrics.newsCollected = deduplicated.length;
    metrics.newsByCategory = countByCategory(deduplicated);

    // Stage 4: Persist news items
    await prisma.news.createMany({ data: deduplicated });

    // Stage 5: Select top items for AI generation
    const selected = selectTopItems(deduplicated);

    if (selected.length === 0) {
      throw new Error('No news items available for article generation');
    }

    // Stage 6: Generate article via AI (Gemini → Groq fallback)
    const { article, provider } = await generateArticle(selected);
    metrics.aiProvider = provider;

    // Stage 7: Persist article (upsert by date — one article per day)
    const savedArticle = await prisma.article.upsert({
      where: { date: today },
      create: {
        title: article.title,
        summary: article.summary,
        content: article.content,
        date: today,
        newsCount: selected.length,
      },
      update: {
        title: article.title,
        summary: article.summary,
        content: article.content,
        newsCount: selected.length,
      },
    });
    metrics.articleGenerated = true;

    // Update log with counts before cleanup
    await prisma.pipelineLog.update({
      where: { id: pipelineLogId },
      data: { newsCount: deduplicated.length, articleId: savedArticle.id },
    });

    // Stage 8: Cleanup old data (non-critical — failure does not abort pipeline)
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const [deletedNews, deletedLogs, deletedArticles] = await Promise.all([
        prisma.news.deleteMany({ where: { createdAt: { lt: thirtyDaysAgo } } }),
        prisma.pipelineLog.deleteMany({
          where: { startedAt: { lt: thirtyDaysAgo }, id: { not: pipelineLogId } },
        }),
        prisma.article.deleteMany({ where: { createdAt: { lt: ninetyDaysAgo } } }),
      ]);
      metrics.cleanupCount = deletedNews.count + deletedLogs.count + deletedArticles.count;
    } catch (cleanupErr) {
      console.warn('[pipeline] cleanup failed (non-critical):', cleanupErr);
      metrics.pipelineErrors += 1;
    }

    // Stage 9: Record daily metrics (non-critical — failure does not abort pipeline)
    try {
      const pipelineDuration = Date.now() - startedAt;
      await prisma.dailyMetric.upsert({
        where: { date: today },
        create: {
          date: today,
          newsCollected: metrics.newsCollected,
          newsByCategory: metrics.newsByCategory,
          newsApiCount: metrics.newsDataCount, // coluna historica; hoje mede NewsData.io
          rssCount: metrics.rssCount,
          articleGenerated: metrics.articleGenerated,
          aiProvider: metrics.aiProvider,
          cleanupCount: metrics.cleanupCount,
          pipelineDuration,
          pipelineErrors: metrics.pipelineErrors,
        },
        update: {
          newsCollected: metrics.newsCollected,
          newsByCategory: metrics.newsByCategory,
          newsApiCount: metrics.newsDataCount, // coluna historica; hoje mede NewsData.io
          rssCount: metrics.rssCount,
          articleGenerated: metrics.articleGenerated,
          aiProvider: metrics.aiProvider,
          cleanupCount: metrics.cleanupCount,
          pipelineDuration,
          pipelineErrors: metrics.pipelineErrors,
        },
      });
    } catch (metricsErr) {
      console.warn('[pipeline] metrics recording failed (non-critical):', metricsErr);
    }

    // Mark pipeline as successful
    await prisma.pipelineLog.update({
      where: { id: pipelineLogId },
      data: { status: 'SUCCESS', completedAt: new Date() },
    });
  } catch (error) {
    await prisma.pipelineLog.update({
      where: { id: pipelineLogId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      },
    });
    throw error;
  }
}
