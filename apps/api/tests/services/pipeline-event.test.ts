import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@newranews/database';
import {
  extractErrorDetail,
  getDevLogDetail,
  getDevLogs,
  logPipelineEvent,
} from '../../src/services/pipeline-event.service';
import {
  pendingErrorEventCount,
  pendingErrorEvents,
  resetErrorEventBuffer,
} from '../../src/services/error-event.service';
import { GateBlockedError } from '../../src/services/pipeline-gates.service';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      pipelineEvent: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      pipelineLog: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
      },
      // O `FATAL` de um bloqueio de segurança escreve na hora.
      errorEvent: {
        upsert: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

const baseLog = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  status: 'SUCCESS' as const,
  newsCount: 42,
  articleId: null,
  error: null,
  errorStage: null,
  errorDetail: null,
  startedAt: new Date('2026-08-16T08:00:00Z'),
  completedAt: new Date('2026-08-16T08:01:30Z'),
  _count: { events: 5 },
};

const failedLog = {
  ...baseLog,
  id: 'bbbbbbbb-0000-0000-0000-000000000002',
  status: 'FAILED' as const,
  error: 'Gemini API error 500: boom',
  errorStage: 6,
  errorDetail: { message: 'Gemini API error 500: boom', provider: 'gemini', statusCode: 500 },
  _count: { events: 3 },
};

beforeEach(() => {
  vi.resetAllMocks();
  // A listagem passou a ler os `WARN` dos runs da página (Fase 8); sem
  // evento nenhum, todo run fechado é `SUCCESS` limpo ou `FAILED`.
  vi.mocked(prisma.pipelineEvent.findMany).mockResolvedValue([] as never);
});

describe('logPipelineEvent', () => {
  it('should persist an event with stage, level, message and context', async () => {
    vi.mocked(prisma.pipelineEvent.create).mockResolvedValue({} as never);

    await logPipelineEvent(baseLog.id, 7.5, 'WARN', 'Newsletter failed', {
      message: 'Newsletter service down',
    });

    expect(prisma.pipelineEvent.create).toHaveBeenCalledWith({
      data: {
        pipelineLogId: baseLog.id,
        stage: 7.5,
        level: 'WARN',
        message: 'Newsletter failed',
        context: { message: 'Newsletter service down' },
      },
    });
  });

  it('should not throw when persisting the event fails (observability is non-fatal)', async () => {
    vi.mocked(prisma.pipelineEvent.create).mockRejectedValue(
      new Error('db down'),
    );

    await expect(
      logPipelineEvent(baseLog.id, 1, 'INFO', 'News collected'),
    ).resolves.toBeUndefined();
  });
});

describe('extractErrorDetail', () => {
  it('should extract the message from an Error instance', () => {
    expect(extractErrorDetail(new Error('Network failure'))).toEqual({
      message: 'Network failure',
    });
  });

  it('should stringify non-Error values', () => {
    expect(extractErrorDetail('boom')).toEqual({ message: 'boom' });
    expect(extractErrorDetail(42)).toEqual({ message: '42' });
  });

  it('should prefer explicit provider/statusCode props when present', () => {
    const error = new Error('something went wrong') as Error & {
      provider?: string;
      statusCode?: number;
    };
    error.provider = 'groq';
    error.statusCode = 503;

    expect(extractErrorDetail(error)).toEqual({
      message: 'something went wrong',
      provider: 'groq',
      statusCode: 503,
    });
  });

  it('should infer the provider from the message', () => {
    expect(extractErrorDetail(new Error('Gemini API error 500: boom'))).toEqual({
      message: 'Gemini API error 500: boom',
      provider: 'gemini',
      statusCode: 500,
    });
    expect(extractErrorDetail(new Error('NewsData error: 429 too many requests'))).toEqual({
      message: 'NewsData error: 429 too many requests',
      provider: 'newsdata',
      statusCode: 429,
    });
    expect(extractErrorDetail(new Error('Groq API error: 503 service unavailable'))).toEqual({
      message: 'Groq API error: 503 service unavailable',
      provider: 'groq',
      statusCode: 503,
    });
  });

  it('reads the gate, the check and the reason off a GateBlockedError — flat scalars (Fase 9)', () => {
    const detail = extractErrorDetail(
      new GateBlockedError({ gate: 'exit', check: 'unanchored-url', reason: 'security', detail: 'evil.example', provider: 'gemini' }),
    );

    expect(detail).toEqual({
      message:
        'Output guard blocked (gemini): unanchored-url (evil.example) — security block: the cause is in the material, re-triggering repeats the attack',
      gate: 'exit',
      check: 'unanchored-url',
      reason: 'security',
      provider: 'gemini',
    });
  });

  it('should leave statusCode undefined when the message has no HTTP code', () => {
    expect(extractErrorDetail(new Error('Newsletter service down'))).toEqual({
      message: 'Newsletter service down',
      provider: 'newsletter',
    });
  });
});

