import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerPipeline } from '../../src/services/pipeline.service';
import { ARTICLE_PROMPT_VERSION } from '../../src/config/ai-prompts';

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
        findMany: vi.fn(),
      },
      article: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
      // A retenção de evento de produto (§4 dos slots) entrou na etapa 8, junto
      // do cleanup que já existia. Sem este mock, a etapa lançava e o estágio
      // caía de INFO para WARN -- foi assim que este teste avisou.
      productEvent: {
        deleteMany: vi.fn(),
      },
      briefingSource: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      dailyMetric: {
        upsert: vi.fn(),
      },
      pipelineEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

vi.mock('../../src/services/news-fetcher.service');
vi.mock('../../src/services/ai.service');
vi.mock('../../src/services/news-renormalizer.service', () => ({
  renormalizeStoredNews: vi.fn(),
}));
vi.mock('../../src/services/newsletter.service', () => ({
  sendDailyNewsletter: vi.fn(),
}));

import { prisma } from '@newranews/database';
import { fetchAll } from '../../src/services/news-fetcher.service';
import { generateArticle } from '../../src/services/ai.service';
import { sendDailyNewsletter } from '../../src/services/newsletter.service';
import { renormalizeStoredNews } from '../../src/services/news-renormalizer.service';

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
  modelVersion: 'gemini-2.5-flash',
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
  vi.mocked(prisma.productEvent.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.dailyMetric.upsert).mockResolvedValue({} as never);
  vi.mocked(prisma.pipelineEvent.create).mockResolvedValue({} as never);
  vi.mocked(prisma.news.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.briefingSource.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.briefingSource.createMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
  vi.mocked(fetchAll).mockResolvedValue(mockFetchResult);
  vi.mocked(generateArticle).mockResolvedValue(mockGeneratedArticle);
  vi.mocked(renormalizeStoredNews).mockReset().mockResolvedValue({
    dryRun: false,
    scanned: 0,
    textChanged: 0,
    categoryChanged: 0,
    categorySkipped: 0,
    transitions: [],
    sample: [],
  });
  vi.mocked(sendDailyNewsletter).mockResolvedValue({
    total: 0,
    sent: 0,
    failed: 0,
  });
});

