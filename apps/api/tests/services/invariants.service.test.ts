import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { PRODUCT_EVENT_RETENTION_DAYS } from '@newranews/types';
import type { InvariantId } from '@newranews/types';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      news: { aggregate: vi.fn() },
      pipelineLog: { aggregate: vi.fn(), count: vi.fn(), findMany: vi.fn() },
      article: { aggregate: vi.fn(), count: vi.fn() },
      productEvent: { aggregate: vi.fn() },
      errorEvent: { aggregate: vi.fn() },
      auditEvent: { aggregate: vi.fn() },
      sourceHealth: { aggregate: vi.fn() },
      dailyMetric: { findMany: vi.fn() },
      newsletterLog: { count: vi.fn() },
      pipelineEvent: { findFirst: vi.fn() },
    },
  };
});

import { prisma } from '@newranews/database';
import {
  INVARIANTS_BUDGET_MS,
  INVARIANTS_STAGE,
  INVARIANT_IDS,
  RETENTION_INVARIANTS,
  getLatestInvariantReport,
  runInvariants,
} from '../../src/services/invariants.service';
import { AUDIT_EVENT_RETENTION_DAYS } from '../../src/services/audit.service';
import {
  ERROR_EVENT_RETENTION_DAYS,
  INVARIANT_VIOLATED_CODE,
  pendingErrorEvents,
  resetErrorEventBuffer,
} from '../../src/services/error-event.service';
import {
  ARTICLE_RETENTION_DAYS,
  NEWS_RETENTION_DAYS,
  PIPELINE_LOG_RETENTION_DAYS,
} from '../../src/services/retention';
import { STALE_RUN_MS } from '../../src/services/run-outcome';
import { SOURCE_HEALTH_RETENTION_DAYS } from '../../src/services/source-health.service';
import { AppError } from '../../src/utils/errors';

/**
 * A suíte de invariantes (§10 do plano de observabilidade, Fase 6).
 *
 * Três coisas se medem aqui, e as três são o que a §10 exige por escrito:
 *
 * 1. **cada invariante pergunta a coisa certa** — a consulta, a janela, o
 *    limiar, e o que sai como `observed`/`expected`;
 * 2. **nenhuma carrega linha, e o loop gira no meio** — pelo parser sobre a
 *    forma de cada `prisma.*` do arquivo, e pelo mesmo desenho do
 *    renormalizador (um `setImmediate` agendado antes, um contador lido
 *    dentro). É a armadilha 4 do §17: suíte de invariante é o que vira
 *    varredura sem ninguém perceber, e o sintoma seria um `SIGTERM`;
 * 3. **há uma retenção por tabela que a etapa 8 expurga** — derivada do
 *    `Promise.all` do cleanup, para a próxima tabela com expurgo não nascer
 *    sem a invariante ao lado. A lista da §10 tinha seis para sete tabelas.
 */

const NOW = new Date('2026-09-16T11:01:00.000Z');
const RUN = 'run-hoje';
const DAY_MS = 86_400_000;

/** Tudo em ordem: nenhuma violação, nenhum erro. */
function allHealthy() {
  const fresh = { _min: { createdAt: NOW, startedAt: NOW, occurredAt: NOW, windowStart: NOW, day: NOW } };
  vi.mocked(prisma.news.aggregate).mockResolvedValue(fresh as never);
  vi.mocked(prisma.pipelineLog.aggregate).mockResolvedValue(fresh as never);
  vi.mocked(prisma.article.aggregate).mockResolvedValue(fresh as never);
  vi.mocked(prisma.productEvent.aggregate).mockResolvedValue(fresh as never);
  vi.mocked(prisma.errorEvent.aggregate).mockResolvedValue(fresh as never);
  vi.mocked(prisma.auditEvent.aggregate).mockResolvedValue(fresh as never);
  vi.mocked(prisma.sourceHealth.aggregate).mockResolvedValue(fresh as never);
  vi.mocked(prisma.article.count).mockImplementation(async (args) => {
    const where = (args as { where: { sources?: unknown } }).where;
    return where.sources === undefined ? 7 : 0;
  });
  vi.mocked(prisma.pipelineLog.count).mockResolvedValue(0);
  vi.mocked(prisma.pipelineLog.findMany).mockResolvedValue([
    { startedAt: new Date('2026-09-15T11:00:10.000Z') },
    { startedAt: new Date('2026-09-14T11:00:10.000Z') },
  ] as never);
  vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue([
    { date: new Date('2026-09-15T00:00:00.000Z') },
    { date: new Date('2026-09-14T00:00:00.000Z') },
  ] as never);
  vi.mocked(prisma.newsletterLog.count).mockResolvedValue(0);
}