describe('getDevLogs', () => {
  it('should return runs, recent errors and total, mapping duration and event count', async () => {
    vi.mocked(prisma.pipelineLog.findMany)
      .mockResolvedValueOnce([baseLog] as never)
      .mockResolvedValueOnce([failedLog] as never);
    vi.mocked(prisma.pipelineLog.count).mockResolvedValue(2);

    const result = await getDevLogs();

    expect(result.total).toBe(2);
    expect(result.runs).toEqual([
      {
        id: baseLog.id,
        status: 'SUCCESS',
        newsCount: 42,
        articleId: null,
        error: null,
        errorStage: null,
        errorDetail: null,
        startedAt: '2026-08-16T08:00:00.000Z',
        completedAt: '2026-08-16T08:01:30.000Z',
        durationSeconds: 90,
        eventCount: 5,
        outcome: 'SUCCESS',
        degradedBy: [],
      },
    ]);
    expect(result.recentErrors).toEqual([
      expect.objectContaining({
        id: failedLog.id,
        status: 'FAILED',
        outcome: 'FAILED',
        degradedBy: [],
        errorStage: 6,
        errorDetail: { message: 'Gemini API error 500: boom', provider: 'gemini', statusCode: 500 },
      }),
    ]);
  });

  it('should query recent errors with status FAILED and a limited take', async () => {
    vi.mocked(prisma.pipelineLog.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.pipelineLog.count).mockResolvedValue(0);

    await getDevLogs();

    const [, errorsCall] = vi.mocked(prisma.pipelineLog.findMany).mock.calls;
    expect(errorsCall?.[0]).toEqual(
      expect.objectContaining({
        where: { status: 'FAILED' },
        take: 20,
        orderBy: { startedAt: 'desc' },
      }),
    );
  });

  it('should pass status, since and limit filters to the query', async () => {
    vi.mocked(prisma.pipelineLog.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.pipelineLog.count).mockResolvedValue(0);

    await getDevLogs({ status: 'FAILED', sinceDays: 3, limit: 10 });

    const [runsCall] = vi.mocked(prisma.pipelineLog.findMany).mock.calls;
    const where = runsCall?.[0]?.where as {
      status?: string;
      startedAt?: { gte: Date };
    };
    expect(where.status).toBe('FAILED');
    expect(where.startedAt?.gte).toBeInstanceOf(Date);
    const cutoff = where.startedAt?.gte as Date;
    const expected = new Date();
    expected.setDate(expected.getDate() - 3);
    expect(cutoff.getTime()).toBeGreaterThan(expected.getTime() - 60_000);
    expect(runsCall?.[0]).toEqual(expect.objectContaining({ take: 10 }));
  });
});

/**
 * **Fase 8 — a listagem diz o desfecho, e o desfecho pede os eventos.**
 *
 * `getDevLogs` trazia `_count.events` e nada mais; o desfecho é função sobre
 * o run **e** seus `WARN`, então a listagem lê uma vez os `WARN` de todos os
 * runs da página — uma consulta, não uma por run. A função continua pura; quem
 * a alimenta é o service, e as duas portas (`/api/dev/logs` e
 * `/api/admin/pipeline/runs`) compartilham o schema, então o campo entra nas
 * duas.
 */
