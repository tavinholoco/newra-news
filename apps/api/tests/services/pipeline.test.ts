import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerPipeline } from '../../src/services/pipeline.service';
import { ARTICLE_PROMPT_VERSION } from '../../src/config/ai-prompts';
import { degradedStages } from '../../src/services/run-outcome';
import { passingEntryGate, passingOutputGuard } from '../helpers/gate-fixtures';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      pipelineLog: {
        create: vi.fn(),
        update: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
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
      // E o `ErrorEvent` da Fase 4 entrou na mesma etapa 8, com corte em 14
      // dias -- e avisou pelo mesmo teste, do mesmo jeito. `upsert` esta aqui
      // porque o flush do buffer o chama no `onClose` do app.
      errorEvent: {
        deleteMany: vi.fn(),
        upsert: vi.fn(),
      },
      // O `AuditEvent` da Fase 5, com corte em 365 dias — terceira vez que
      // este teste avisa, pelo mesmo caminho: sem o mock, a etapa 8 lança e o
      // run inteiro conta um erro.
      auditEvent: {
        deleteMany: vi.fn(),
      },
      // A `SourceHealth` da Fase 11: escrita depois da etapa 4 (duas
      // instruções numa transação) e expurgo de 90 dias na 8 — quarta vez que
      // este teste avisa pelo mesmo caminho: sem o mock, o bloco lança, o dia
      // sai degradado pela etapa 4 e o resumo da Fase 8 muda.
      sourceHealth: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
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
// Os dois portões da Fase 9 têm suíte própria (`pipeline-gates.test.ts`,
// `output-guard.test.ts`); aqui o que se mede é a fiação — o evento da 5.5 e
// da 6.5, o `FAILED` na etapa do portão, o `degradedBy`, a seleção alargada
// chegando à IA. As fixtures desta suíte têm datas de 2024 e duas fontes, e
// o portão real bloquearia todo cenário pelo frescor — sexta vez que uma
// etapa nova avisa por esta suíte, e a primeira em que a resposta é mockar
// a decisão em vez de acrescentar um mock do Prisma. `GateBlockedError` e o
// resto do módulo continuam reais (`importOriginal`).
vi.mock('../../src/services/pipeline-gates.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/pipeline-gates.service')>();
  return { ...actual, evaluateEntryGate: vi.fn(), loadEntryBaseline: vi.fn() };
});
vi.mock('../../src/services/news-renormalizer.service', () => ({
  renormalizeStoredNews: vi.fn(),
}));
vi.mock('../../src/services/newsletter.service', () => ({
  sendDailyNewsletter: vi.fn(),
}));
// A suíte de invariantes (etapa 9.5, Fase 6) tem suíte própria; aqui o que se
// mede é a fiação — o evento, o resumo, o `degradedBy`. Sem o mock, as doze
// consultas bateriam num Prisma sem `aggregate` e o dia sairia degradado
// pela 9.5 em todo cenário — quinta vez que este teste avisa pelo mesmo
// caminho.
vi.mock('../../src/services/invariants.service', () => ({
  runInvariants: vi.fn(),
}));

import { prisma } from '@newranews/database';
import { fetchAll } from '../../src/services/news-fetcher.service';
import { generateArticle } from '../../src/services/ai.service';
import { sendDailyNewsletter } from '../../src/services/newsletter.service';
import { renormalizeStoredNews } from '../../src/services/news-renormalizer.service';
import { runInvariants } from '../../src/services/invariants.service';
import {
  GateBlockedError,
  evaluateEntryGate,
  loadEntryBaseline,
} from '../../src/services/pipeline-gates.service';
import {
  pendingErrorEvents,
  resetErrorEventBuffer,
} from '../../src/services/error-event.service';

// A NewsData devolve o G1 **como veículo** — `source: 'G1'` num item que veio
// do agregador. É o caso que a atribuição por fonte da Fase 11 existe para
// acertar, e por isso `allItems` reusa os mesmos objetos que `newsDataItems`
// e `rssItems`, como `fetchAll` faz: a atribuição é por identidade.
const newsDataItem = {
  title: 'NewsData Article',
  description: 'Description',
  content: null,
  source: 'G1',
  sourceUrl: 'https://g1.com/1',
  imageUrl: null,
  category: 'TECHNOLOGY' as const,
  publishedAt: new Date('2024-01-01T10:00:00Z'),
};
const rssItem = {
  title: 'RSS Article',
  description: 'Description',
  content: null,
  source: 'BBC',
  sourceUrl: 'https://bbc.com/1',
  imageUrl: null,
  category: 'WORLD' as const,
  publishedAt: new Date('2024-01-01T09:00:00Z'),
};