describe('PipelineService', () => {
  it('should execute all pipeline steps in order', async () => {
    await triggerPipeline();

    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(prisma.pipelineLog.create).toHaveBeenCalledWith({ data: { status: 'RUNNING' } });
    expect(fetchAll).toHaveBeenCalled();
    expect(prisma.news.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(generateArticle).toHaveBeenCalled();
    expect(prisma.article.upsert).toHaveBeenCalled();
    expect(prisma.dailyMetric.upsert).toHaveBeenCalled();

    const successUpdate = vi.mocked(prisma.pipelineLog.update).mock.calls.find(
      (call) => (call[0] as { data: { status?: string } }).data?.status === 'SUCCESS',
    );
    expect(successUpdate).toBeDefined();
  });

  it('should not re-insert news already persisted when the pipeline runs twice in a day', async () => {
    // Cenário real de 2026-08-17: 1º run falha após persistir as notícias e um
    // 2º run roda no mesmo dia — sem skipDuplicates isso duplicaria as linhas.
    await triggerPipeline();

    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10));

    const createManyCall = vi.mocked(prisma.news.createMany).mock.calls[0]?.[0] as {
      data: unknown[];
      skipDuplicates?: boolean;
    };
    expect(createManyCall).toBeDefined();
    expect(createManyCall.skipDuplicates).toBe(true);

    // O evento do Stage 4 registra quantos foram pulados pelo dedup do banco
    const persistedEvent = vi.mocked(prisma.pipelineEvent.create).mock.calls.find(
      (call) =>
        (call[0] as { data: { stage: number; message: string } }).data?.message ===
        'News persisted',
    );
    expect(persistedEvent).toBeDefined();
    const context = (persistedEvent?.[0] as { data: { context?: { skipped?: number } } }).data
      ?.context;
    expect(context).toHaveProperty('skipped');
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

  it('should send the daily newsletter after persisting the article', async () => {
    vi.mocked(renormalizeStoredNews).mockReset().mockResolvedValue({
    dryRun: false,
    scanned: 0,
    textChanged: 0,
    categoryChanged: 0,
    categorySkipped: 0,
    transitions: [],
    sample: [],
  });
  vi.mocked(sendDailyNewsletter).mockResolvedValue({
      total: 3,
      sent: 3,
      failed: 0,
    });

    await triggerPipeline();

    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(prisma.article.upsert).toHaveBeenCalled();
    expect(sendDailyNewsletter).toHaveBeenCalledTimes(1);

    const successUpdate = vi.mocked(prisma.pipelineLog.update).mock.calls.find(
      (call) => (call[0] as { data: { status?: string } }).data?.status === 'SUCCESS',
    );
    expect(successUpdate).toBeDefined();
  });

  it('should not abort the pipeline when the newsletter fails', async () => {
    vi.mocked(sendDailyNewsletter).mockRejectedValue(
      new Error('Newsletter service down'),
    );

    await triggerPipeline();

    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10));

    expect(sendDailyNewsletter).toHaveBeenCalledTimes(1);
    expect(prisma.dailyMetric.upsert).toHaveBeenCalled();

    const successUpdate = vi.mocked(prisma.pipelineLog.update).mock.calls.find(
      (call) => (call[0] as { data: { status?: string } }).data?.status === 'SUCCESS',
    );
    expect(successUpdate).toBeDefined();
  });

  it('should record INFO pipeline events for each stage on success', async () => {
    await triggerPipeline();

    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10));

    const created = vi.mocked(prisma.pipelineEvent.create).mock.calls.map(
      (call) => (call[0] as { data: { stage: number; level: string; message: string } }).data,
    );
    expect(created.length).toBeGreaterThanOrEqual(8);
    expect(created.every((e) => e.level === 'INFO')).toBe(true);
    expect(created.map((e) => e.stage)).toEqual(
      expect.arrayContaining([1, 3, 4, 5, 6, 7, 7.5, 8, 9]),
    );
    expect(created).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: 1, message: 'News collected' }),
        expect.objectContaining({ stage: 6, message: 'Article generated' }),
        expect.objectContaining({ stage: 9, message: 'Pipeline completed successfully' }),
      ]),
    );
  });

  it('should log a WARN event when the newsletter fails (non-critical)', async () => {
    vi.mocked(sendDailyNewsletter).mockRejectedValue(
      new Error('Newsletter service down'),
    );

    await triggerPipeline();

    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10));

    const warnCall = vi.mocked(prisma.pipelineEvent.create).mock.calls.find(
      (call) =>
        (call[0] as { data: { level: string; stage: number } }).data?.level ===
        'WARN',
    );
    expect(warnCall).toBeDefined();
    const data = warnCall?.[0] as { data: { stage: number; message: string; context: unknown } };
    expect(data.data.stage).toBe(7.5);
    expect(data.data.message).toBe('Newsletter failed (non-critical)');
  });

  it('should record both the primary and fallback provider errors on AI failure', async () => {
    // Cenário real de 2026-08-17: Gemini falha (transitório) e o fallback Groq
    // também falha (404 — modelo deprecado). O PipelineLog deve guardar os dois.
    const primaryError = new Error('Gemini API error 429: rate limited');
    const fallbackError = new Error('Groq API error: 404 Not Found');
    (fallbackError as Error & { primaryError?: unknown }).primaryError = primaryError;
    vi.mocked(generateArticle).mockRejectedValue(fallbackError);

    await triggerPipeline();

    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10));

    const failedUpdate = vi.mocked(prisma.pipelineLog.update).mock.calls.find(
      (call) => (call[0] as { data: { status?: string } }).data?.status === 'FAILED',
    );
    expect(failedUpdate).toBeDefined();
    const failedData = failedUpdate?.[0] as {
      data: {
        error: string;
        errorStage: number;
        errorDetail: {
          message: string;
          provider?: string;
          statusCode?: number;
          primaryError?: { message: string; provider?: string; statusCode?: number };
        };
      };
    };
    expect(failedData.data.error).toBe('Groq API error: 404 Not Found');
    expect(failedData.data.errorStage).toBe(6);
    expect(failedData.data.errorDetail).toEqual({
      message: 'Groq API error: 404 Not Found',
      provider: 'groq',
      statusCode: 404,
      primaryError: {
        message: 'Gemini API error 429: rate limited',
        provider: 'gemini',
        statusCode: 429,
      },
    });

    // WARN com o erro primário + ERROR com o final
    const warnEvent = vi.mocked(prisma.pipelineEvent.create).mock.calls.find(
      (call) =>
        (call[0] as { data: { level: string; message: string } }).data?.level === 'WARN',
    );
    expect(warnEvent).toBeDefined();
    const warnData = warnEvent?.[0] as { data: { stage: number; message: string } };
    expect(warnData.data.stage).toBe(6);
    expect(warnData.data.message).toBe('Primary provider failed before fallback');
  });

  it('should record the failing stage and structured error on failure', async () => {
    vi.mocked(fetchAll).mockRejectedValue(new Error('Gemini API error 500: boom'));

    await triggerPipeline();

    // Allow fire-and-forget to settle
    await new Promise((r) => setTimeout(r, 10));

    const failedUpdate = vi.mocked(prisma.pipelineLog.update).mock.calls.find(
      (call) => (call[0] as { data: { status?: string } }).data?.status === 'FAILED',
    );
    expect(failedUpdate).toBeDefined();
    const failedData = failedUpdate?.[0] as {
      data: {
        error: string;
        errorStage: number;
        errorDetail: { message: string; provider?: string; statusCode?: number };
      };
    };
    expect(failedData.data.error).toBe('Gemini API error 500: boom');
    expect(failedData.data.errorStage).toBe(1);
    expect(failedData.data.errorDetail).toEqual({
      message: 'Gemini API error 500: boom',
      provider: 'gemini',
      statusCode: 500,
    });

    const errorEvent = vi.mocked(prisma.pipelineEvent.create).mock.calls.find(
      (call) =>
        (call[0] as { data: { level: string } }).data?.level === 'ERROR',
    );
    expect(errorEvent).toBeDefined();
    const eventData = errorEvent?.[0] as {
      data: { stage: number; message: string; context: unknown };
    };
    expect(eventData.data.stage).toBe(1);
    expect(eventData.data.message).toBe('Gemini API error 500: boom');
  });

  // ── Auditoria do briefing (plano V2 §18.4) ───────────────────────────────

  it('should persist the generation audit fields on the article', async () => {
    await triggerPipeline();
    await new Promise((r) => setTimeout(r, 10));

    const upsert = vi.mocked(prisma.article.upsert).mock.calls[0]?.[0] as {
      create: {
        generatedAt: Date;
        promptVersion: string;
        modelVersion: string;
        status: string;
      };
      update: { promptVersion: string; modelVersion: string; status: string };
    };

    expect(upsert.create.generatedAt).toBeInstanceOf(Date);
    expect(upsert.create.promptVersion).toBe(ARTICLE_PROMPT_VERSION);
    expect(upsert.create.modelVersion).toBe('gemini-2.5-flash');
    expect(upsert.create.status).toBe('PUBLISHED');
    // O upsert também roda como update quando o pipeline repete no mesmo dia —
    // sem isso, um artigo regenerado manteria a auditoria da primeira execução.
    expect(upsert.update.promptVersion).toBe(ARTICLE_PROMPT_VERSION);
    expect(upsert.update.modelVersion).toBe('gemini-2.5-flash');
    expect(upsert.update.status).toBe('PUBLISHED');
  });

  it('should persist the briefing sources in the order sent to the AI', async () => {
    vi.mocked(prisma.news.findMany).mockResolvedValue([
      { id: 'news-1', sourceUrl: 'https://g1.com/1' },
      { id: 'news-2', sourceUrl: 'https://bbc.com/1' },
    ] as never);

    await triggerPipeline();
    await new Promise((r) => setTimeout(r, 10));

    const createMany = vi.mocked(prisma.briefingSource.createMany).mock
      .calls[0]?.[0] as { data: Array<Record<string, unknown>> };

    // selectTopItems ordena por publishedAt desc: NewsData (10:00) e RSS (09:00)
    expect(createMany.data).toEqual([
      {
        articleId: 'article-uuid-123',
        newsId: 'news-1',
        position: 0,
        title: 'NewsData Article',
        source: 'G1',
        sourceUrl: 'https://g1.com/1',
      },
      {
        articleId: 'article-uuid-123',
        newsId: 'news-2',
        position: 1,
        title: 'RSS Article',
        source: 'BBC',
        sourceUrl: 'https://bbc.com/1',
      },
    ]);
  });

  it('should record a source with a null newsId when the lookup does not resolve', async () => {
    vi.mocked(prisma.news.findMany).mockResolvedValue([
      { id: 'news-1', sourceUrl: 'https://g1.com/1' },
    ] as never);

    await triggerPipeline();
    await new Promise((r) => setTimeout(r, 10));

    const createMany = vi.mocked(prisma.briefingSource.createMany).mock
      .calls[0]?.[0] as { data: Array<{ sourceUrl: string; newsId: string | null }> };

    // Perder o registro de auditoria é pior que perder o ponteiro: a fonte
    // entra mesmo assim, com os campos que a interface exibe.
    expect(createMany.data).toHaveLength(2);
    expect(createMany.data[1]).toMatchObject({
      sourceUrl: 'https://bbc.com/1',
      newsId: null,
    });
  });

  it('should replace the sources instead of appending on a same-day re-run', async () => {
    await triggerPipeline();
    await new Promise((r) => setTimeout(r, 10));

    // O artigo é upsert por data; sem a remoção, um segundo run do dia
    // acumularia as fontes dos dois conjuntos no mesmo briefing.
    expect(prisma.briefingSource.deleteMany).toHaveBeenCalledWith({
      where: { articleId: 'article-uuid-123' },
    });
    // As duas operações vão juntas numa transação para não existir um instante
    // em que o briefing fique sem nenhuma fonte.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

/**
 * A etapa 8.5 é o que faz uma correção de regra alcançar o que já está gravado.
 *
 * Sem ela, consertar a ingestão só conserta o que entra, e as linhas antigas
 * seguem servidas até o cleanup — 30 dias em que a Home mostra a categoria
 * velha. Com ela, o acervo converge sozinho no dia seguinte, sem ninguém
 * precisar lembrar de disparar nada.
 */
/**
 * A retenção de evento de produto (§4 de `docs/v2/04-analytics-e-slots.md`).
 *
 * Ela vive na etapa 8, junto do cleanup que já existia, e é de propósito:
 * ingestão sem expurgo é tabela que cresce para sempre, e etapa própria seria
 * um segundo lugar para lembrar de olhar quando algo parasse.
 */
describe('PipelineService — retenção de eventos de produto (etapa 8)', () => {
  it('should purge product events on every run, with no manual job', async () => {
    await triggerPipeline();
    await vi.waitFor(() =>
      expect(prisma.productEvent.deleteMany).toHaveBeenCalled(),
    );
  });

  it('should cut at 90 days by occurredAt, not createdAt', async () => {
    // O que a §4 limita é há quanto tempo o comportamento aconteceu, não
    // quando a linha chegou.
    await triggerPipeline();
    await vi.waitFor(() =>
      expect(prisma.productEvent.deleteMany).toHaveBeenCalled(),
    );

    const [arg] = vi.mocked(prisma.productEvent.deleteMany).mock.calls[0] as [
      { where: { occurredAt: { lt: Date } } },
    ];
    const cutoff = arg.where.occurredAt.lt;
    const days = Math.round((Date.now() - cutoff.getTime()) / 86_400_000);

    expect(days).toBe(90);
  });

  it('should count the purged events in the cleanup total', async () => {
    vi.mocked(prisma.productEvent.deleteMany).mockResolvedValue({ count: 12 });

    await triggerPipeline();
    await vi.waitFor(() => expect(prisma.dailyMetric.upsert).toHaveBeenCalled());

    const [arg] = vi.mocked(prisma.dailyMetric.upsert).mock.calls[0] as [
      { create: { cleanupCount: number } },
    ];
    // 5 notícias + 0 logs + 0 artigos + 12 eventos
    expect(arg.create.cleanupCount).toBe(17);
  });
});

describe('PipelineService — renormalização do acervo (etapa 8.5)', () => {
  it('should renormalize stored news on every run, writing for real', async () => {
    await triggerPipeline();
    await vi.waitFor(() =>
      expect(renormalizeStoredNews).toHaveBeenCalledWith({ dryRun: false }),
    );
  });

  // Depois do cleanup: renormalizar linha que a etapa 8 acabou de apagar é
  // trabalho jogado fora.
  it('should run after the cleanup, not before', async () => {
    await triggerPipeline();
    await vi.waitFor(() => expect(renormalizeStoredNews).toHaveBeenCalled());

    const cleanupAt = vi.mocked(prisma.news.deleteMany).mock.invocationCallOrder[0];
    const renormalizeAt = vi.mocked(renormalizeStoredNews).mock.invocationCallOrder[0];

    expect(cleanupAt).toBeDefined();
    expect(renormalizeAt).toBeGreaterThan(cleanupAt as number);
  });

  it('should not abort the pipeline when renormalization fails', async () => {
    vi.mocked(renormalizeStoredNews).mockRejectedValue(new Error('db down'));

    await triggerPipeline();

    await vi.waitFor(() => {
      const successUpdate = vi.mocked(prisma.pipelineLog.update).mock.calls.find(
        (call) => (call[0] as { data?: { status?: string } })?.data?.status === 'SUCCESS',
      );
      expect(successUpdate).toBeDefined();
    });
  });
});
