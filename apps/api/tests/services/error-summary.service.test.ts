import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@newranews/database';
import {
  ERROR_SUMMARY_ROW_CEILING,
  ERROR_SUMMARY_WINDOWS,
  getErrorSummary,
} from '../../src/services/error-summary.service';
import { ERROR_CATEGORIES } from '../../src/utils/errors';

/**
 * **A leitura do `ErrorEvent` — §9 do plano de observabilidade, 5b.**
 *
 * A tabela guarda uma linha por `(fingerprint, hora)`; a tela quer uma linha
 * por **falha**. O que se testa é a soma: contagem somada, horas contadas,
 * `firstSeenAt` mais velho, e mensagem/`lastRequestId` da hora mais recente —
 * porque é o `lastRequestId` recente que torna um relato de fora pesquisável.
 */

vi.mock('@newranews/database', async () => {
  const actual = await vi.importActual<typeof import('@newranews/database')>(
    '@newranews/database',
  );
  return {
    ...actual,
    prisma: { errorEvent: { findMany: vi.fn().mockResolvedValue([]) } },
  };
});

const NOW = new Date('2026-09-12T15:30:00.000Z');

function row(overrides: Record<string, unknown>) {
  return {
    id: 'row',
    fingerprint: 'API:WARN:AUTH_TOKEN_INVALID:/api/account',
    windowStart: new Date('2026-09-12T14:00:00.000Z'),
    origin: 'API',
    severity: 'WARN',
    code: 'AUTH_TOKEN_INVALID',
    category: 'authorization',
    count: 1,
    route: '/api/account',
    statusCode: 401,
    message: 'Invalid or missing token',
    firstRequestId: 'first',
    lastRequestId: 'last',
    pipelineLogId: null,
    context: null,
    firstSeenAt: new Date('2026-09-12T14:05:00.000Z'),
    lastSeenAt: new Date('2026-09-12T14:55:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(prisma.errorEvent.findMany).mockClear().mockResolvedValue([]);
});

describe('§9 — a janela', () => {
  it('lê da hora cheia que contém o início da janela, mais recente primeiro e com teto', async () => {
    await getErrorSummary('24h', NOW);

    const [query] = vi.mocked(prisma.errorEvent.findMany).mock.calls[0] as [
      { where: { windowStart: { gte: Date } }; orderBy: unknown; take: number },
    ];
    // 15:30 − 24 h = 15:30 de ontem; o balde das 15:00 contém meia hora da
    // janela, e comparar `windowStart >= 15:30` o deixava de fora inteiro
    // (achado da verificação pós-merge do 5b).
    expect(query.where.windowStart.gte.toISOString()).toBe('2026-09-11T15:00:00.000Z');
    expect(query.orderBy).toEqual({ lastSeenAt: 'desc' });
    expect(query.take).toBe(ERROR_SUMMARY_ROW_CEILING);
  });

  it('as duas janelas são as da tela: 24 h e 7 d', () => {
    expect(ERROR_SUMMARY_WINDOWS).toEqual({ '24h': 24, '7d': 168 });
  });

  it('descreve a própria janela na resposta', async () => {
    const summary = await getErrorSummary('7d', NOW);

    // O `since` diz o valor de fato usado — a hora cheia —, não o pedido.
    expect(summary.window).toEqual({
      key: '7d',
      hours: 168,
      since: '2026-09-05T15:00:00.000Z',
      until: NOW.toISOString(),
    });
  });
});

describe('§9 — a soma por fingerprint', () => {
  it('junta as linhas horárias da mesma falha numa só', async () => {
    // Da mais recente para a mais velha, como o banco devolve.
    vi.mocked(prisma.errorEvent.findMany).mockResolvedValueOnce([
      row({
        id: 'h2',
        windowStart: new Date('2026-09-12T15:00:00.000Z'),
        count: 7,
        message: 'a mais recente',
        lastRequestId: 'req-recente',
        firstSeenAt: new Date('2026-09-12T15:01:00.000Z'),
        lastSeenAt: new Date('2026-09-12T15:20:00.000Z'),
      }),
      row({
        id: 'h1',
        count: 33,
        message: 'a mais velha',
        lastRequestId: 'req-velho',
      }),
    ] as never);

    const summary = await getErrorSummary('24h', NOW);

    expect(summary.groups).toHaveLength(1);
    expect(summary.groups[0]).toMatchObject({
      fingerprint: 'API:WARN:AUTH_TOKEN_INVALID:/api/account',
      count: 40,
      hours: 2,
      message: 'a mais recente',
      lastRequestId: 'req-recente',
      firstSeenAt: '2026-09-12T14:05:00.000Z',
      lastSeenAt: '2026-09-12T15:20:00.000Z',
    });
    expect(summary.total).toBe(40);
    expect(summary.distinctFingerprints).toBe(1);
  });

  it('mantém falhas distintas separadas, na ordem em que o banco as devolveu', async () => {
    vi.mocked(prisma.errorEvent.findMany).mockResolvedValueOnce([
      row({ id: 'a', fingerprint: 'PIPELINE:ERROR:PIPELINE_STAGE_FAILED:stage-6', origin: 'PIPELINE', severity: 'ERROR', category: 'upstream', count: 1 }),
      row({ id: 'b', count: 5 }),
    ] as never);

    const summary = await getErrorSummary('24h', NOW);

    expect(summary.groups.map((g) => g.fingerprint)).toEqual([
      'PIPELINE:ERROR:PIPELINE_STAGE_FAILED:stage-6',
      'API:WARN:AUTH_TOKEN_INVALID:/api/account',
    ]);
    expect(summary.distinctFingerprints).toBe(2);
    expect(summary.total).toBe(6);
  });
});

describe('§9 — as distribuições, com fatias fixas', () => {
  it('traz as seis categorias da taxonomia sempre, na ordem dela, com zero onde não houve', async () => {
    vi.mocked(prisma.errorEvent.findMany).mockResolvedValueOnce([
      row({ id: 'a', count: 40 }),
      row({ id: 'b', fingerprint: 'x', category: 'upstream', origin: 'PIPELINE', severity: 'ERROR', count: 2 }),
    ] as never);

    const summary = await getErrorSummary('24h', NOW);

    expect(summary.byCategory.map((c) => c.category)).toEqual([...ERROR_CATEGORIES]);
    expect(summary.byCategory).toContainEqual({ category: 'authorization', count: 40 });
    expect(summary.byCategory).toContainEqual({ category: 'upstream', count: 2 });
    expect(summary.byCategory).toContainEqual({ category: 'database', count: 0 });
    expect(summary.bySeverity).toEqual([
      { severity: 'WARN', count: 40 },
      { severity: 'ERROR', count: 2 },
      { severity: 'FATAL', count: 0 },
    ]);
    expect(summary.byOrigin).toEqual([
      { origin: 'API', count: 40 },
      { origin: 'PIPELINE', count: 2 },
      { origin: 'WEB', count: 0 },
      { origin: 'INVARIANT', count: 0 },
    ]);
  });

  it('a janela vazia tem forma completa — a rosquinha desenha zero, não `undefined`', async () => {
    const summary = await getErrorSummary('24h', NOW);

    expect(summary.total).toBe(0);
    expect(summary.groups).toEqual([]);
    expect(summary.byCategory).toHaveLength(ERROR_CATEGORIES.length);
    expect(summary.truncated).toBe(false);
  });
});

describe('§9 — o teto', () => {
  it('avisa quando a leitura bateu no teto de linhas', async () => {
    const rows = Array.from({ length: ERROR_SUMMARY_ROW_CEILING }, (_, i) =>
      row({ id: `r${i}`, fingerprint: `f${i}` }),
    );
    vi.mocked(prisma.errorEvent.findMany).mockResolvedValueOnce(rows as never);

    const summary = await getErrorSummary('7d', NOW);

    expect(summary.truncated).toBe(true);
    expect(summary.distinctFingerprints).toBe(ERROR_SUMMARY_ROW_CEILING);
  });
});