function resultOf(report: Awaited<ReturnType<typeof runInvariants>>, id: InvariantId) {
  const found = report.results.find((result) => result.id === id);
  if (!found) throw new Error(`sem resultado para ${id}`);
  return found;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetErrorEventBuffer();
  allHealthy();
});

describe('§10 — a suíte roda inteira, na ordem da tabela', () => {
  it('runs the twelve, in order, and reports zero violated when all hold', async () => {
    const report = await runInvariants({ pipelineLogId: RUN, now: NOW });

    expect(report.results.map((result) => result.id)).toEqual([...INVARIANT_IDS]);
    expect(INVARIANT_IDS).toHaveLength(12);
    expect(report).toMatchObject({ checked: 12, violated: 0, errored: 0, budgetMs: INVARIANTS_BUDGET_MS });
    expect(report.results.every((result) => result.status === 'OK')).toBe(true);
    expect(report.results.every((result) => result.durationMs >= 0)).toBe(true);
    expect(pendingErrorEvents()).toEqual([]);
  });

  it('keeps going when one query throws — that result is ERROR, the others still answer', async () => {
    vi.mocked(prisma.article.count).mockRejectedValue(new Error('relation "Article" does not exist'));

    const report = await runInvariants({ pipelineLogId: RUN, now: NOW });

    expect(report.errored).toBe(2);
    expect(resultOf(report, 'briefing.one_per_day')).toMatchObject({
      status: 'ERROR',
      observed: null,
      error: 'relation "Article" does not exist',
    });
    expect(resultOf(report, 'newsletter.delivered').status).toBe('OK');
    // Uma pergunta que não pôde ser feita não é uma violação: nada no buffer.
    expect(pendingErrorEvents()).toEqual([]);
  });

  it('breathes between checks — the event loop turns in the middle of the suite', async () => {
    // O mesmo desenho do renormalizador: um `setImmediate` agendado **antes**
    // só roda quando alguém devolve o controle ao Node, e o contador diz em
    // que ponto da suíte isso aconteceu.
    let queries = 0;
    for (const model of Object.values(prisma) as Array<Record<string, ReturnType<typeof vi.fn>>>) {
      for (const method of Object.values(model)) {
        const impl = method.getMockImplementation();
        method.mockImplementation(async (...args: unknown[]) => {
          queries += 1;
          return impl ? impl(...args) : undefined;
        });
      }
    }
    let queriesWhenLoopTurned = -1;
    setImmediate(() => {
      queriesWhenLoopTurned = queries;
    });

    await runInvariants({ pipelineLogId: RUN, now: NOW });

    // Girou antes da primeira consulta (a etapa 9 acabou de ir ao banco) e
    // antes de a suíte acabar — nunca só no fim.
    expect(queriesWhenLoopTurned).toBe(0);
    expect(queries).toBeGreaterThan(0);
  });
});

