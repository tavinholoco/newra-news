import { buildApp } from './app';
import { env } from './config/env';
import { registerDailyPipelineJob } from './jobs/daily-pipeline.job';
import { uptimeHeartbeatPlugin } from './plugins/uptime-heartbeat';

async function start() {
  const app = await buildApp();

  await registerDailyPipelineJob(app);
  // O trabalho de fundo **do processo** entra aqui, e não no `buildApp`: o
  // `buildApp` roda em toda suíte, e um `onClose` que vai ao banco custaria o
  // prazo inteiro em cada uma. Ver `services/uptime.service.ts`.
  await app.register(uptimeHeartbeatPlugin);

  const shutdown = async (signal: string) => {
    app.log.info(`[server] received ${signal}, shutting down`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server running on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
