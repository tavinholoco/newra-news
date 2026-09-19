import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { SourceOutcome } from '@newranews/database';
import { rssSources } from '../../src/config/rss-sources';
import {
  FETCH_WARNING_KINDS,
  NEWSDATA_SOURCE,
  fetchAll,
  type FetchWarningKind,
  type SourceFetch,
} from '../../src/services/news-fetcher.service';
import {
  SOURCE_HEALTH_RETENTION_DAYS,
  buildSourceHealthRows,
  countKeptBySource,
  deleteExpiredSourceHealth,
  getSourceHealthReport,
  outcomeForSource,
  recordSourceHealth,
} from '../../src/services/source-health.service';
import type { RawNewsItem } from '../../src/providers/types';

/**
 * **A guarda da §15, com a tabela que a implementação decidiu.**
 *
 * O plano pedia "as quatro `FetchWarningKind` mapeiam para os quatro
 * `SourceOutcome`, exaustiva nos dois sentidos". O enum tem **três** valores —
 * "não tentada" é ausência de linha, derivada no web —, então a tabela aqui é:
 * cada classe de aviso tem um desfecho, e cada desfecho é `OK` (a ausência de
 * aviso) ou a imagem de alguma classe. Os dois lados são enumerados em tempo
 * de execução, e a `Record<FetchWarningKind, …>` faz o `tsc` reprovar a classe
 * nova sem linha antes de a suíte rodar.
 */

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      sourceHealth: {
        findMany: vi.fn(),
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

vi.mock('../../src/providers/news/newsdata.provider');
vi.mock('../../src/providers/news/rss.provider');

import { prisma } from '@newranews/database';
import { fetchFromNewsData } from '../../src/providers/news/newsdata.provider';
import { fetchFromRssWithOutcomes } from '../../src/providers/news/rss.provider';

const DAY = new Date('2026-09-15T00:00:00.000Z');

const item = (source: string, url: string): RawNewsItem => ({
  title: `Matéria de ${source}`,
  description: 'Descrição',
  content: null,
  source,
  sourceUrl: url,
  imageUrl: null,
  category: 'WORLD',
  publishedAt: new Date('2026-09-15T10:00:00.000Z'),
});

const fetch = (source: string, fetched: number, failure?: string): SourceFetch => ({
  source,
  kind: source === NEWSDATA_SOURCE ? 'AGGREGATOR' : 'RSS',
  fetched,
  latencyMs: 500,
  ...(failure !== undefined ? { failure } : {}),
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(prisma.sourceHealth.deleteMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.sourceHealth.createMany).mockResolvedValue({ count: 0 });
  vi.mocked(prisma.$transaction).mockResolvedValue([] as never);
});

describe('a tabela aviso → desfecho, exaustiva nos dois sentidos', () => {
  /**
   * O desfecho que cada classe de aviso produz **na fonte a que se refere**:
   * o `provider-*` da NewsData é o balde `newsdata`; o do RSS é cada um dos
   * doze feeds, porque o provider caiu (ou emudeceu) por cima deles.
   */
  const OUTCOME_OF_WARNING: Record<FetchWarningKind, SourceOutcome> = {
    'provider-failed': 'FAILED',
    'provider-empty': 'EMPTY',
    'feed-failed': 'FAILED',
    'feed-empty': 'EMPTY',
  };

  /** Uma matéria por feed configurado, tirando os nomeados. */
  const feedsExcept = (...silent: string[]) =>
    rssSources
      .filter((source) => !silent.includes(source.name))
      .map((source) => item(source.name, `https://exemplo.test/${encodeURIComponent(source.name)}`));

  const rssResult = (items: RawNewsItem[], failed: Record<string, string> = {}) => ({
    items,
    outcomes: rssSources.map((source) => {
      const failure = failed[source.name];
      if (failure) return { source: source.name, fetched: 0, latencyMs: 30_000, failure };
      return {
        source: source.name,
        fetched: items.filter((i) => i.source === source.name).length,
        latencyMs: 500,
      };
    }),
  });

  /** Um cenário de coleta que produz **exatamente** aquela classe de aviso, e as fontes afetadas. */
  const scenarioFor: Record<FetchWarningKind, () => { affected: string[] }> = {
    'provider-failed': () => {
      vi.mocked(fetchFromNewsData).mockRejectedValue(new Error('socket hang up'));
      vi.mocked(fetchFromRssWithOutcomes).mockResolvedValue(rssResult(feedsExcept()));
      return { affected: [NEWSDATA_SOURCE] };
    },
    'provider-empty': () => {
      vi.mocked(fetchFromNewsData).mockResolvedValue([item('Veículo', 'https://nd.test/1')]);
      vi.mocked(fetchFromRssWithOutcomes).mockResolvedValue(rssResult([]));
      return { affected: rssSources.map((s) => s.name) };
    },
    'feed-failed': () => {
      vi.mocked(fetchFromNewsData).mockResolvedValue([item('Veículo', 'https://nd.test/1')]);
      vi.mocked(fetchFromRssWithOutcomes).mockResolvedValue(
        rssResult(feedsExcept('Superinteressante'), { Superinteressante: 'ETIMEDOUT' }),
      );
      return { affected: ['Superinteressante'] };
    },
    'feed-empty': () => {
      vi.mocked(fetchFromNewsData).mockResolvedValue([item('Veículo', 'https://nd.test/1')]);
      vi.mocked(fetchFromRssWithOutcomes).mockResolvedValue(rssResult(feedsExcept('Veja Saúde')));
      return { affected: ['Veja Saúde'] };
    },
  };

  it.each(FETCH_WARNING_KINDS)('%s produces the outcome the table says, on the sources it names', async (kind) => {
    const { affected } = scenarioFor[kind]();

    const { warnings, sources } = await fetchAll();
    const rows = buildSourceHealthRows({ day: DAY, pipelineLogId: 'run-1', sources, keptBySource: new Map() });

    // O cenário produz a classe pedida, e só ela.
    expect(warnings.map((w) => w.kind)).toEqual([kind]);
    for (const source of affected) {
      const row = rows.find((r) => r.source === source);
      expect(row?.outcome, source).toBe(OUTCOME_OF_WARNING[kind]);
    }
    // E as fontes que o aviso não nomeia continuam OK.
    const untouched = rows.filter((r) => !affected.includes(r.source));
    expect(untouched.length).toBeGreaterThan(0);
    expect(untouched.every((r) => r.outcome === 'OK')).toBe(true);
  });

  it('every SourceOutcome is either OK or the image of some warning — the other direction', () => {
    const reachable = new Set<SourceOutcome>(['OK', ...Object.values(OUTCOME_OF_WARNING)]);
    expect([...reachable].sort()).toEqual(Object.values(SourceOutcome).sort());
  });

  it('enumerates the kinds at all — an empty tuple would pass everything', () => {
    expect(FETCH_WARNING_KINDS.length).toBe(4);
    expect(Object.keys(OUTCOME_OF_WARNING).sort()).toEqual([...FETCH_WARNING_KINDS].sort());
  });
});

describe('outcomeForSource — a distinção de 03/09', () => {
  it('a source that raised no warning and brought zero items is EMPTY, not FAILED', () => {
    // Perder isto aqui desfaria a distinção que custou dois dias de
    // Superinteressante em ETIMEDOUT parecendo "publicou devagar".
    expect(outcomeForSource({ fetched: 0 })).toBe('EMPTY');
  });

  it('a source that threw is FAILED even when the provider reported items for it', () => {
    expect(outcomeForSource({ fetched: 3, failure: 'XML inválido' })).toBe('FAILED');
  });

  it('a source that brought items is OK', () => {
    expect(outcomeForSource({ fetched: 1 })).toBe('OK');
  });
});

describe('kept — o item cuja URL entrou no acervo naquele dia', () => {
  const g1 = item('G1', 'https://g1.test/1');
  const g1Old = item('G1', 'https://g1.test/old');
  const folha = item('Folha de S.Paulo', 'https://folha.test/1');
  // O veículo "G1" pela NewsData: mesmo nome de fonte, outro provider.
  const g1ViaNewsData = item('G1', 'https://g1.test/via-newsdata');

  it('attributes by provider identity, never by the source name the aggregator carries', () => {
    const kept = countKeptBySource(
      [g1ViaNewsData, g1, folha],
      new Set([g1ViaNewsData]),
      () => true,
    );

    expect(kept.get(NEWSDATA_SOURCE)).toBe(1);
    expect(kept.get('G1')).toBe(1);
    expect(kept.get('Folha de S.Paulo')).toBe(1);
  });

  it('does not count the URL that was already in the archive before today', () => {
    const enteredToday = (url: string) => url !== g1Old.sourceUrl;

    const kept = countKeptBySource([g1, g1Old, folha], new Set(), enteredToday);

    expect(kept.get('G1')).toBe(1);
  });

  it('counts the URL a previous run of the same day persisted — so a re-run keeps honest numbers', () => {
    // O segundo run do dia (só depois de um FAILED) acha tudo gravado pelo
    // primeiro; contar "novo antes deste run" zeraria toda fonte e o
    // deleteMany + createMany gravaria isso por cima.
    const createdAt = new Map([
      [g1.sourceUrl, new Date('2026-09-15T11:00:05.000Z')],
      [folha.sourceUrl, new Date('2026-09-14T11:00:05.000Z')],
    ]);
    const enteredToday = (url: string) => (createdAt.get(url) ?? DAY) >= DAY;

    const kept = countKeptBySource([g1, folha], new Set(), enteredToday);

    expect(kept.get('G1')).toBe(1);
    expect(kept.get('Folha de S.Paulo')).toBeUndefined();
  });

  it('never exceeds fetched — the arithmetic that catches a column mix-up', () => {
    // Um cenário real: a NewsData trouxe o G1 também, o dedup ficou com a
    // cópia dela, e o feed do G1 rendeu 2 itens dos quais 1 sobreviveu.
    const g1Dup = item('G1', g1ViaNewsData.sourceUrl);
    const allItems = [g1ViaNewsData, g1, g1Dup, folha];
    const deduplicated = allItems.filter(
      (candidate, index) => allItems.findIndex((other) => other.sourceUrl === candidate.sourceUrl) === index,
    );
    const sources = [fetch(NEWSDATA_SOURCE, 1), fetch('G1', 2), fetch('Folha de S.Paulo', 1)];

    const rows = buildSourceHealthRows({
      day: DAY,
      pipelineLogId: 'run-1',
      sources,
      keptBySource: countKeptBySource(deduplicated, new Set([g1ViaNewsData]), () => true),
    });

    for (const row of rows) expect(row.kept, row.source).toBeLessThanOrEqual(row.fetched);
    expect(rows.find((r) => r.source === 'G1')?.kept).toBe(1);
    expect(rows.find((r) => r.source === NEWSDATA_SOURCE)?.kept).toBe(1);
  });
});

describe('buildSourceHealthRows — a forma da linha', () => {
  it('writes one row per attempted source and nothing for the source that is not in the list', () => {
    // A fonte fora de `rss-sources.ts` não é tentada, então não tem linha —
    // e não some da série: quem desenha a ausência é o web (como NEVER_RAN).
    const rows = buildSourceHealthRows({
      day: DAY,
      pipelineLogId: 'run-1',
      sources: [fetch(NEWSDATA_SOURCE, 60), fetch('G1', 50)],
      keptBySource: new Map([['G1', 30], ['Reuters', 12]]),
    });

    expect(rows.map((r) => r.source)).toEqual([NEWSDATA_SOURCE, 'G1']);
    expect(rows[1]).toEqual({
      source: 'G1',
      kind: 'RSS',
      day: DAY,
      fetched: 50,
      kept: 30,
      outcome: 'OK',
      failureReason: null,
      latencyMs: 500,
      pipelineLogId: 'run-1',
    });
  });

  it('keeps failureReason only on FAILED, redacted like any message that reaches a column', () => {
    const rows = buildSourceHealthRows({
      day: DAY,
      pipelineLogId: 'run-1',
      sources: [
        fetch('Superinteressante', 0, 'fetch failed: ETIMEDOUT for admin@super.abril.com.br'),
        fetch('Veja Saúde', 0),
      ],
      keptBySource: new Map(),
    });

    expect(rows[0]?.outcome).toBe('FAILED');
    expect(rows[0]?.failureReason).toContain('ETIMEDOUT');
    expect(rows[0]?.failureReason).not.toContain('admin@super.abril.com.br');
    expect(rows[1]?.outcome).toBe('EMPTY');
    expect(rows[1]?.failureReason).toBeNull();
  });
});

describe('recordSourceHealth — o último run do dia vence, numa transação', () => {
  it('deletes the day and recreates it in one transaction — two statements, not thirteen upserts', async () => {
    const rows = buildSourceHealthRows({
      day: DAY,
      pipelineLogId: 'run-2',
      sources: [fetch(NEWSDATA_SOURCE, 60), fetch('G1', 50)],
      keptBySource: new Map(),
    });

    const written = await recordSourceHealth(DAY, rows);

    expect(written).toBe(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.sourceHealth.deleteMany).toHaveBeenCalledWith({ where: { day: DAY } });
    expect(prisma.sourceHealth.createMany).toHaveBeenCalledWith({ data: rows });
  });

  it('does not touch the database with zero rows — a delete followed by nothing would erase the day', async () => {
    const written = await recordSourceHealth(DAY, []);

    expect(written).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.sourceHealth.deleteMany).not.toHaveBeenCalled();
  });

  it('is one Prisma transaction in the source, not a loop — read from the file', () => {
    // Estática, pelo parser (§17.27): a pergunta é sobre a estrutura da função.
    // Treze `upsert` sequenciais numa instância de 0.1 vCPU é a forma de
    // problema que o 03/09 ensinou; um laço aqui reprova.
    const file = path.resolve(__dirname, '../../src/services/source-health.service.ts');
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const fn = source.statements.find(
      (s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'recordSourceHealth',
    );
    expect(fn).toBeDefined();

    let loops = 0;
    let transactions = 0;
    let prismaCallsOutsideTransaction = 0;
    const visit = (node: ts.Node, insideTransaction: boolean): void => {
      if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isWhileStatement(node)) loops++;
      if (ts.isCallExpression(node)) {
        const text = node.expression.getText(source);
        if (text === 'prisma.$transaction') {
          transactions++;
          expect(ts.isArrayLiteralExpression(node.arguments[0] as ts.Node)).toBe(true);
          expect((node.arguments[0] as ts.ArrayLiteralExpression).elements).toHaveLength(2);
          node.forEachChild((child) => visit(child, true));
          return;
        }
        if (text.startsWith('prisma.') && !insideTransaction) prismaCallsOutsideTransaction++;
        if (/\.(map|forEach)$/.test(text)) loops++;
      }
      node.forEachChild((child) => visit(child, insideTransaction));
    };
    visit(fn as ts.Node, false);

    expect(loops).toBe(0);
    expect(transactions).toBe(1);
    expect(prismaCallsOutsideTransaction).toBe(0);
  });
});

