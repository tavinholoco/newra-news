import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import {
  UPTIME_HEARTBEAT_MS,
  flushUptimeBeforeClose,
  startUptimeClock,
  tickUptime,
} from '../services/uptime.service';

/**
 * O heartbeat do `DailyUptime` (§9 do plano de observabilidade, PR 5b).
 *
 * Dois gatilhos, como o flush do `ErrorEvent`: o **intervalo**, que é o caminho
 * normal, e o **`onClose`**, que é o caminho do `SIGTERM` — e no free do Render
 * o `SIGTERM` é rotina, não incidente: é assim que a instância dorme. O crédito
 * final é o que faz a conta do mês incluir os minutos entre o último tique e a
 * hora em que o processo apagou.
 *
 * **Registrado pelo `server.ts`, não pelo `buildApp`** — ver o cabeçalho de
 * `services/uptime.service.ts`. A guarda sobre a fiação vive em
 * `tests/services/uptime.service.test.ts`.
 *
 * `unref()` pelo mesmo motivo do `plugins/error-events.ts`: um timer de cinco
 * minutos não pode ser o que segura o processo vivo.
 */
export const uptimeHeartbeatPlugin = fp(async function uptimeHeartbeatPlugin(
  app: FastifyInstance,
) {
  startUptimeClock();

  const timer = setInterval(() => {
    void tickUptime();
  }, UPTIME_HEARTBEAT_MS);
  timer.unref();

  app.addHook('onClose', async () => {
    clearInterval(timer);
    await flushUptimeBeforeClose();
  });
});