describe('§10 — as retenções: uma por tabela que a etapa 8 expurga', () => {
  const RETENTIONS: Array<[InvariantId, number]> = [
    ['retention.news', NEWS_RETENTION_DAYS],
    ['retention.pipelineLog', PIPELINE_LOG_RETENTION_DAYS],
    ['retention.article', ARTICLE_RETENTION_DAYS],
    ['retention.productEvent', PRODUCT_EVENT_RETENTION_DAYS],
    ['retention.errorEvent', ERROR_EVENT_RETENTION_DAYS],
    ['retention.auditEvent', AUDIT_EVENT_RETENTION_DAYS],
    ['retention.sourceHealth', SOURCE_HEALTH_RETENTION_DAYS],
  ];

  it('covers every retention constant, with the threshold one day past it', () => {
    expect(RETENTION_INVARIANTS.map((r) => [r.id, r.retentionDays])).toEqual(RETENTIONS);
  });

  it('covers every table the cleanup purges — derived from the Promise.all of stage 8', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../../src/services/pipeline.service.ts'),
      'utf8',
    );
    const tree = ts.createSourceFile('pipeline.service.ts', source, ts.ScriptTarget.Latest, true);
    let purged: string[] = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText() === 'Promise.all' &&
        node.arguments[0] &&
        ts.isArrayLiteralExpression(node.arguments[0]) &&
        node.arguments[0].elements.some((element) => element.getText().includes('deleteMany'))
      ) {
        purged = node.arguments[0].elements.map((element) => element.getText().split('(')[0] ?? '');
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);

    // Um parser que não achasse o cleanup aprovaria tudo.
    expect(purged.length).toBeGreaterThanOrEqual(7);
    expect(RETENTION_INVARIANTS).toHaveLength(purged.length);
  });

  it.each(RETENTIONS)('%s violates when the oldest row is older than %s + 1 days', async (id, days) => {
    const model = {
      'retention.news': prisma.news.aggregate,
      'retention.pipelineLog': prisma.pipelineLog.aggregate,
      'retention.article': prisma.article.aggregate,
      'retention.productEvent': prisma.productEvent.aggregate,
      'retention.errorEvent': prisma.errorEvent.aggregate,
      'retention.auditEvent': prisma.auditEvent.aggregate,
      'retention.sourceHealth': prisma.sourceHealth.aggregate,
    }[id as string];
    const threshold = new Date(NOW.getTime() - (days + 1) * DAY_MS);
    const tooOld = new Date(threshold.getTime() - 60_000);
    const stale = { _min: { createdAt: tooOld, startedAt: tooOld, occurredAt: tooOld, windowStart: tooOld, day: tooOld } };
    vi.mocked(model!).mockResolvedValue(stale as never);

    const report = await runInvariants({ pipelineLogId: RUN, now: NOW });

    expect(resultOf(report, id)).toMatchObject({
      status: 'VIOLATED',
      measure: 'oldest',
      observed: tooOld.toISOString(),
      expected: threshold.toISOString(),
    });
    expect(report.violated).toBe(1);
  });

  it('holds vacuously on an empty table — null is not "older than the threshold"', async () => {
    vi.mocked(prisma.auditEvent.aggregate).mockResolvedValue({ _min: { createdAt: null } } as never);

    const report = await runInvariants({ pipelineLogId: RUN, now: NOW });

    expect(resultOf(report, 'retention.auditEvent')).toMatchObject({ status: 'OK', observed: null });
  });
});