describe('getDevLogs — o desfecho (Fase 8)', () => {
  const degradedId = 'dddddddd-0000-0000-0000-000000000004';
  const degradedLog = { ...baseLog, id: degradedId };

  it('reads the WARN events of the page in one query, over every run listed', async () => {
    vi.mocked(prisma.pipelineLog.findMany)
      .mockResolvedValueOnce([baseLog, degradedLog] as never)
      .mockResolvedValueOnce([failedLog] as never);
    vi.mocked(prisma.pipelineLog.count).mockResolvedValue(3);

    await getDevLogs();

    expect(prisma.pipelineEvent.findMany).toHaveBeenCalledTimes(1);
    const [args] = vi.mocked(prisma.pipelineEvent.findMany).mock.calls[0] as [
      { where: { pipelineLogId: { in: string[] }; level: string } },
    ];
    expect(args.where.level).toBe('WARN');
    expect([...args.where.pipelineLogId.in].sort()).toEqual(
      [baseLog.id, degradedId, failedLog.id].sort(),
    );
  });

  it('marks SUCCESS_DEGRADED the run whose newsletter failed, and says which stage', async () => {
    vi.mocked(prisma.pipelineLog.findMany)
      .mockResolvedValueOnce([baseLog, degradedLog] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.pipelineLog.count).mockResolvedValue(2);
    vi.mocked(prisma.pipelineEvent.findMany).mockResolvedValue([
      { pipelineLogId: degradedId, stage: 7.5, level: 'WARN', context: { message: 'Resend down' } },
      { pipelineLogId: degradedId, stage: 6, level: 'WARN', context: { fallbackProvider: 'groq' } },
    ] as never);

    const result = await getDevLogs();

    expect(result.runs.map((run) => [run.id, run.outcome, run.degradedBy])).toEqual([
      [baseLog.id, 'SUCCESS', []],
      [degradedId, 'SUCCESS_DEGRADED', [6, 7.5]],
    ]);
  });

  it('does not touch the events table when the page is empty', async () => {
    vi.mocked(prisma.pipelineLog.findMany)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.pipelineLog.count).mockResolvedValue(0);

    await getDevLogs();

    expect(prisma.pipelineEvent.findMany).not.toHaveBeenCalled();
  });

  it('leaves outcome null for a run still RUNNING', async () => {
    vi.mocked(prisma.pipelineLog.findMany)
      .mockResolvedValueOnce([{ ...baseLog, status: 'RUNNING', completedAt: null }] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.pipelineLog.count).mockResolvedValue(1);

    const result = await getDevLogs();

    expect(result.runs[0]?.outcome).toBeNull();
  });
});

