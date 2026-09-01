import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import fastifySchedule from '@fastify/schedule';
import { AsyncTask, CronJob } from 'toad-scheduler';
import { env } from '../config/env';
import { triggerPipeline } from '../services/pipeline.service';

/**
 * O cron **interno** da API, e ele não é o gatilho principal.
 *
 * Quem dispara de verdade é o cron da Vercel (`app/api/cron/daily-news`), que
 * acorda a API antes de chamar. Este aqui é um agendador **em processo**: ele só
 * dispara se o processo estiver de pé às 08:00 BRT, e no plano free do Render
 * ele frequentemente não está. Não é rede de segurança — é o caminho feliz de
 * quando a API já estava acordada.
 *
 * Os dois apontam para o mesmo instante (`0 8 * * *` em `America/Sao_Paulo` é
 * `0 11 * * *` em UTC) e a idempotência por dia resolve o encontro: o segundo a
 * chegar recebe `already-running` ou `already-succeeded-today`.
 */
export async function runDailyPipelineTask(log: FastifyBaseLogger): Promise<void> {
  log.info('[cron] starting daily pipeline');

  // **O log diz o desfecho, e antes dizia "triggered" sempre.** Quando o
  // `triggerPipeline` passou a devolver `{ outcome, pipelineId, startedAt }`,
  // esta linha continuou interpolando o retorno inteiro — imprimia
  // `id: [object Object]` e afirmava disparo mesmo quando o run do dia já
  // existia. É a mesma mentira que o painel de admin contava, sobrevivendo no
  // log; o `tsc` não pega porque interpolar objeto é legal.
  const { outcome, pipelineId, startedAt } = await triggerPipeline();

  if (outcome === 'started') {
    log.info(`[cron] pipeline started, id: ${pipelineId}`);
  } else {
    log.info(
      `[cron] nothing triggered (${outcome}) — run of the day is ${pipelineId}, started at ${startedAt}`,
    );
  }
}

export async function registerDailyPipelineJob(app: FastifyInstance): Promise<void> {
  await app.register(fastifySchedule);

  const task = new AsyncTask(
    'daily-pipeline',
    async () => {
      await runDailyPipelineTask(app.log);
    },
    (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      app.log.error(`[cron] task failed: ${message}`);
    },
  );

  let job: CronJob;
  try {
    job = new CronJob(
      { cronExpression: env.CRON_SCHEDULE, timezone: env.CRON_TIMEZONE },
      task,
      { preventOverrun: true },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid cron configuration (CRON_SCHEDULE="${env.CRON_SCHEDULE}", CRON_TIMEZONE="${env.CRON_TIMEZONE}"): ${message}`);
  }

  app.scheduler.addCronJob(job);
  app.log.info(`[cron] registered, schedule: ${env.CRON_SCHEDULE} tz: ${env.CRON_TIMEZONE}`);
}