const mockFetchResult = {
  newsDataItems: [newsDataItem],
  rssItems: [rssItem],
  allItems: [newsDataItem, rssItem],
  warnings: [],
  sources: [
    { source: 'newsdata', kind: 'AGGREGATOR' as const, fetched: 1, latencyMs: 700 },
    { source: 'BBC', kind: 'RSS' as const, fetched: 1, latencyMs: 400 },
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
  // O veredito do portão de saída sobre o artigo servido (Fase 9) — sem
  // bloqueio por definição, e é o que a etapa 6.5 grava.
  guard: passingOutputGuard(),
};

const mockSavedArticle = { id: 'article-uuid-123' };

/** O relatório da 9.5 em ordem: doze conferidas, nenhuma violada, nenhuma com erro. */
const healthyInvariants = {
  checked: 12,
  violated: 0,
  errored: 0,
  durationMs: 48,
  budgetMs: 2_000,
  results: [],
};
// `startedAt` entra na fixture porque a coluna tem default no schema e o
// `create` real a devolve — o `triggerPipeline` lê dela para dizer quando o
// run começou. Fixture sem o campo faria o teste medir um Prisma que não existe.
const mockLog = {
  id: 'log-uuid-456',
  status: 'RUNNING',
  startedAt: new Date('2026-08-25T16:30:00.000Z'),
};

beforeEach(() => {
  resetErrorEventBuffer();
  vi.resetAllMocks();

  vi.mocked(prisma.pipelineLog.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.pipelineLog.findMany).mockResolvedValue([]);
  vi.mocked(prisma.pipelineLog.create).mockResolvedValue(mockLog as never);
  vi.mocked(prisma.pipelineLog.update).mockResolvedValue(mockLog as never);
  vi.mocked(prisma.pipelineLog.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.news.createMany).mockResolvedValue({ count: 2 });
  vi.mocked(prisma.news.deleteMany).mockResolvedValue({ count: 5 });
  vi.mocked(prisma.article.upsert).mockResolvedValue(mockSavedArticle as never);
  vi.mocked(prisma.article.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.productEvent.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.errorEvent.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.auditEvent.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.sourceHealth.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.sourceHealth.createMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.dailyMetric.upsert).mockResolvedValue({} as never);
  vi.mocked(prisma.pipelineEvent.create).mockResolvedValue({} as never);
  vi.mocked(prisma.news.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.briefingSource.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.briefingSource.createMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
  vi.mocked(fetchAll).mockResolvedValue(mockFetchResult);
  vi.mocked(generateArticle).mockResolvedValue(mockGeneratedArticle);
  vi.mocked(loadEntryBaseline).mockResolvedValue([]);
  vi.mocked(evaluateEntryGate).mockImplementation(passingEntryGate);
  vi.mocked(renormalizeStoredNews).mockReset().mockResolvedValue({
    dryRun: false,
    scanned: 0,
    textChanged: 0,
    imageRecovered: 0,
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
  vi.mocked(runInvariants).mockResolvedValue(healthyInvariants);
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

  /**
   * **A idempotencia continua igual; o que mudou e ela contar isso.**
   *
   * Antes a funcao devolvia so o id, e quem chamava nao tinha como distinguir
   * o run que acabara de nascer do que ja tinha fechado horas antes. Os dois
   * chegavam ao painel como "Pipeline disparado com sucesso", e em 25/08/2026
   * foi exatamente o que aconteceu: o botao nao disparou nada e a tela disse
   * que sim.
   */
  it('should report already-succeeded-today when the day already has a SUCCESS run', async () => {
    vi.mocked(prisma.pipelineLog.findFirst).mockResolvedValue({
      id: 'existing-log-id',
      status: 'SUCCESS',
      startedAt: new Date('2026-08-25T11:00:00.000Z'),
    } as never);

    const result = await triggerPipeline();

    expect(result).toEqual({
      outcome: 'already-succeeded-today',
      pipelineId: 'existing-log-id',
      startedAt: '2026-08-25T11:00:00.000Z',
    });
    expect(prisma.pipelineLog.create).not.toHaveBeenCalled();
    expect(fetchAll).not.toHaveBeenCalled();
  });

  it('should report already-running when the day has a RUNNING run', async () => {
    // Desfecho proprio porque leva a uma acao oposta: aqui vale esperar.
    //
    // **O instante e relativo a agora de proposito.** Um `RUNNING` so conta
    // como em andamento dentro de `STALE_RUN_MS`; com a data fixa que este
    // teste usava, ele passaria a medir o caminho do run morto sem que o nome
    // mudasse.
    const startedAt = new Date(Date.now() - 60_000);
    vi.mocked(prisma.pipelineLog.findFirst).mockResolvedValue({
      id: 'running-log-id',
      status: 'RUNNING',
      startedAt,
    } as never);

    const result = await triggerPipeline();

    expect(result).toEqual({
      outcome: 'already-running',
      pipelineId: 'running-log-id',
      startedAt: startedAt.toISOString(),
    });
    expect(prisma.pipelineLog.create).not.toHaveBeenCalled();
    expect(fetchAll).not.toHaveBeenCalled();
  });

  /**
   * O run que morreu sem conseguir contar.
   *
   * O `status` so vira `SUCCESS` na etapa 9, entao um processo que morre antes
   * — `SIGTERM` do Render no meio da etapa 8.5, em 03/09/2026 — deixa a linha
   * em `RUNNING` para sempre. Como a idempotencia aceita `RUNNING` como "ja tem
   * run hoje", o cadaver recusava todo disparo pelo resto do dia.
   */
  describe('triggerPipeline — run travado em RUNNING', () => {
    const staleStartedAt = () => new Date(Date.now() - 20 * 60_000);

    it('should bury a RUNNING run older than the threshold and start a new one', async () => {
      vi.mocked(prisma.pipelineLog.findFirst).mockResolvedValue({
        id: 'zombie-log-id',
        status: 'RUNNING',
        startedAt: staleStartedAt(),
      } as never);

      const result = await triggerPipeline();
      // O run novo corre em segundo plano; sem esperá-lo, ele termina durante
      // o teste seguinte com os mocks zerados — e o `update` do `FAILED` dele
      // aparece onde ninguém o chamou. Visto acontecer quando a 5.5 pôs um
      // `await` a mais no caminho.
      await vi.waitFor(() => expect(prisma.dailyMetric.upsert).toHaveBeenCalled());

      expect(result.outcome).toBe('started');
      expect(result.pipelineId).toBe(mockLog.id);
      expect(prisma.pipelineLog.create).toHaveBeenCalled();
    });

    it('should mark the dead run FAILED, and leave errorStage null', async () => {
      vi.mocked(prisma.pipelineLog.findFirst).mockResolvedValue({
        id: 'zombie-log-id',
        status: 'RUNNING',
        startedAt: staleStartedAt(),
      } as never);

      await triggerPipeline();
      await vi.waitFor(() => expect(prisma.dailyMetric.upsert).toHaveBeenCalled());

      const burial = vi
        .mocked(prisma.pipelineLog.update)
        .mock.calls.find((call) => call[0]?.where?.id === 'zombie-log-id');

      expect(burial).toBeDefined();
      expect(burial?.[0].data).toMatchObject({ status: 'FAILED' });
      expect(burial?.[0].data.completedAt).toBeInstanceOf(Date);
      // Chutar a etapa poria no banco um numero que ninguem mediu.
      expect(burial?.[0].data).not.toHaveProperty('errorStage');
    });

    /**
     * **O cadáver de outro dia.** O enterro só olhava o run de **hoje** — o
     * `findFirst` da idempotência é na janela do dia. O run de 03/09/2026, o
     * do `SIGTERM` no meio da 8.5, ficou `RUNNING` no banco de produção até o
     * ensaio de aceitação o achar em 24/09 (Fase 12, M7a, pela invariante
     * `pipeline.no_stale_running`, que o acusava em todo run): a faixa de 30
     * dias o desenhava como "rodando", e a invariante reprovava todo dia — o
     * jeito de ensinar a ignorá-la.
     */
    it('buries a dead run from a previous day before the day is checked', async () => {
      vi.mocked(prisma.pipelineLog.findMany).mockResolvedValue([
        { id: 'dead-three-weeks-ago', startedAt: new Date(Date.now() - 21 * 86_400_000) },
      ] as never);

      const result = await triggerPipeline();
      await vi.waitFor(() => expect(prisma.dailyMetric.upsert).toHaveBeenCalled());

      const query = vi.mocked(prisma.pipelineLog.findMany).mock.calls[0]?.[0];
      expect(query?.where).toMatchObject({ status: 'RUNNING' });
      // Morto é o que passou do prazo — qualquer dia, inclusive ontem às 23:55.
      const cutoff = (query?.where?.startedAt as { lt: Date }).lt.getTime();
      expect(Math.abs(cutoff - (Date.now() - 15 * 60_000))).toBeLessThan(5_000);

      const burial = vi
        .mocked(prisma.pipelineLog.update)
        .mock.calls.find((call) => call[0]?.where?.id === 'dead-three-weeks-ago');
      expect(burial?.[0].data).toMatchObject({ status: 'FAILED' });
      expect(burial?.[0].data).not.toHaveProperty('errorStage');
      expect(result.outcome).toBe('started');
    });

    it('should never bury a run that is merely slow', async () => {
      vi.mocked(prisma.pipelineLog.findFirst).mockResolvedValue({
        id: 'slow-but-alive',
        status: 'RUNNING',
        startedAt: new Date(Date.now() - 14 * 60_000),
      } as never);

      const result = await triggerPipeline();

      expect(result.outcome).toBe('already-running');
      expect(prisma.pipelineLog.create).not.toHaveBeenCalled();
      expect(prisma.pipelineLog.update).not.toHaveBeenCalled();
    });

    it('should never bury a SUCCESS run, however old it is', async () => {
      // O expurgo e sobre run que morreu sem contar. Um `SUCCESS` de horas
      // atras e o caso normal do dia — reabri-lo faria o briefing ser gerado
      // duas vezes, que e exatamente o que a idempotencia existe para evitar.
      vi.mocked(prisma.pipelineLog.findFirst).mockResolvedValue({
        id: 'finished-log-id',
        status: 'SUCCESS',
        startedAt: new Date(Date.now() - 10 * 60 * 60_000),
      } as never);

      const result = await triggerPipeline();

      expect(result.outcome).toBe('already-succeeded-today');
      expect(prisma.pipelineLog.create).not.toHaveBeenCalled();
      expect(prisma.pipelineLog.update).not.toHaveBeenCalled();
    });
  });

  it('should report started, with the id of the run it just created', async () => {
    vi.mocked(prisma.pipelineLog.findFirst).mockResolvedValue(null as never);

    const result = await triggerPipeline();

    expect(result.outcome).toBe('started');
    expect(prisma.pipelineLog.create).toHaveBeenCalled();
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
    imageRecovered: 0,
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
    expect(created.length).toBeGreaterThanOrEqual(10);
    expect(created.every((e) => e.level === 'INFO')).toBe(true);
    expect(created.map((e) => e.stage)).toEqual(
      expect.arrayContaining([1, 3, 4, 5, 5.5, 6, 6.5, 7, 7.5, 8, 9]),
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

  it('records the Gemini failure as a stage-6 WARN when Groq served the day', async () => {
    // O cenário de 02–03/09/2026: Gemini em 503, Groq entregando. Até a
    // verificação pós-merge da Fase 4 isso era uma linha de `warn` no stdout e
    // o `aiProvider` da métrica — nada durável, nada que respondesse "há
    // quantos dias?". E o run **continua** SUCCESS: o briefing saiu.
    vi.mocked(generateArticle).mockResolvedValueOnce({
      ...mockGeneratedArticle,
      provider: 'groq',
      primaryError: new Error('Gemini API error 503: UNAVAILABLE'),
    });

    await triggerPipeline();
    await vi.waitFor(() => expect(prisma.dailyMetric.upsert).toHaveBeenCalled());

    const warn = vi.mocked(prisma.pipelineEvent.create).mock.calls.find(
      (call) => (call[0] as { data: { stage: number; level: string } }).data.stage === 6
        && (call[0] as { data: { level: string } }).data.level === 'WARN',
    );
    expect(warn).toBeDefined();
    expect((warn?.[0] as { data: { context: { fallbackProvider: string; provider: string } } }).data.context)
      .toMatchObject({ fallbackProvider: 'groq', provider: 'gemini' });

    const recorded = pendingErrorEvents().find((e) => e.route === 'stage-6');
    expect(recorded?.severity).toBe('WARN');
    expect(recorded?.category).toBe('upstream');

    // Sucesso degradado não é erro do pipeline — quem define isso é a Fase 8.
    const [metric] = vi.mocked(prisma.dailyMetric.upsert).mock.calls[0] as [
      { create: { pipelineErrors: number; aiProvider: string } },
    ];
    expect(metric.create.pipelineErrors).toBe(0);
    expect(metric.create.aiProvider).toBe('groq');
  });

  it('records the aborting failure even when marking the run FAILED throws', async () => {
    // O caso em que o banco é o que abortou o run: o `update` para FAILED
    // também falha. Na ordem antiga o `ERROR` vinha **depois** do `update`, e
    // este caso terminava sem registro nenhum.
    vi.mocked(generateArticle).mockRejectedValue(new Error('Gemini API error 500: boom'));
    vi.mocked(prisma.pipelineLog.update).mockImplementation(((args: { data: { status?: string } }) =>
      args.data.status === 'FAILED'
        ? Promise.reject(new Error('P1001: database unreachable'))
        : Promise.resolve({})) as never);

    await triggerPipeline();
    await vi.waitFor(() =>
      expect(pendingErrorEvents().some((e) => e.severity === 'ERROR' && e.route === 'stage-6')).toBe(true),
    );
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
    // em que o briefing fique sem nenhuma fonte. São **duas** transações no
    // run desde a Fase 11: a outra é a SourceHealth do dia, pelo mesmo padrão
    // (`deleteMany` + `createMany`), depois da etapa 4.
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
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
    vi.mocked(prisma.auditEvent.deleteMany).mockResolvedValue({ count: 3 });

    await triggerPipeline();
    await vi.waitFor(() => expect(prisma.dailyMetric.upsert).toHaveBeenCalled());

    const [arg] = vi.mocked(prisma.dailyMetric.upsert).mock.calls[0] as [
      { create: { cleanupCount: number } },
    ];
    // 5 notícias + 0 logs + 0 artigos + 12 eventos + 0 erros + 3 auditorias
    expect(arg.create.cleanupCount).toBe(20);
  });

  it('should purge source health at 90 days, by day, and count it in the cleanup total', async () => {
    // Fase 11: "esta fonte vale a pena?" é pergunta trimestral — 90, como o
    // Article, para cruzar o briefing daquele dia com quem o alimentou.
    vi.mocked(prisma.sourceHealth.deleteMany).mockResolvedValueOnce({ count: 0 }); // o do dia (etapa 4)
    vi.mocked(prisma.sourceHealth.deleteMany).mockResolvedValueOnce({ count: 26 }); // o expurgo (etapa 8)

    await triggerPipeline();
    await vi.waitFor(() => expect(prisma.dailyMetric.upsert).toHaveBeenCalled());

    const purge = vi.mocked(prisma.sourceHealth.deleteMany).mock.calls.find(
      (call) => 'lt' in ((call[0] as { where: { day: unknown } }).where.day as object),
    )?.[0] as { where: { day: { lt: Date } } };
    expect(purge).toBeDefined();
    const expectedCutoff = new Date();
    expectedCutoff.setDate(expectedCutoff.getDate() - 90);
    expect(Math.abs(purge.where.day.lt.getTime() - expectedCutoff.getTime())).toBeLessThan(5_000);

    const [arg] = vi.mocked(prisma.dailyMetric.upsert).mock.calls[0] as [
      { create: { cleanupCount: number } },
    ];
    // 5 notícias + 26 linhas de fonte
    expect(arg.create.cleanupCount).toBe(31);
  });

  /**
   * **A trilha de auditoria expira na mesma etapa, e mais tarde que tudo.**
   * 365 dias, por `createdAt` — log de segurança responde pergunta feita meses
   * depois, e o `ErrorEvent` (14 d) responde "o que está quebrado agora".
   */
  it('should purge audit events at 365 days, by createdAt', async () => {
    await triggerPipeline();
    await vi.waitFor(() => expect(prisma.auditEvent.deleteMany).toHaveBeenCalled());

    const [arg] = vi.mocked(prisma.auditEvent.deleteMany).mock.calls[0] as [
      { where: { createdAt: { lt: Date } } },
    ];
    const cutoff = arg.where.createdAt.lt;
    const days = Math.round((Date.now() - cutoff.getTime()) / 86_400_000);

    expect(days).toBe(365);
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

/**
 * **Fase 8 — o resumo do que deu certo, e não só do que deu errado.**
 *
 * O evento final da etapa 9 carregava só `durationMs`. O que uma pessoa quer
 * saber ao abrir a tela de manhã — quantas notícias, de quantas fontes, qual
 * modelo escreveu, quantos assinantes receberam, e **qual etapa engoliu a
 * própria falha** — estava espalhado por ~15 eventos ou não estava em lugar
 * nenhum. §12 do plano de observabilidade.
 */
describe('Fase 8 — o evento final da etapa 9 resume o run', () => {
  const finalEvent = () =>
    vi.mocked(prisma.pipelineEvent.create).mock.calls.find(
      (call) =>
        (call[0] as { data: { message: string } }).data.message ===
        'Pipeline completed successfully',
    )?.[0] as { data: { context: Record<string, unknown> } } | undefined;

  it('carries the harvest, the model, the briefing, the newsletter and the duration', async () => {
    vi.mocked(sendDailyNewsletter).mockResolvedValue({ total: 12, sent: 11, failed: 1 });
    vi.mocked(renormalizeStoredNews).mockResolvedValue({
      dryRun: false,
      scanned: 8190,
      textChanged: 3,
      imageRecovered: 1,
      categoryChanged: 2,
      categorySkipped: 0,
      transitions: [],
      sample: [],
    } as never);

    await triggerPipeline();
    await vi.waitFor(() => expect(finalEvent()).toBeDefined());

    expect(finalEvent()?.data.context).toEqual({
      collected: 2,
      sources: 2,
      deduped: 2,
      persisted: 2,
      selected: 2,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      promptVersion: ARTICLE_PROMPT_VERSION,
      briefingId: 'article-uuid-123',
      briefingChars: 'Conteúdo completo.'.length,
      sourcesCited: 2,
      newsletter: { total: 12, sent: 11, failed: 1 },
      renormalized: { scanned: 8190, changed: 6 },
      invariants: { checked: 12, violated: 0, errored: 0 },
      degradedBy: [],
      durationMs: expect.any(Number),
    });
  });

  it('names the stages that swallowed their failure, and only those', async () => {
    // O cenário composto: Gemini caiu (Groq entregou), a newsletter lançou, e a
    // etapa 1 avisou **só** feeds vazios — que não degradam. `degradedBy` é o
    // que faz o `SUCCESS_DEGRADED` ser acionável em vez de decorativo.
    vi.mocked(fetchAll).mockResolvedValue({
      ...mockFetchResult,
      warnings: [{ kind: 'feed-empty', source: 'Veja Saúde' }],
    });
    vi.mocked(generateArticle).mockResolvedValueOnce({
      ...mockGeneratedArticle,
      provider: 'groq',
      modelVersion: 'openai/gpt-oss-20b',
      primaryError: new Error('Gemini API error 503: UNAVAILABLE'),
    });
    vi.mocked(sendDailyNewsletter).mockRejectedValue(new Error('Resend down'));

    await triggerPipeline();
    await vi.waitFor(() => expect(finalEvent()).toBeDefined());

    expect(finalEvent()?.data.context).toMatchObject({
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
      newsletter: 'failed',
      degradedBy: [6, 7.5],
    });
  });

  it('agrees with the pure derivation over the events it wrote — one line, not two', async () => {
    // O pipeline monta `degradedBy` enquanto corre; a API deriva o mesmo campo
    // dos eventos gravados, depois. Se as duas regras divergirem, a tela mostra
    // um número e o diário mostra outro — e este é o teste que reprova.
    vi.mocked(fetchAll).mockResolvedValue({
      ...mockFetchResult,
      warnings: [
        { kind: 'feed-empty', source: 'Veja Saúde' },
        { kind: 'feed-failed', source: 'Superinteressante', detail: 'ETIMEDOUT' },
      ],
    });
    vi.mocked(renormalizeStoredNews).mockRejectedValue(new Error('db down'));
    vi.mocked(prisma.dailyMetric.upsert).mockRejectedValue(new Error('db down'));

    await triggerPipeline();
    await vi.waitFor(() => expect(finalEvent()).toBeDefined());

    const written = vi.mocked(prisma.pipelineEvent.create).mock.calls.map(
      (call) =>
        (call[0] as { data: { stage: number; level: 'INFO' | 'WARN' | 'ERROR'; context?: Record<string, unknown> } })
          .data,
    );
    const derived = degradedStages(
      written.map((event) => ({ stage: event.stage, level: event.level, context: event.context ?? null })),
    );

    expect(derived).toEqual([1, 8.5, 9]);
    expect(finalEvent()?.data.context.degradedBy).toEqual(derived);
  });
});

/**
 * **As invariantes, depois da etapa 9.** (Fase 6 do plano de observabilidade,
 * §10)
 *
 * O que se mede aqui é a fiação, e sobretudo a decisão que a §10 deixou
 * escrita: **violação não degrada o run** — o relatório vai num `INFO`, e as
 * linhas vermelhas são `ErrorEvent` por invariante (medidos na suíte do
 * service). O que degrada é a suíte não conseguir perguntar: um `errored`
 * maior que zero é `WARN` com `degradedBy.push(9.5)`. As consultas em si estão
 * em `services/invariants.service.test.ts`.
 */
describe('Fase 6 — as invariantes, depois da etapa 9', () => {
  const stageEvents = (stage: number) =>
    vi.mocked(prisma.pipelineEvent.create).mock.calls
      .map((call) => (call[0] as { data: { stage: number; level: string; message: string; context?: Record<string, unknown> } }).data)
      .filter((data) => data.stage === stage);
  const finalEvent = () =>
    vi.mocked(prisma.pipelineEvent.create).mock.calls.find(
      (call) => (call[0] as { data: { message: string } }).data.message === 'Pipeline completed successfully',
    )?.[0] as { data: { context: Record<string, unknown> } } | undefined;

  it('runs the suite after the daily metric, for this run, and before the run is marked SUCCESS', async () => {
    const order: string[] = [];
    vi.mocked(prisma.dailyMetric.upsert).mockImplementation(async () => {
      order.push('metric');
      return {} as never;
    });
    vi.mocked(runInvariants).mockImplementation(async () => {
      order.push('invariants');
      return healthyInvariants;
    });
    vi.mocked(prisma.pipelineLog.update).mockImplementation(async (args) => {
      if ((args as { data: { status?: string } }).data.status === 'SUCCESS') order.push('success');
      return mockLog as never;
    });

    await triggerPipeline();
    await vi.waitFor(() => expect(finalEvent()).toBeDefined());

    expect(order).toEqual(['metric', 'invariants', 'success']);
    expect(runInvariants).toHaveBeenCalledWith({ pipelineLogId: 'log-uuid-456' });
  });

  it('writes the whole report as an INFO event, and a violation does not degrade the day', async () => {
    vi.mocked(runInvariants).mockResolvedValue({
      ...healthyInvariants,
      violated: 1,
      results: [
        {
          id: 'retention.news',
          status: 'VIOLATED',
          measure: 'oldest',
          observed: '2026-07-01T00:00:00.000Z',
          expected: '2026-08-16T11:01:00.000Z',
          detail: null,
          error: null,
          durationMs: 3,
        },
      ],
    });

    await triggerPipeline();
    await vi.waitFor(() => expect(finalEvent()).toBeDefined());

    expect(stageEvents(9.5)).toEqual([
      expect.objectContaining({
        level: 'INFO',
        message: 'Invariants checked',
        context: expect.objectContaining({ checked: 12, violated: 1, errored: 0 }),
      }),
    ]);
    expect(finalEvent()?.data.context).toMatchObject({
      invariants: { checked: 12, violated: 1, errored: 0 },
      degradedBy: [],
    });
    // O `INFO` não vira `ErrorEvent`; a linha da violação é do service, que
    // aqui está mockado — nada no buffer é o que prova que o run não a dobrou.
    expect(pendingErrorEvents()).toEqual([]);
  });

  it('degrades the day by 9.5 when a check could not run — the question, not the answer, failed', async () => {
    vi.mocked(runInvariants).mockResolvedValue({ ...healthyInvariants, errored: 2 });

    await triggerPipeline();
    await vi.waitFor(() => expect(finalEvent()).toBeDefined());

    expect(stageEvents(9.5)).toEqual([
      expect.objectContaining({
        level: 'WARN',
        message: 'Invariants partially checked (non-critical)',
        context: expect.objectContaining({ message: '2 of 12 checks could not run', errored: 2 }),
      }),
    ]);
    expect(finalEvent()?.data.context).toMatchObject({
      invariants: { checked: 12, violated: 0, errored: 2 },
      degradedBy: [9.5],
    });
    // E a derivação sobre os eventos gravados concorda.
    const written = vi.mocked(prisma.pipelineEvent.create).mock.calls.map(
      (call) =>
        (call[0] as { data: { stage: number; level: 'INFO' | 'WARN' | 'ERROR'; context?: Record<string, unknown> } }).data,
    );
    expect(
      degradedStages(written.map((event) => ({ stage: event.stage, level: event.level, context: event.context ?? null }))),
    ).toEqual([9.5]);
  });

  it('does not abort the run when the suite itself throws — WARN, degraded, and the summary says failed', async () => {
    vi.mocked(runInvariants).mockRejectedValue(new Error('prisma: connection closed'));

    await triggerPipeline();
    await vi.waitFor(() => expect(finalEvent()).toBeDefined());

    expect(stageEvents(9.5)).toEqual([
      expect.objectContaining({ level: 'WARN', message: 'Invariants check failed (non-critical)' }),
    ]);
    expect(finalEvent()?.data.context).toMatchObject({ invariants: 'failed', degradedBy: [9.5] });
    const successUpdate = vi.mocked(prisma.pipelineLog.update).mock.calls.find(
      (call) => (call[0] as { data: { status?: string } }).data.status === 'SUCCESS',
    );
    expect(successUpdate).toBeDefined();
  });
});

/**
 * **A saúde de cada fonte, gravada depois da etapa 4.** (Fase 11 do plano de
 * observabilidade, §15)
 *
 * O que se mede aqui é a fiação: que o pipeline lê o `createdAt` das URLs
 * **depois** do `createMany`, atribui `kept` por fonte, grava uma linha por
 * fonte tentada com o id do run, e que a falha disso degrada o dia pela
 * etapa 4 sem abortar nada. A aritmética em si está em
 * `services/source-health.test.ts`.
 */
describe('Fase 11 — a saúde por fonte, depois da etapa 4', () => {
  const healthEvent = (level: 'INFO' | 'WARN') =>
    vi.mocked(prisma.pipelineEvent.create).mock.calls.find((call) => {
      const data = (call[0] as { data: { stage: number; level: string; message: string } }).data;
      return data.stage === 4 && data.level === level && data.message.startsWith('Source health');
    })?.[0] as { data: { context: Record<string, unknown> } } | undefined;

  it('writes one row per attempted source, with kept from the URLs that entered the archive today', async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    // O primeiro `findMany` de News é o da etapa 4 (as URLs do run, com o
    // `createdAt`); o segundo é o do `persistBriefingSources`.
    vi.mocked(prisma.news.findMany).mockResolvedValueOnce([
      { sourceUrl: 'https://g1.com/1', createdAt: new Date(today.getTime() + 60_000) },
      { sourceUrl: 'https://bbc.com/1', createdAt: new Date(today.getTime() - 86_400_000) },
    ] as never);

    await triggerPipeline();
    await vi.waitFor(() => expect(healthEvent('INFO')).toBeDefined());

    const write = vi.mocked(prisma.sourceHealth.createMany).mock.calls[0]?.[0] as {
      data: Array<Record<string, unknown>>;
    };
    expect(write.data).toEqual([
      expect.objectContaining({ source: 'newsdata', kind: 'AGGREGATOR', fetched: 1, kept: 1, outcome: 'OK', latencyMs: 700, pipelineLogId: 'log-uuid-456', day: today }),
      expect.objectContaining({ source: 'BBC', kind: 'RSS', fetched: 1, kept: 0, outcome: 'OK', latencyMs: 400, pipelineLogId: 'log-uuid-456', day: today }),
    ]);
    expect(prisma.sourceHealth.deleteMany).toHaveBeenCalledWith({ where: { day: today } });
    expect(healthEvent('INFO')?.data.context).toEqual({ sources: 2, ok: 2, empty: 0, failed: 0, kept: 1 });
  });

  it('reads the archive after persisting — the createdAt lookup follows news.createMany', async () => {
    const order: string[] = [];
    vi.mocked(prisma.news.createMany).mockImplementation(async () => {
      order.push('createMany');
      return { count: 2 };
    });
    vi.mocked(prisma.news.findMany).mockImplementation(async () => {
      order.push('findMany');
      return [] as never;
    });

    await triggerPipeline();
    await vi.waitFor(() => expect(healthEvent('INFO')).toBeDefined());

    expect(order.slice(0, 2)).toEqual(['createMany', 'findMany']);
  });

  it('degrades the day by stage 4 when the write fails, and the run still succeeds', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('db down'));

    await triggerPipeline();
    await vi.waitFor(() => expect(healthEvent('WARN')).toBeDefined());

    expect(healthEvent('WARN')?.data.context).toMatchObject({ message: 'db down' });
    const successUpdate = vi.mocked(prisma.pipelineLog.update).mock.calls.find(
      (call) => (call[0] as { data: { status?: string } }).data?.status === 'SUCCESS',
    );
    expect(successUpdate).toBeDefined();

    const finalEvent = vi.mocked(prisma.pipelineEvent.create).mock.calls.find(
      (call) => (call[0] as { data: { message: string } }).data.message === 'Pipeline completed successfully',
    )?.[0] as { data: { context: { degradedBy: number[] } } };
    expect(finalEvent.data.context.degradedBy).toEqual([4]);
    // E a derivação sobre os eventos gravados concorda — é o `degradedBy`
    // da listagem, que tem de bater com o do resumo.
    const written = vi.mocked(prisma.pipelineEvent.create).mock.calls.map(
      (call) =>
        (call[0] as { data: { stage: number; level: 'INFO' | 'WARN' | 'ERROR'; context?: Record<string, unknown> } })
          .data,
    );
    expect(
      degradedStages(written.map((e) => ({ stage: e.stage, level: e.level, context: e.context ?? null }))),
    ).toEqual([4]);
  });

  it('writes nothing, and warns nothing, when the collection reported no source at all', async () => {
    vi.mocked(fetchAll).mockResolvedValue({ ...mockFetchResult, sources: [] });

    await triggerPipeline();
    await vi.waitFor(() => expect(prisma.dailyMetric.upsert).toHaveBeenCalled());

    // O `deleteMany` do dia não acontece — o da etapa 8 (o expurgo, por
    // `lt`) continua acontecendo, e é outro.
    expect(prisma.sourceHealth.createMany).not.toHaveBeenCalled();
    expect(
      vi.mocked(prisma.sourceHealth.deleteMany).mock.calls.some(
        (call) => (call[0] as { where: { day: unknown } }).where.day instanceof Date,
      ),
    ).toBe(false);
    expect(healthEvent('WARN')).toBeUndefined();
    expect(healthEvent('INFO')?.data.context).toMatchObject({ sources: 0 });
  });
});

/**
 * **Os dois portões, fiados no pipeline.** (Fase 9 do plano de observabilidade,
 * §13)
 *
 * O portão de entrada e o guarda de saída são medidos nas suítes deles; aqui
 * a pergunta é o que o pipeline faz com o veredito: em que etapa o run falha,
 * com que código e que motivo no fingerprint, o que degrada o dia, e se a
 * seleção que o portão devolveu é a que chega à IA. `evaluateEntryGate` é
 * mock nesta suíte (as fixtures não passariam no frescor); `GateBlockedError`
 * é o real.
 */
describe('Fase 9 — os dois portões, fiados no pipeline', () => {
  const events = () =>
    vi.mocked(prisma.pipelineEvent.create).mock.calls.map(
      (call) =>
        (call[0] as { data: { stage: number; level: 'INFO' | 'WARN' | 'ERROR'; message: string; context?: Record<string, unknown> } })
          .data,
    );
  const stageEvents = (stage: number) => events().filter((data) => data.stage === stage);
  const failedUpdate = () =>
    vi.mocked(prisma.pipelineLog.update).mock.calls
      .map((call) => (call[0] as { data: Record<string, unknown> }).data)
      .find((data) => data.status === 'FAILED');
  const finalEvent = () => events().find((data) => data.message === 'Pipeline completed successfully');
  const derived = () =>
    degradedStages(events().map((e) => ({ stage: e.stage, level: e.level, context: e.context ?? null })));

  describe('5.5 — o portão de entrada', () => {
    it('reads the baseline for today and hands the gate the harvest, the selection and a widener', async () => {
      await triggerPipeline();
      await vi.waitFor(() => expect(finalEvent()).toBeDefined());

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      expect(loadEntryBaseline).toHaveBeenCalledWith(today);

      const [input] = vi.mocked(evaluateEntryGate).mock.calls[0] as [Parameters<typeof evaluateEntryGate>[0]];
      expect(input.deduplicated).toHaveLength(2);
      expect(input.collected).toBe(2);
      expect(input.selected.map((item) => item.sourceUrl)).toEqual(['https://g1.com/1', 'https://bbc.com/1']);
      // O alargamento é a seleção do pipeline com outro teto — o portão não
      // sabe selecionar, ele pede.
      expect(input.widen().map((item) => item.sourceUrl)).toEqual(['https://g1.com/1', 'https://bbc.com/1']);
      expect(input.now).toBeInstanceOf(Date);
    });

    it('writes the verdict as an INFO event with the measures, and says when the baseline was insufficient', async () => {
      await triggerPipeline();
      await vi.waitFor(() => expect(finalEvent()).toBeDefined());

      expect(stageEvents(5.5)).toEqual([
        expect.objectContaining({
          level: 'INFO',
          message: 'Entry gate passed',
          context: expect.objectContaining({ volume: 2, baseline: 'insufficient', median: null, findings: [] }),
        }),
      ]);
      expect(finalEvent()?.data ?? finalEvent()).toBeDefined();
    });

    it('sends the widened selection to the AI when the gate widened it', async () => {
      const widened = [newsDataItem, rssItem, { ...rssItem, sourceUrl: 'https://bbc.com/2', source: 'Folha' }];
      vi.mocked(evaluateEntryGate).mockImplementation((input) => ({
        ...passingEntryGate(input),
        selected: widened,
        measures: { ...passingEntryGate(input).measures, widened: true, sources: 3 },
      }));

      await triggerPipeline();
      await vi.waitFor(() => expect(finalEvent()).toBeDefined());

      expect(generateArticle).toHaveBeenCalledWith(widened);
      // E o que o briefing registra como `newsCount` é a seleção que foi
      // ao modelo, não a inicial.
      const upsert = vi.mocked(prisma.article.upsert).mock.calls[0]?.[0] as { create: { newsCount: number } };
      expect(upsert.create.newsCount).toBe(3);
      expect(finalEvent()?.context).toMatchObject({ selected: 3 });
    });

    it('fails the run at 5.5 when the gate blocks — no AI call, the motive in the fingerprint', async () => {
      vi.mocked(evaluateEntryGate).mockImplementation((input) => ({
        ...passingEntryGate(input),
        block: { check: 'volume', detail: '12 < 30% of median 240 over 7 days' },
      }));

      await triggerPipeline();
      await vi.waitFor(() => expect(failedUpdate()).toBeDefined());

      expect(generateArticle).not.toHaveBeenCalled();
      expect(prisma.article.upsert).not.toHaveBeenCalled();
      expect(failedUpdate()).toMatchObject({
        errorStage: 5.5,
        error: 'Entry gate blocked: volume (12 < 30% of median 240 over 7 days)',
        errorDetail: expect.objectContaining({ gate: 'entry', check: 'volume', reason: 'quality' }),
      });
      expect(stageEvents(5.5)).toEqual([
        expect.objectContaining({
          level: 'ERROR',
          context: expect.objectContaining({ gate: 'entry', check: 'volume', reason: 'quality' }),
        }),
      ]);
      // O `ErrorEvent`: código próprio, o motivo no `route`, e a culpa é da
      // colheita (`upstream`). `ERROR`, não `FATAL`: entrada não é segurança.
      const recorded = pendingErrorEvents().find((e) => e.code === 'PIPELINE_GATE_BLOCKED');
      expect(recorded).toMatchObject({
        severity: 'ERROR',
        route: 'stage-5.5:volume',
        category: 'upstream',
        pipelineLogId: 'log-uuid-456',
      });
    });

    it('degrades the day by 5.5 on a warning, and the derivation over the events agrees', async () => {
      vi.mocked(evaluateEntryGate).mockImplementation((input) => ({
        ...passingEntryGate(input),
        warnings: [{ check: 'category-drift', detail: 'distribution moved 0.41 (total variation) from the 7-day mean' }],
      }));

      await triggerPipeline();
      await vi.waitFor(() => expect(finalEvent()).toBeDefined());

      expect(stageEvents(5.5)).toEqual([
        expect.objectContaining({
          level: 'WARN',
          message: 'Entry gate passed with warnings',
          context: expect.objectContaining({
            findings: ['category-drift'],
            warnings: ['category-drift: distribution moved 0.41 (total variation) from the 7-day mean'],
          }),
        }),
      ]);
      expect(finalEvent()?.context).toMatchObject({ degradedBy: [5.5] });
      expect(derived()).toEqual([5.5]);
      // Aviso de portão é degradação, não bloqueio: `PIPELINE_STAGE_DEGRADED`,
      // e o run segue `SUCCESS`.
      const recorded = pendingErrorEvents().find((e) => e.route === 'stage-5.5');
      expect(recorded?.code).toBe('PIPELINE_STAGE_DEGRADED');
      expect(recorded?.severity).toBe('WARN');
    });
  });

  describe('6.5 — o portão de saída', () => {
    it('writes the guard verdict of the served article as an INFO event with the measures', async () => {
      await triggerPipeline();
      await vi.waitFor(() => expect(finalEvent()).toBeDefined());

      expect(stageEvents(6.5)).toEqual([
        expect.objectContaining({
          level: 'INFO',
          message: 'Output guard passed',
          context: { provider: 'gemini', chars: 640, words: 100, ptRatio: 0.42, urls: 0, findings: [] },
        }),
      ]);
    });

    it('fails the day at 6.5 on a security block — FATAL, the host in the fingerprint, no fallback served', async () => {
      // O `ai.service` lança sem chamar o Groq (medido na suíte dele); aqui,
      // o que o pipeline faz com o erro que chegou.
      vi.mocked(generateArticle).mockRejectedValue(
        new GateBlockedError({
          gate: 'exit',
          check: 'unanchored-url',
          reason: 'security',
          detail: 'evil.example',
          provider: 'gemini',
        }),
      );

      await triggerPipeline();
      await vi.waitFor(() => expect(failedUpdate()).toBeDefined());

      expect(prisma.article.upsert).not.toHaveBeenCalled();
      expect(failedUpdate()).toMatchObject({
        errorStage: 6.5,
        error: expect.stringContaining('re-triggering repeats the attack'),
        errorDetail: expect.objectContaining({ gate: 'exit', check: 'unanchored-url', reason: 'security', provider: 'gemini' }),
      });
      expect(stageEvents(6.5)).toEqual([expect.objectContaining({ level: 'ERROR' })]);

      // `FATAL` escreve na hora — sem esperar os 30 s do flush —, então o
      // buffer já está vazio quando se olha: o registro está no `upsert`.
      await vi.waitFor(() => expect(prisma.errorEvent.upsert).toHaveBeenCalled());
      expect(pendingErrorEvents().find((e) => e.code === 'PIPELINE_GATE_BLOCKED')).toBeUndefined();
      const [written] = vi.mocked(prisma.errorEvent.upsert).mock.calls[0] as [{ create: Record<string, unknown> }];
      expect(written.create).toMatchObject({
        code: 'PIPELINE_GATE_BLOCKED',
        severity: 'FATAL',
        route: 'stage-6.5:unanchored-url',
        category: 'authorization',
        pipelineLogId: 'log-uuid-456',
      });
    });

    it('records the quality block of the primary as a 6.5 WARN when the fallback served', async () => {
      vi.mocked(generateArticle).mockResolvedValueOnce({
        ...mockGeneratedArticle,
        provider: 'groq',
        modelVersion: 'openai/gpt-oss-20b',
        primaryError: new GateBlockedError({
          gate: 'exit',
          check: 'language',
          reason: 'quality',
          detail: 'pt ratio 0.04 < 0.2',
          provider: 'gemini',
        }),
      });

      await triggerPipeline();
      await vi.waitFor(() => expect(finalEvent()).toBeDefined());

      // O `WARN` é da 6.5 — quem recusou foi o guarda, não o Gemini —, e a
      // etapa 6 não ganha aviso nenhum.
      expect(stageEvents(6).filter((e) => e.level === 'WARN')).toEqual([]);
      expect(stageEvents(6.5)).toEqual([
        expect.objectContaining({
          level: 'WARN',
          message: 'Output guard blocked the primary attempt, fallback served',
          context: expect.objectContaining({ gate: 'exit', check: 'language', reason: 'quality', provider: 'gemini', fallbackProvider: 'groq' }),
        }),
        expect.objectContaining({ level: 'INFO', message: 'Output guard passed' }),
      ]);
      expect(finalEvent()?.context).toMatchObject({ provider: 'groq', degradedBy: [6.5] });
      expect(derived()).toEqual([6.5]);

      const recorded = pendingErrorEvents().find((e) => e.code === 'PIPELINE_GATE_BLOCKED');
      expect(recorded).toMatchObject({ severity: 'WARN', route: 'stage-6.5:language', category: 'contract' });
    });

    it('degrades the day by 6.5 once when the served article carries warnings, even after a recovered block', async () => {
      vi.mocked(generateArticle).mockResolvedValueOnce({
        ...mockGeneratedArticle,
        provider: 'groq',
        modelVersion: 'openai/gpt-oss-20b',
        primaryError: new GateBlockedError({ gate: 'exit', check: 'size', reason: 'quality', detail: '24000 chars > 20000', provider: 'gemini' }),
        guard: passingOutputGuard({
          warnings: [{ check: 'instruction-text', detail: 'ignore as instruções anteriores' }],
        }),
      });

      await triggerPipeline();
      await vi.waitFor(() => expect(finalEvent()).toBeDefined());

      expect(stageEvents(6.5).map((e) => e.message)).toEqual([
        'Output guard blocked the primary attempt, fallback served',
        'Output guard passed with warnings',
      ]);
      expect(stageEvents(6.5)[1]?.context).toMatchObject({
        findings: ['instruction-text'],
        warnings: ['instruction-text: ignore as instruções anteriores'],
      });
      // Uma vez só — o resumo e a derivação têm de bater.
      expect(finalEvent()?.context).toMatchObject({ degradedBy: [6.5] });
      expect(derived()).toEqual([6.5]);
    });

    it('writes the primary WARN at the gate stage when the Groq fallback then failed', async () => {
      const groqError = new Error('Groq API error: 500 Internal Server Error');
      (groqError as Error & { primaryError?: unknown }).primaryError = new GateBlockedError({
        gate: 'exit',
        check: 'language',
        reason: 'quality',
        detail: 'pt ratio 0.03 < 0.2',
        provider: 'gemini',
      });
      vi.mocked(generateArticle).mockRejectedValue(groqError);

      await triggerPipeline();
      await vi.waitFor(() => expect(failedUpdate()).toBeDefined());

      // O run falhou na 6 (o Groq caiu), e o aviso do primário é da 6.5 — a
      // etapa do portão que o recusou.
      expect(failedUpdate()).toMatchObject({ errorStage: 6 });
      expect(stageEvents(6.5)).toEqual([
        expect.objectContaining({
          level: 'WARN',
          message: 'Primary provider failed before fallback',
          context: expect.objectContaining({ gate: 'exit', check: 'language' }),
        }),
      ]);
    });
  });
});
