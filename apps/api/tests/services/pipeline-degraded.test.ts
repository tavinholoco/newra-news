import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerPipeline } from '../../src/services/pipeline.service';

/**
 * **O caminho degradado.** A §9.4 não persegue o dia em que tudo dá certo —
 * esse já tem suíte inteira em `pipeline.test.ts`. Persegue as quatro
 * perguntas que ninguém tinha respondido com teste:
 *
 * 1. o que acontece **no dia em que o pipeline não roda**;
 * 2. se a etapa 6 falha, a **8 roda**? e se rodar, ela apaga notícia de um dia
 *    que não gerou briefing?
 * 3. cada afirmação de **idempotência** vale um teste, ou a confirmação de que
 *    já existe;
 * 4. os números da **retenção** batem com os quatro lugares que os documentam?
 *
 * Cada `it` abaixo é uma dessas afirmações, escrita como afirmação e não como
 * cobertura de linha.
 */

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
      news: { createMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
      article: { upsert: vi.fn(), deleteMany: vi.fn() },
      productEvent: { deleteMany: vi.fn() },
      briefingSource: { deleteMany: vi.fn(), createMany: vi.fn() },
      dailyMetric: { upsert: vi.fn() },
      pipelineEvent: { create: vi.fn() },
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

const item = (url: string) => ({
  title: 'Notícia',
  description: 'Descrição',
  content: null,
  source: 'G1',
  sourceUrl: url,
  imageUrl: null,
  category: 'WORLD' as const,
  publishedAt: new Date('2026-08-23T10:00:00Z'),
});

const fetchResult = {
  newsDataItems: [item('https://g1.com/1')],
  rssItems: [item('https://bbc.com/1')],
  allItems: [item('https://g1.com/1'), item('https://bbc.com/1')],
};

/** Espera o `void runPipeline(...)` que o `triggerPipeline` dispara. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.pipelineLog.findFirst).mockResolvedValue(null);
  // `startedAt` tem default no schema e o `create` real a devolve; o
  // `triggerPipeline` lê dela para dizer quando o run começou.
  vi.mocked(prisma.pipelineLog.create).mockResolvedValue({
    id: 'log-1',
    startedAt: new Date('2026-08-25T16:30:00.000Z'),
  } as never);
  vi.mocked(prisma.pipelineLog.update).mockResolvedValue({ id: 'log-1' } as never);
  vi.mocked(prisma.pipelineLog.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.news.createMany).mockResolvedValue({ count: 2 });
  vi.mocked(prisma.news.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.news.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.article.upsert).mockResolvedValue({ id: 'article-1' } as never);
  vi.mocked(prisma.article.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.productEvent.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.briefingSource.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.briefingSource.createMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.dailyMetric.upsert).mockResolvedValue({} as never);
  vi.mocked(prisma.pipelineEvent.create).mockResolvedValue({} as never);
  vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
  vi.mocked(fetchAll).mockResolvedValue(fetchResult);
  vi.mocked(generateArticle).mockResolvedValue({
    article: { title: 'T', summary: 'S', content: 'C' },
    provider: 'gemini',
    modelVersion: 'gemini-2.5-flash',
  });
  vi.mocked(renormalizeStoredNews).mockResolvedValue({
    dryRun: false,
    scanned: 0,
    textChanged: 0,
    categoryChanged: 0,
    categorySkipped: 0,
    transitions: [],
    sample: [],
  });
  vi.mocked(sendDailyNewsletter).mockResolvedValue({ total: 0, sent: 0, failed: 0 });
});

describe('9.4 — a etapa crítica falha: o que para junto', () => {
  it('does not run the cleanup when the AI stage fails', async () => {
    // **A pergunta da §9.4, respondida:** se a 6 falha, a 8 **não** roda. O
    // `throw` sobe direto para o `catch` do `runPipeline`, e as etapas
    // não-críticas ficam para trás junto com a crítica.
    //
    // Isso é o comportamento certo, e a razão importa: no dia sem briefing, o
    // cleanup **não apaga** as notícias que já passaram dos 30 dias. Elas ficam
    // um dia a mais e saem no run seguinte — o custo é uma varredura maior
    // amanhã, e a alternativa seria apagar acervo num dia em que o produto já
    // está degradado.
    vi.mocked(generateArticle).mockRejectedValue(new Error('Gemini API error 500: boom'));

    await triggerPipeline();
    await settle();

    expect(prisma.news.deleteMany).not.toHaveBeenCalled();
    expect(prisma.article.deleteMany).not.toHaveBeenCalled();
    expect(prisma.productEvent.deleteMany).not.toHaveBeenCalled();
  });

  it('does not persist an article when the AI stage fails', async () => {
    vi.mocked(generateArticle).mockRejectedValue(new Error('boom'));

    await triggerPipeline();
    await settle();

    expect(prisma.article.upsert).not.toHaveBeenCalled();
    expect(prisma.briefingSource.createMany).not.toHaveBeenCalled();
  });

  it('marks the run FAILED with the stage that broke', async () => {
    vi.mocked(generateArticle).mockRejectedValue(new Error('boom'));

    await triggerPipeline();
    await settle();

    const failure = vi
      .mocked(prisma.pipelineLog.update)
      .mock.calls.map((call) => (call[0] as { data: { status?: string; errorStage?: number } }).data)
      .find((data) => data.status === 'FAILED');

    expect(failure?.errorStage).toBe(6);
  });

  it('keeps the collected news even when the day produces no briefing', async () => {
    // A etapa 4 vem antes da 6: a notícia do dia entra no acervo mesmo quando o
    // briefing não sai. É o que faz a `/news` continuar viva num dia sem
    // artigo — e o que permite que o run seguinte trabalhe sobre ela.
    vi.mocked(generateArticle).mockRejectedValue(new Error('boom'));

    await triggerPipeline();
    await settle();

    expect(prisma.news.createMany).toHaveBeenCalledOnce();
  });

  it('aborts when the day collected nothing to work with', async () => {
    // Feed vazio não é "dia tranquilo", é coleta quebrada. Gerar briefing de
    // nada seria o modelo inventando o dia — exatamente o que o prompt proíbe.
    vi.mocked(fetchAll).mockResolvedValue({
      newsDataItems: [],
      rssItems: [],
      allItems: [],
    });

    await triggerPipeline();
    await settle();

    expect(generateArticle).not.toHaveBeenCalled();
    const failure = vi
      .mocked(prisma.pipelineLog.update)
      .mock.calls.map((call) => (call[0] as { data: { status?: string; errorStage?: number } }).data)
      .find((data) => data.status === 'FAILED');
    expect(failure?.errorStage).toBe(5);
  });
});

describe('9.4 — a etapa não-crítica falha: o que segue', () => {
  it('still cleans up and records metrics when the newsletter throws', async () => {
    vi.mocked(sendDailyNewsletter).mockRejectedValue(new Error('resend down'));

    await triggerPipeline();
    await settle();

    expect(prisma.news.deleteMany).toHaveBeenCalled();
    expect(prisma.dailyMetric.upsert).toHaveBeenCalled();
  });

  it('still renormalizes and records metrics when the cleanup throws', async () => {
    vi.mocked(prisma.news.deleteMany).mockRejectedValue(new Error('lock timeout'));

    await triggerPipeline();
    await settle();

    expect(renormalizeStoredNews).toHaveBeenCalled();
    expect(prisma.dailyMetric.upsert).toHaveBeenCalled();
  });

  it('counts a failed cleanup as a pipeline error, and a failed newsletter as not', async () => {
    // A distinção é de produto, não de código: a newsletter é opcional e a
    // indisponibilidade do provedor não deve marcar o dia como falha; o
    // cleanup é manutenção do banco, e falhar nele é problema.
    vi.mocked(sendDailyNewsletter).mockRejectedValue(new Error('resend down'));

    await triggerPipeline();
    await settle();

    const metrics = vi.mocked(prisma.dailyMetric.upsert).mock.calls[0]?.[0] as {
      create: { pipelineErrors: number };
    };
    expect(metrics.create.pipelineErrors).toBe(0);
  });

  it('still marks the run SUCCESS when only non-critical stages failed', async () => {
    vi.mocked(sendDailyNewsletter).mockRejectedValue(new Error('resend down'));
    vi.mocked(renormalizeStoredNews).mockRejectedValue(new Error('boom'));

    await triggerPipeline();
    await settle();

    const statuses = vi
      .mocked(prisma.pipelineLog.update)
      .mock.calls.map((call) => (call[0] as { data: { status?: string } }).data.status)
      .filter(Boolean);

    expect(statuses).toContain('SUCCESS');
    expect(statuses).not.toContain('FAILED');
  });
});

describe('9.4 — idempotência, uma afirmação por vez', () => {
  it('does not start a second run when one already succeeded today', async () => {
    // A fixture traz `status` e `startedAt` porque a linha real tem os dois, e
    // é deles que sai o desfecho que o painel exibe.
    vi.mocked(prisma.pipelineLog.findFirst).mockResolvedValue({
      id: 'earlier',
      status: 'SUCCESS',
      startedAt: new Date('2026-08-25T11:00:00.000Z'),
    } as never);

    const result = await triggerPipeline();

    expect(result.pipelineId).toBe('earlier');
    // **E ele diz que não disparou.** Antes devolvia só o id, e o painel
    // imprimia "disparado com sucesso" — foi o que aconteceu em 25/08/2026.
    expect(result.outcome).toBe('already-succeeded-today');
    expect(prisma.pipelineLog.create).not.toHaveBeenCalled();
  });

  it('does not start a second run while one is RUNNING', async () => {
    // O mesmo `findFirst` cobre os dois estados, e é de propósito: dois runs
    // simultâneos disputariam o mesmo `upsert` de artigo do dia.
    vi.mocked(prisma.pipelineLog.findFirst).mockResolvedValue({
      id: 'running',
      status: 'RUNNING',
      startedAt: new Date('2026-08-25T16:25:00.000Z'),
    } as never);

    await triggerPipeline();

    const where = vi.mocked(prisma.pipelineLog.findFirst).mock.calls[0]?.[0] as {
      where: { status: { in: string[] } };
    };
    expect(where.where.status.in).toEqual(['SUCCESS', 'RUNNING']);
  });

  it('leans on the unique constraint, not on skipDuplicates alone', async () => {
    // `skipDuplicates` só sabe pular o que o **banco** recusa; quem garante que
    // duas execuções no mesmo dia não dupliquem é a constraint única de
    // `News.sourceUrl`. Guarda da constraint em `tests/build/migrations.test.ts`.
    await triggerPipeline();
    await settle();

    const call = vi.mocked(prisma.news.createMany).mock.calls[0]?.[0] as {
      skipDuplicates: boolean;
    };
    expect(call.skipDuplicates).toBe(true);
  });

  it('replaces the briefing sources instead of appending on a same-day re-run', async () => {
    await triggerPipeline();
    await settle();

    expect(prisma.briefingSource.deleteMany).toHaveBeenCalled();
    // Delete e create na **mesma** transação: sem isso, uma falha entre os dois
    // deixaria o briefing sem fonte nenhuma.
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });
});

describe('9.4 — os números da retenção', () => {
  /**
   * Quatro lugares documentam estes números: o `CLAUDE.md` da raiz, o
   * `apps/api/CLAUDE.md`, a `docs/api.md` e a §4 de
   * `docs/v2/04-analytics-e-slots.md`. Este teste é o quinto, e é o único que
   * reprova quando o código discordar deles.
   */
  const DAY_MS = 86_400_000;

  function cutoffDays(mock: { mock: { calls: unknown[][] } }): number {
    const where = (mock.mock.calls[0]?.[0] as { where: Record<string, { lt: Date }> }).where;
    const cutoff = Object.values(where).find((clause) => clause?.lt)?.lt as Date;
    return Math.round((Date.now() - cutoff.getTime()) / DAY_MS);
  }

  it('cuts News at 30 days', async () => {
    await triggerPipeline();
    await settle();

    expect(cutoffDays(vi.mocked(prisma.news.deleteMany))).toBe(30);
  });

  it('cuts PipelineLog at 30 days, sparing the run doing the cutting', async () => {
    await triggerPipeline();
    await settle();

    expect(cutoffDays(vi.mocked(prisma.pipelineLog.deleteMany))).toBe(30);
    const where = vi.mocked(prisma.pipelineLog.deleteMany).mock.calls[0]?.[0] as {
      where: { id: { not: string } };
    };
    expect(where.where.id.not).toBe('log-1');
  });

  it('cuts Article at 90 days', async () => {
    await triggerPipeline();
    await settle();

    expect(cutoffDays(vi.mocked(prisma.article.deleteMany))).toBe(90);
  });

  it('keeps the briefing three times longer than the news it cites', async () => {
    // Não é coincidência de número: é por isso que `BriefingSource` guarda
    // **cópias** de título/fonte/URL em vez de um join. Dois terços dos
    // briefings retidos sobrevivem às notícias que os originaram.
    await triggerPipeline();
    await settle();

    expect(cutoffDays(vi.mocked(prisma.article.deleteMany))).toBe(
      cutoffDays(vi.mocked(prisma.news.deleteMany)) * 3,
    );
  });
});