describe('getDevLogDetail', () => {
  it('should return the log with its events in chronological order', async () => {
    vi.mocked(prisma.pipelineLog.findUnique).mockResolvedValue({
      ...failedLog,
      _count: undefined,
      events: [
        {
          id: 'cccccccc-0000-0000-0000-000000000003',
          stage: 6,
          level: 'ERROR' as const,
          message: 'Gemini API error 500: boom',
          context: { provider: 'gemini', statusCode: 500 },
          createdAt: new Date('2026-08-16T08:01:00Z'),
        },
      ],
    } as never);

    const result = await getDevLogDetail(failedLog.id);

    expect(result).not.toBeNull();
    expect(result?.log.eventCount).toBe(1);
    expect(result?.log.status).toBe('FAILED');
    // O detalhe já carrega todos os eventos: o desfecho sai deles, sem
    // segunda consulta.
    expect(result?.log.outcome).toBe('FAILED');
    expect(prisma.pipelineEvent.findMany).not.toHaveBeenCalled();
    expect(result?.events).toEqual([
      {
        id: 'cccccccc-0000-0000-0000-000000000003',
        stage: 6,
        level: 'ERROR',
        message: 'Gemini API error 500: boom',
        context: { provider: 'gemini', statusCode: 500 },
        createdAt: '2026-08-16T08:01:00.000Z',
      },
    ]);
    expect(prisma.pipelineLog.findUnique).toHaveBeenCalledWith({
      where: { id: failedLog.id },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
  });

  it('should return null when the pipeline does not exist', async () => {
    vi.mocked(prisma.pipelineLog.findUnique).mockResolvedValue(null);

    await expect(
      getDevLogDetail('ffffffff-ffff-ffff-ffff-ffffffffffff'),
    ).resolves.toBeNull();
  });

  it('derives SUCCESS_DEGRADED from the WARN it already carries (Fase 8)', async () => {
    vi.mocked(prisma.pipelineLog.findUnique).mockResolvedValue({
      ...baseLog,
      _count: undefined,
      events: [
        {
          id: 'eeeeeeee-0000-0000-0000-000000000005',
          stage: 8.5,
          level: 'WARN' as const,
          message: 'Renormalization failed (non-critical)',
          context: { message: 'db down' },
          createdAt: new Date('2026-08-16T08:01:20Z'),
        },
      ],
    } as never);

    const result = await getDevLogDetail(baseLog.id);

    expect(result?.log.outcome).toBe('SUCCESS_DEGRADED');
    expect(result?.log.degradedBy).toEqual([8.5]);
  });
});

/**
 * **A fiação da §8 do lado do pipeline.**
 *
 * A chamada a `recordError` fica dentro do `logPipelineEvent`, e não nos oito
 * `catch` das etapas, pelo mesmo motivo que a pôs dentro do `logAppError`: este
 * é o **único** ponto por onde toda etapa anuncia que algo deu errado. Enumerar
 * `catch` à mão é a forma de guarda que este projeto já viu falhar por omissão
 * — a varredura da Fase 7a cobria uma pasta e a única rota fora dela era
 * justamente a que engolia a falha.
 *
 * O que isto compra, e o `PipelineLog` não comprava: *"a etapa 8.5 falha há
 * três dias?"*. O run guarda o desfecho de um dia; o `ErrorEvent` coalesce a
 * mesma falha ao longo da retenção, com contagem.
 */
describe('§8 — o evento de etapa também vira registro durável', () => {
  beforeEach(() => {
    resetErrorEventBuffer();
  });

  it('grava o `ERROR` de uma etapa, com a etapa como escopo', async () => {
    await logPipelineEvent('run-1', 6, 'ERROR', 'Gemini API error 500: boom', {
      provider: 'gemini',
      statusCode: 500,
    });
    const [event] = pendingErrorEvents();

    expect(event?.origin).toBe('PIPELINE');
    expect(event?.severity).toBe('ERROR');
    expect(event?.code).toBe('PIPELINE_STAGE_FAILED');
    // A etapa é o que separa "a coleta falhou" de "a newsletter falhou", e é
    // conjunto finito — hoje onze.
    expect(event?.route).toBe('stage-6');
    expect(event?.statusCode).toBe(500);
    expect(event?.category).toBe('upstream');
  });

  it('grava o `WARN` de etapa não-crítica com outro código', async () => {
    await logPipelineEvent('run-1', 8.5, 'WARN', 'Renormalization failed (non-critical)');
    const [event] = pendingErrorEvents();

    expect(event?.severity).toBe('WARN');
    expect(event?.code).toBe('PIPELINE_STAGE_DEGRADED');
    expect(event?.route).toBe('stage-8.5');
    // Sem provider inferido, a culpa é nossa até prova em contrário.
    expect(event?.category).toBe('internal');
  });

  it('chama o Prisma de `database`, e não de `upstream`', async () => {
    await logPipelineEvent('run-1', 4, 'ERROR', 'boom', { provider: 'prisma' });

    expect(pendingErrorEvents()[0]?.category).toBe('database');
  });

  it('grava o id do run mesmo fora do contexto assíncrono — o enterro do run morto', async () => {
    // `triggerPipeline` enterra o `RUNNING` velho **antes** de abrir o contexto
    // do run novo; o id só chega ao registro porque `logPipelineEvent` o passa
    // explicitamente. Pelo `AsyncLocalStorage` sozinho, esta linha era `null`.
    await logPipelineEvent('run-morto', 0, 'ERROR', 'Run marked FAILED after 20 min in RUNNING', {
      reason: 'stale-running',
    });
    const [event] = pendingErrorEvents();

    expect(event?.pipelineLogId).toBe('run-morto');
    expect(event?.route).toBe('stage-0');
  });

  it('não grava o `WARN` da etapa 1 quando os avisos são só feeds vazios (pós-merge da Fase 8)', async () => {
    // A linha `feed-empty` tem três consumidores — o `pipelineErrors` da
    // etapa 1, o desfecho da Fase 8 e este registro —, e este era o único que
    // a traçava diferente: gravava todo `WARN` como `PIPELINE_STAGE_DEGRADED`,
    // então o domingo de um feed de saúde virava linha na tabela de falhas
    // da `/admin/security` enquanto o desfecho do mesmo run dizia `SUCCESS`.
    // O `PipelineEvent` continua sendo escrito (é o rastro da sequência de
    // dias vazios, que a Fase 11 lê); o que não entra é o `ErrorEvent`.
    await logPipelineEvent('run-1', 1, 'WARN', 'Collection degraded', {
      warnings: [
        { kind: 'feed-empty', source: 'Veja Saúde' },
        { kind: 'feed-empty', source: 'Drauzio Varella' },
      ],
    });

    expect(pendingErrorEvents()).toEqual([]);
    expect(prisma.pipelineEvent.create).toHaveBeenCalledTimes(1);
  });

  it('grava o `WARN` da etapa 1 quando um dos avisos é mais que feed vazio', async () => {
    await logPipelineEvent('run-1', 1, 'WARN', 'Collection degraded', {
      warnings: [
        { kind: 'feed-empty', source: 'Veja Saúde' },
        { kind: 'provider-failed', source: 'newsdata', detail: 'ETIMEDOUT' },
      ],
    });

    expect(pendingErrorEvents()).toHaveLength(1);
    expect(pendingErrorEvents()[0]?.code).toBe('PIPELINE_STAGE_DEGRADED');
  });

  it('classifica a coleta degradada como `upstream` — o provider mora dentro de cada warning', async () => {
    // O `context` da etapa 1 é `{ warnings: FetchWarning[] }`, sem `provider` no
    // topo. A primeira inferência lia só o topo e chamava um feed em `ETIMEDOUT`
    // de `internal` — a classe de falha mais frequente do pipeline, com a
    // categoria errada.
    await logPipelineEvent('run-1', 1, 'WARN', 'Collection degraded', {
      warnings: [{ kind: 'feed-failed', source: 'Superinteressante', detail: 'ETIMEDOUT' }],
    });

    expect(pendingErrorEvents()[0]?.category).toBe('upstream');
  });

  it('**não** grava o `INFO`, que é o caminho feliz', async () => {
    await logPipelineEvent('run-1', 1, 'INFO', 'News collected', { count: 377 });

    // São ~15 por run; gravá-los faria a tabela de falhas contar sucesso.
    expect(pendingErrorEvents()).toEqual([]);
  });

  it('coalesce a mesma etapa falhando de novo dentro da hora', async () => {
    await logPipelineEvent('run-1', 8.5, 'WARN', 'Renormalization failed (non-critical)');
    await logPipelineEvent('run-1', 8.5, 'WARN', 'Renormalization failed (non-critical)');

    expect(pendingErrorEvents()).toHaveLength(1);
    expect(pendingErrorEventCount()).toBe(2);
  });

  it('registra mesmo quando a persistência do evento falha', async () => {
    // Os dois registros são independentes de propósito: o `PipelineEvent` vive
    // no mesmo banco que pode estar fora, e o buffer não.
    vi.mocked(prisma.pipelineEvent.create).mockRejectedValueOnce(new Error('P1001'));

    await logPipelineEvent('run-1', 6, 'ERROR', 'boom');

    expect(pendingErrorEvents()).toHaveLength(1);
  });
});

/**
 * **O bloqueio de portão tem código próprio, e o motivo no `route`.** (Fase 9,
 * §13.3) O `recordPipelineEvent` o reconhece pela forma do `context` — os
 * três escalares que `extractErrorDetail` põe num `GateBlockedError` —, e a
 * severidade é o destino do dia.
 */
describe('Fase 9 — o bloqueio de portão vira `PIPELINE_GATE_BLOCKED`', () => {
  beforeEach(() => {
    resetErrorEventBuffer();
    vi.mocked(prisma.errorEvent.upsert).mockClear();
  });

  const gateContext = (gate: 'entry' | 'exit', check: string, reason: 'security' | 'quality') => ({
    message: 'blocked',
    gate,
    check,
    reason,
  });

  it('a security block is FATAL, category authorization, with the host-free motive in the route — and writes at once', async () => {
    await logPipelineEvent('run-1', 6.5, 'ERROR', 'Output guard blocked', gateContext('exit', 'unanchored-url', 'security'));

    // `FATAL` esvazia o buffer na hora; o registro está no `upsert`.
    await vi.waitFor(() => expect(prisma.errorEvent.upsert).toHaveBeenCalledTimes(1));
    const [arg] = vi.mocked(prisma.errorEvent.upsert).mock.calls[0] as [{ create: Record<string, unknown> }];
    expect(arg.create).toMatchObject({
      origin: 'PIPELINE',
      severity: 'FATAL',
      code: 'PIPELINE_GATE_BLOCKED',
      category: 'authorization',
      route: 'stage-6.5:unanchored-url',
      pipelineLogId: 'run-1',
    });
  });

  it('a quality block that failed the day is ERROR, category contract', async () => {
    await logPipelineEvent('run-1', 6.5, 'ERROR', 'Output guard blocked', gateContext('exit', 'language', 'quality'));
    const [event] = pendingErrorEvents();

    expect(event).toMatchObject({
      severity: 'ERROR',
      code: 'PIPELINE_GATE_BLOCKED',
      category: 'contract',
      route: 'stage-6.5:language',
    });
  });

  it('a quality block the fallback recovered is WARN — the event is WARN, the run is SUCCESS_DEGRADED', async () => {
    await logPipelineEvent('run-1', 6.5, 'WARN', 'fallback served', gateContext('exit', 'size', 'quality'));
    const [event] = pendingErrorEvents();

    expect(event).toMatchObject({ severity: 'WARN', code: 'PIPELINE_GATE_BLOCKED', route: 'stage-6.5:size' });
  });

  it('an entry gate block is ERROR, category upstream — the harvest is what did not pass', async () => {
    await logPipelineEvent('run-1', 5.5, 'ERROR', 'Entry gate blocked', gateContext('entry', 'volume', 'quality'));
    const [event] = pendingErrorEvents();

    expect(event).toMatchObject({
      severity: 'ERROR',
      code: 'PIPELINE_GATE_BLOCKED',
      category: 'upstream',
      route: 'stage-5.5:volume',
    });
  });

  it('takes the route stage from the gate, not from the event — the same block is one line however it was written', async () => {
    // O `WARN` do `catch` final escreve o erro primário; se ele sair na 6 por
    // engano, o fingerprint continua sendo o do portão.
    await logPipelineEvent('run-1', 6, 'WARN', 'Primary provider failed before fallback', gateContext('exit', 'language', 'quality'));
    const [event] = pendingErrorEvents();

    expect(event?.route).toBe('stage-6.5:language');
  });

  it('refuses a check nobody declared — the route keeps its ceiling', async () => {
    await logPipelineEvent('run-1', 6.5, 'ERROR', 'blocked', gateContext('exit', 'stage-6.5:whatever-the-model-said', 'security'));
    const [event] = pendingErrorEvents();

    // Sem o check válido, o contexto não é de portão: cai no código da etapa
    // que falhou, com a etapa como escopo — e nunca `FATAL`.
    expect(event).toMatchObject({ code: 'PIPELINE_STAGE_FAILED', severity: 'ERROR', route: 'stage-6.5' });
  });

  it('a gate warning (no block) is an ordinary degraded stage, and it counts as degrading', async () => {
    await logPipelineEvent('run-1', 5.5, 'WARN', 'Entry gate passed with warnings', {
      volume: 300,
      baseline: 'ok',
      findings: ['category-drift'],
      warnings: ['category-drift: distribution moved 0.41 (total variation) from the 7-day mean'],
    });
    const [event] = pendingErrorEvents();

    // `findings`, não `warnings` como lista de objetos: o `isDegradingWarn` lê
    // `context.warnings` como avisos de colheita, e uma lista de strings ali
    // entraria por acidente — o nome do campo é o que evita a colisão.
    expect(event).toMatchObject({ code: 'PIPELINE_STAGE_DEGRADED', severity: 'WARN', route: 'stage-5.5' });
  });
});