describe('§10 — as cinco de contagem', () => {
  it('briefing.one_per_day counts the seven calendar days ending today, and wants exactly seven', async () => {
    vi.mocked(prisma.article.count).mockImplementation(async (args) => {
      const where = (args as { where: { sources?: unknown } }).where;
      return where.sources === undefined ? 6 : 0;
    });

    const report = await runInvariants({ pipelineLogId: RUN, now: NOW });

    expect(prisma.article.count).toHaveBeenCalledWith({
      where: {
        date: {
          gte: new Date('2026-09-10T00:00:00.000Z'),
          lte: new Date('2026-09-16T00:00:00.000Z'),
        },
      },
    });
    expect(resultOf(report, 'briefing.one_per_day')).toMatchObject({
      status: 'VIOLATED',
      measure: 'count',
      observed: 6,
      expected: 7,
    });
  });

  it('briefing.has_sources asks for briefings of the week with no BriefingSource at all', async () => {
    vi.mocked(prisma.article.count).mockImplementation(async (args) => {
      const where = (args as { where: { sources?: unknown } }).where;
      return where.sources === undefined ? 7 : 2;
    });

    const report = await runInvariants({ pipelineLogId: RUN, now: NOW });

    expect(prisma.article.count).toHaveBeenCalledWith({
      where: {
        date: {
          gte: new Date('2026-09-10T00:00:00.000Z'),
          lte: new Date('2026-09-16T00:00:00.000Z'),
        },
        sources: { none: {} },
      },
    });
    expect(resultOf(report, 'briefing.has_sources')).toMatchObject({
      status: 'VIOLATED',
      observed: 2,
      expected: 0,
    });
  });

  it('pipeline.no_stale_running uses STALE_RUN_MS and leaves the current run out', async () => {
    vi.mocked(prisma.pipelineLog.count).mockResolvedValue(1);

    const report = await runInvariants({ pipelineLogId: RUN, now: NOW });

    expect(prisma.pipelineLog.count).toHaveBeenCalledWith({
      where: {
        status: 'RUNNING',
        startedAt: { lt: new Date(NOW.getTime() - STALE_RUN_MS) },
        id: { not: RUN },
      },
    });
    expect(resultOf(report, 'pipeline.no_stale_running')).toMatchObject({
      status: 'VIOLATED',
      observed: 1,
      expected: 0,
    });
  });

  it('metrics.day_recorded compares run days with metric days in UTC and names the missing ones', async () => {
    vi.mocked(prisma.pipelineLog.findMany).mockResolvedValue([
      { startedAt: new Date('2026-09-15T11:00:10.000Z') },
      { startedAt: new Date('2026-09-14T11:00:10.000Z') },
      // 23:30 UTC de 12/09 é 12/09, não 13/09 — a chave é o dia UTC.
      { startedAt: new Date('2026-09-12T23:30:00.000Z') },
    ] as never);
    vi.mocked(prisma.dailyMetric.findMany).mockResolvedValue([
      { date: new Date('2026-09-15T00:00:00.000Z') },
    ] as never);

    const report = await runInvariants({ pipelineLogId: RUN, now: NOW });

    // Duas consultas de uma coluna só, sobre a janela dos runs que existem.
    expect(prisma.pipelineLog.findMany).toHaveBeenCalledWith({
      where: { status: 'SUCCESS', startedAt: { gte: new Date('2026-08-17T00:00:00.000Z') } },
      select: { startedAt: true },
    });
    expect(prisma.dailyMetric.findMany).toHaveBeenCalledWith({
      where: { date: { gte: new Date('2026-08-17T00:00:00.000Z') } },
      select: { date: true },
    });
    expect(resultOf(report, 'metrics.day_recorded')).toMatchObject({
      status: 'VIOLATED',
      observed: 2,
      expected: 0,
      detail: '2026-09-12, 2026-09-14',
    });
  });

  it('newsletter.delivered counts days with someone to send to and nobody reached', async () => {
    vi.mocked(prisma.newsletterLog.count).mockResolvedValue(3);

    const report = await runInvariants({ pipelineLogId: RUN, now: NOW });

    expect(prisma.newsletterLog.count).toHaveBeenCalledWith({
      where: {
        date: {
          gte: new Date('2026-09-10T00:00:00.000Z'),
          lte: new Date('2026-09-16T00:00:00.000Z'),
        },
        total: { gt: 0 },
        sent: 0,
      },
    });
    expect(resultOf(report, 'newsletter.delivered')).toMatchObject({
      status: 'VIOLATED',
      observed: 3,
      expected: 0,
    });
  });
});

describe('§10 — cada violação é um ErrorEvent com o id no fingerprint', () => {
  it('records origin INVARIANT, severity WARN, the code, the id as route and the run', async () => {
    vi.mocked(prisma.pipelineLog.count).mockResolvedValue(1);
    vi.mocked(prisma.newsletterLog.count).mockResolvedValue(2);

    const report = await runInvariants({ pipelineLogId: RUN, now: NOW });

    expect(report.violated).toBe(2);
    const pending = pendingErrorEvents();
    expect(pending).toHaveLength(2);
    expect(pending.map((entry) => entry.route).sort()).toEqual([
      'newsletter.delivered',
      'pipeline.no_stale_running',
    ]);
    for (const entry of pending) {
      expect(entry).toMatchObject({
        origin: 'INVARIANT',
        severity: 'WARN',
        code: INVARIANT_VIOLATED_CODE,
        category: 'contract',
        pipelineLogId: RUN,
        count: 1,
      });
      expect(entry.fingerprint).toBe(`INVARIANT:WARN:${INVARIANT_VIOLATED_CODE}:${entry.route}`);
    }
    // A mensagem diz o que foi medido; o `context` carrega os dois números.
    const stale = pending.find((entry) => entry.route === 'pipeline.no_stale_running');
    expect(stale?.message).toBe('pipeline.no_stale_running: observed 1, expected 0');
    expect(stale?.context).toEqual({ observed: 1, expected: 0 });
  });

  it('writes one line per invariant, not one per row it measured — ten days are ten lines', async () => {
    vi.mocked(prisma.newsletterLog.count).mockResolvedValue(400);

    await runInvariants({ pipelineLogId: RUN, now: NOW });
    await runInvariants({ pipelineLogId: 'run-amanha', now: new Date(NOW.getTime() + DAY_MS) });

    // Duas horas distintas → duas linhas, cada uma com `count: 1`.
    expect(pendingErrorEvents().map((entry) => entry.count)).toEqual([1, 1]);
  });
});