describe('deleteExpiredSourceHealth — a retenção de 90 dias', () => {
  it('cuts at the retention constant, by day', async () => {
    vi.mocked(prisma.sourceHealth.deleteMany).mockResolvedValue({ count: 13 });

    const deleted = await deleteExpiredSourceHealth(new Date('2026-09-15T12:00:00.000Z'));

    expect(deleted).toBe(13);
    const call = vi.mocked(prisma.sourceHealth.deleteMany).mock.calls[0]?.[0] as {
      where: { day: { lt: Date } };
    };
    const expectedCutoff = new Date('2026-09-15T12:00:00.000Z');
    expectedCutoff.setDate(expectedCutoff.getDate() - SOURCE_HEALTH_RETENTION_DAYS);
    expect(call.where.day.lt).toEqual(expectedCutoff);
  });

  it('is 90 — a quarterly question, and the same as the Article so the two can be crossed', () => {
    expect(SOURCE_HEALTH_RETENTION_DAYS).toBe(90);
  });
});

describe('getSourceHealthReport — a janela, por fonte', () => {
  const row = (source: string, day: string, outcome: SourceOutcome, kept = 10) => ({
    id: `${source}-${day}`,
    source,
    kind: source === NEWSDATA_SOURCE ? ('AGGREGATOR' as const) : ('RSS' as const),
    day: new Date(`${day}T00:00:00.000Z`),
    fetched: 20,
    kept,
    outcome,
    failureReason: outcome === 'FAILED' ? 'ETIMEDOUT' : null,
    latencyMs: 500,
    pipelineLogId: `run-${day}`,
  });

  it('asks for the last N calendar days in UTC, inclusive of today, and groups by source', async () => {
    vi.mocked(prisma.sourceHealth.findMany).mockResolvedValue([
      row('G1', '2026-09-13', 'OK'),
      row('G1', '2026-09-15', 'OK'),
      row('Superinteressante', '2026-09-15', 'FAILED'),
    ] as never);

    const report = await getSourceHealthReport({ days: 30, now: new Date('2026-09-15T18:25:00.000Z') });

    expect(report.window).toEqual({
      days: 30,
      since: '2026-08-17T00:00:00.000Z',
      until: '2026-09-15T00:00:00.000Z',
    });
    const where = vi.mocked(prisma.sourceHealth.findMany).mock.calls[0]?.[0]?.where as {
      day: { gte: Date; lte: Date };
    };
    expect(where.day.gte.toISOString()).toBe('2026-08-17T00:00:00.000Z');
    expect(where.day.lte.toISOString()).toBe('2026-09-15T00:00:00.000Z');

    expect(report.sources.map((s) => s.source)).toEqual(['G1', 'Superinteressante']);
    // Só os dias com linha: o 14/09 do G1 não existe, e é o web que o chama de "não tentada".
    expect(report.sources[0]?.days.map((d) => d.day)).toEqual([
      '2026-09-13T00:00:00.000Z',
      '2026-09-15T00:00:00.000Z',
    ]);
    expect(report.sources[1]?.days[0]).toEqual({
      day: '2026-09-15T00:00:00.000Z',
      outcome: 'FAILED',
      fetched: 20,
      kept: 10,
      latencyMs: 500,
      failureReason: 'ETIMEDOUT',
      pipelineLogId: 'run-2026-09-15',
    });
  });

  it('keeps the source that left the list mid-window — its series just ends', async () => {
    vi.mocked(prisma.sourceHealth.findMany).mockResolvedValue([
      row('Reuters', '2026-08-20', 'OK'),
      row('Reuters', '2026-08-21', 'EMPTY'),
      row('G1', '2026-09-15', 'OK'),
    ] as never);

    const report = await getSourceHealthReport({ days: 30, now: new Date('2026-09-15T18:25:00.000Z') });

    expect(report.sources.map((s) => s.source)).toEqual(['Reuters', 'G1']);
    expect(report.sources[0]?.days).toHaveLength(2);
  });

  it('reads the window in one query, ordered by source then day', async () => {
    vi.mocked(prisma.sourceHealth.findMany).mockResolvedValue([] as never);

    await getSourceHealthReport({ days: 7 });

    expect(prisma.sourceHealth.findMany).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.sourceHealth.findMany).mock.calls[0]?.[0]?.orderBy).toEqual([
      { source: 'asc' },
      { day: 'asc' },
    ]);
  });
});
