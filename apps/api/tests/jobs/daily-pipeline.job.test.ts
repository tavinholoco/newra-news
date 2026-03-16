import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyBaseLogger, FastifyInstance } from 'fastify';

vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3001,
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://test',
    NEWSAPI_KEY: 'test-key',
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-1.5-flash',
    GROQ_API_KEY: 'test-key',
    GROQ_MODEL: 'llama-3.1-8b-instant',
    JOB_SECRET: 'test-secret',
    CORS_ORIGIN: 'http://localhost:3000',
    CRON_SCHEDULE: '0 8 * * *',
    CRON_TIMEZONE: 'America/Sao_Paulo',
  },
}));

vi.mock('../../src/services/pipeline.service', () => ({
  triggerPipeline: vi.fn().mockResolvedValue('pipeline-id-123'),
}));

const mockAddCronJob = vi.fn();

vi.mock('@fastify/schedule', () => ({
  default: vi.fn(),
}));

vi.mock('toad-scheduler', () => ({
  AsyncTask: vi.fn().mockImplementation((name: string, handler: () => Promise<void>, errorHandler: (err: unknown) => void) => ({
    name,
    handler,
    errorHandler,
  })),
  CronJob: vi.fn().mockImplementation((schedule: unknown, task: unknown, options: unknown) => ({
    schedule,
    task,
    options,
  })),
}));

import { triggerPipeline } from '../../src/services/pipeline.service';
import { AsyncTask, CronJob } from 'toad-scheduler';
import fastifySchedule from '@fastify/schedule';
import { runDailyPipelineTask, registerDailyPipelineJob } from '../../src/jobs/daily-pipeline.job';

function makeMockApp(): FastifyInstance {
  const log = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
    level: 'info',
    silent: vi.fn(),
  } as unknown as FastifyBaseLogger;

  return {
    register: vi.fn().mockResolvedValue(undefined),
    scheduler: { addCronJob: mockAddCronJob },
    log,
  } as unknown as FastifyInstance;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runDailyPipelineTask', () => {
  it('should call triggerPipeline once', async () => {
    const app = makeMockApp();
    await runDailyPipelineTask(app.log);

    expect(triggerPipeline).toHaveBeenCalledTimes(1);
  });

  it('should log the returned pipeline id', async () => {
    const app = makeMockApp();
    await runDailyPipelineTask(app.log);

    expect(app.log.info).toHaveBeenCalledWith(
      expect.stringContaining('pipeline-id-123'),
    );
  });

  it('should propagate errors thrown by triggerPipeline', async () => {
    vi.mocked(triggerPipeline).mockRejectedValueOnce(new Error('DB unavailable'));

    const app = makeMockApp();
    await expect(runDailyPipelineTask(app.log)).rejects.toThrow('DB unavailable');
  });
});

describe('registerDailyPipelineJob', () => {
  it('should register @fastify/schedule plugin', async () => {
    const app = makeMockApp();
    await registerDailyPipelineJob(app);

    expect(app.register).toHaveBeenCalledWith(fastifySchedule);
  });

  it('should create AsyncTask with name "daily-pipeline"', async () => {
    const app = makeMockApp();
    await registerDailyPipelineJob(app);

    expect(AsyncTask).toHaveBeenCalledWith(
      'daily-pipeline',
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('should create CronJob with CRON_SCHEDULE and CRON_TIMEZONE from env', async () => {
    const app = makeMockApp();
    await registerDailyPipelineJob(app);

    expect(CronJob).toHaveBeenCalledWith(
      { cronExpression: '0 8 * * *', timezone: 'America/Sao_Paulo' },
      expect.anything(),
      { preventOverrun: true },
    );
  });

  it('should call addCronJob exactly once', async () => {
    const app = makeMockApp();
    await registerDailyPipelineJob(app);

    expect(mockAddCronJob).toHaveBeenCalledTimes(1);
  });

  it('should log registration info with schedule', async () => {
    const app = makeMockApp();
    await registerDailyPipelineJob(app);

    expect(app.log.info).toHaveBeenCalledWith(
      expect.stringContaining('0 8 * * *'),
    );
  });

  it('should throw a clear error when CronJob constructor throws', async () => {
    vi.mocked(CronJob).mockImplementationOnce(() => {
      throw new Error('invalid cron expression');
    });

    const app = makeMockApp();
    await expect(registerDailyPipelineJob(app)).rejects.toThrow(
      'Invalid cron configuration',
    );
  });
});
