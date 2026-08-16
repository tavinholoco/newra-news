import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@newranews/database';
import {
  extractErrorDetail,
  getDevLogDetail,
  getDevLogs,
  logPipelineEvent,
} from '../../src/services/pipeline-event.service';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      pipelineEvent: {
        create: vi.fn(),
      },
      pipelineLog: {
        findMany: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
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
      },
    ]);
    expect(result.recentErrors).toEqual([
      expect.objectContaining({
        id: failedLog.id,
        status: 'FAILED',
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
});
