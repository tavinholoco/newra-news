import { prisma } from '@newranews/database';
import { fetchAll } from './news-fetcher.service';
import { generateArticle } from './ai.service';
import { sendDailyNewsletter } from './newsletter.service';
import { extractErrorDetail, logPipelineEvent } from './pipeline-event.service';
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

  // Etapa atual — usada para gravar o errorStage quando o pipeline falha
  let currentStage = 1;

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
    currentStage = 1;
    const { newsDataItems, rssItems, allItems } = await fetchAll();
    metrics.newsDataCount = newsDataItems.length;
    metrics.rssCount = rssItems.length;
    await logPipelineEvent(pipelineLogId, 1, 'INFO', 'News collected', {
      newsDataCount: newsDataItems.length,
      rssCount: rssItems.length,
      total: allItems.length,
    });

    // Stage 2: Normalization already handled by providers (RawNewsItem format)

    // Stage 3: Deduplicate by sourceUrl
    currentStage = 3;
    const deduplicated = deduplicateByUrl(allItems);
    metrics.newsCollected = deduplicated.length;
    metrics.newsByCategory = countByCategory(deduplicated);
    await logPipelineEvent(pipelineLogId, 3, 'INFO', 'News deduplicated', {
      before: allItems.length,
      after: deduplicated.length,
    });

    // Stage 4: Persist news items
    currentStage = 4;
    const persisted = await prisma.news.createMany({ data: deduplicated });
    await logPipelineEvent(pipelineLogId, 4, 'INFO', 'News persisted', {
      count: persisted.count,
    });

    // Stage 5: Select top items for AI generation
    currentStage = 5;
    const selected = selectTopItems(deduplicated);

    if (selected.length === 0) {
      throw new Error('No news items available for article generation');
    }
    await logPipelineEvent(pipelineLogId, 5, 'INFO', 'Top items selected for AI', {
      count: selected.length,
    });

    // Stage 6: Generate article via AI (Gemini → Groq fallback)
    currentStage = 6;
    const { article, provider } = await generateArticle(selected);
    metrics.aiProvider = provider;
    await logPipelineEvent(pipelineLogId, 6, 'INFO', 'Article generated', {
      provider,
    });

    // Stage 7: Persist article (upsert by date — one article per day)
    currentStage = 7;
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
    await logPipelineEvent(pipelineLogId, 7, 'INFO', 'Article persisted', {
      articleId: savedArticle.id,
    });

    // Update log with counts before cleanup
    await prisma.pipelineLog.update({
      where: { id: pipelineLogId },
      data: { newsCount: deduplicated.length, articleId: savedArticle.id },
    });

    // Stage 7.5: Send daily newsletter (non-critical — failure does not abort
    // the pipeline). Idempotente via NewsletterLog.date unique: se o pipeline
    // rodar de novo no mesmo dia, o envio é pulado. Falhas individuais de
    // e-mail são contadas pelo service (sent/failed) e não lançam erro;
    // sem RESEND_API_KEY o provider lança por e-mail e tudo vira failed.
    // Não incrementa pipelineErrors de propósito: a newsletter é opcional e
    // sua indisponibilidade não deve marcar o dia como falha do pipeline.
    try {
      currentStage = 7.5;
      const newsletter = await sendDailyNewsletter();
      await logPipelineEvent(pipelineLogId, 7.5, 'INFO', 'Daily newsletter sent', {
        total: newsletter.total,
        sent: newsletter.sent,
        failed: newsletter.failed,
      });
    } catch (newsletterErr) {
      await logPipelineEvent(pipelineLogId, 7.5, 'WARN', 'Newsletter failed (non-critical)', {
        ...extractErrorDetail(newsletterErr),
      });
    }

    // Stage 8: Cleanup old data (non-critical — failure does not abort pipeline)
    try {
      currentStage = 8;
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
      await logPipelineEvent(pipelineLogId, 8, 'INFO', 'Cleanup completed', {
        deleted: metrics.cleanupCount,
      });
    } catch (cleanupErr) {
      metrics.pipelineErrors += 1;
      await logPipelineEvent(pipelineLogId, 8, 'WARN', 'Cleanup failed (non-critical)', {
        ...extractErrorDetail(cleanupErr),
      });
    }

    // Stage 9: Record daily metrics (non-critical — failure does not abort pipeline)
    try {
      currentStage = 9;
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
      await logPipelineEvent(pipelineLogId, 9, 'INFO', 'Daily metrics recorded', {
        durationMs: pipelineDuration,
      });
    } catch (metricsErr) {
      await logPipelineEvent(pipelineLogId, 9, 'WARN', 'Metrics recording failed (non-critical)', {
        ...extractErrorDetail(metricsErr),
      });
    }

    // Mark pipeline as successful
    currentStage = 9;
    await prisma.pipelineLog.update({
      where: { id: pipelineLogId },
      data: { status: 'SUCCESS', completedAt: new Date() },
    });
    await logPipelineEvent(pipelineLogId, 9, 'INFO', 'Pipeline completed successfully', {
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const detail = extractErrorDetail(error);
    await prisma.pipelineLog.update({
      where: { id: pipelineLogId },
      data: {
        status: 'FAILED',
        error: detail.message,
        errorStage: currentStage,
        errorDetail: { ...detail },
        completedAt: new Date(),
      },
    });
    await logPipelineEvent(pipelineLogId, currentStage, 'ERROR', detail.message, {
      ...detail,
    });
    throw error;
  }
}
