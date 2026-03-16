import { buildApp } from './app';
import { env } from './config/env';
import { registerDailyPipelineJob } from './jobs/daily-pipeline.job';

async function start() {
  const app = await buildApp();

  await registerDailyPipelineJob(app);

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server running on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