describe('§10 — nenhuma consulta carrega linha (pelo parser)', () => {
  const SOURCE = path.resolve(__dirname, '../../src/services/invariants.service.ts');

  interface PrismaCall {
    model: string;
    method: string;
    /** As chaves do argumento (`where`, `select`, `include`, `_min`, …). */
    argumentKeys: string[];
    /** As chaves do `select`, quando há. */
    selectKeys: string[];
    line: number;
  }

  function prismaCalls(): PrismaCall[] {
    const tree = ts.createSourceFile(SOURCE, readFileSync(SOURCE, 'utf8'), ts.ScriptTarget.Latest, true);
    const calls: PrismaCall[] = [];
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        node.expression.expression.expression.getText() === 'prisma'
      ) {
        const argument = node.arguments[0];
        const keysOf = (expression: ts.Expression | undefined): string[] =>
          expression && ts.isObjectLiteralExpression(expression)
            ? expression.properties.map((property) => property.name?.getText() ?? '')
            : [];
        const select =
          argument && ts.isObjectLiteralExpression(argument)
            ? argument.properties.find(
                (property): property is ts.PropertyAssignment =>
                  ts.isPropertyAssignment(property) && property.name.getText() === 'select',
              )
            : undefined;
        calls.push({
          model: node.expression.expression.name.text,
          method: node.expression.name.text,
          argumentKeys: keysOf(argument),
          selectKeys: keysOf(select?.initializer),
          line: tree.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
    return calls;
  }

  it('finds the queries at all — an empty scan would approve everything', () => {
    expect(prismaCalls().length).toBeGreaterThanOrEqual(12);
  });

  it.each(prismaCalls().map((call) => [`${call.model}.${call.method}`, call.line, call] as const))(
    '%s (line %s) is an aggregate, a count, or a one-column select — never a row',
    (_name, _line, call) => {
      if (call.method === 'aggregate' || call.method === 'count') return;
      // A leitura da rota é um `findFirst` do último evento — uma linha, de
      // propósito, com `select` explícito.
      if (call.method === 'findFirst') {
        expect(call.selectKeys.length).toBeGreaterThan(0);
        return;
      }
      expect(call.method).toBe('findMany');
      expect(call.argumentKeys).not.toContain('include');
      expect(call.selectKeys).toHaveLength(1);
    },
  );

  it('the stage number is the one the diagrams draw', () => {
    expect(INVARIANTS_STAGE).toBe(9.5);
  });
});

describe('§10 — a leitura: o último evento da etapa 9.5, nunca a suíte de novo', () => {
  it('returns null before the first run with the stage', async () => {
    vi.mocked(prisma.pipelineEvent.findFirst).mockResolvedValue(null);

    expect(await getLatestInvariantReport()).toBeNull();
    expect(prisma.pipelineEvent.findFirst).toHaveBeenCalledWith({
      where: { stage: INVARIANTS_STAGE },
      orderBy: { createdAt: 'desc' },
      select: { context: true, createdAt: true, pipelineLogId: true },
    });
  });

  it('returns what the stage wrote, with the event time and run attached', async () => {
    const written = await runInvariants({ pipelineLogId: RUN, now: NOW });
    vi.mocked(prisma.pipelineEvent.findFirst).mockResolvedValue({
      context: written,
      createdAt: new Date('2026-09-16T11:01:02.000Z'),
      pipelineLogId: RUN,
    } as never);

    expect(await getLatestInvariantReport()).toEqual({
      checkedAt: '2026-09-16T11:01:02.000Z',
      pipelineLogId: RUN,
      ...written,
    });
  });

  it('refuses a context it cannot read as a contract failure, not as "no report"', async () => {
    vi.mocked(prisma.pipelineEvent.findFirst).mockResolvedValue({
      context: { checked: 'doze' },
      createdAt: NOW,
      pipelineLogId: RUN,
    } as never);

    await expect(getLatestInvariantReport()).rejects.toMatchObject({
      statusCode: 500,
      category: 'contract',
    });
    await expect(getLatestInvariantReport()).rejects.toBeInstanceOf(AppError);
  });
});
