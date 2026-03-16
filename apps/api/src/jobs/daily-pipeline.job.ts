import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import fastifySchedule from '@fastify/schedule';
import { AsyncTask, CronJob } from 'toad-scheduler';
import { env } from '../config/env';
import { triggerPipeline } from '../services/pipeline.service';

export async function runDailyPipelineTask(log: FastifyBaseLogger): Promise<void> {
  log.info('[cron] starting daily pipeline');
  const pipelineId = await triggerPipeline();
  log.info(`[cron] pipeline triggered, id: ${pipelineId}`);
}

export async function registerDailyPipelineJob(app: FastifyInstance): Promise<void> {
  await app.register(fastifySchedule);

  const task = new AsyncTask(
    'daily-pipeline',
    async () => {
      await runDailyPipelineTask(app.log);
    },
    (err: Error) => {
      app.log.error(`[cron] task failed: ${err.message}`);
    },
  );

  const job = new CronJob(
    { cronExpression: env.CRON_SCHEDULE, timezone: env.CRON_TIMEZONE },
    task,
    { preventOverrun: true },
  );

  app.scheduler.addCronJob(job);
  app.log.info(`[cron] registered, schedule: ${env.CRON_SCHEDULE} tz: ${env.CRON_TIMEZONE}`);
}
