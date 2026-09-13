import type { Saturation } from '@newranews/types';
import { getEventLoopLag } from '../plugins/observability';
import {
  RENDER_FREE_PLAN_HOURS,
  getMonthUptimeSeconds,
  startOfUtcMonth,
} from './uptime.service';

/**
 * **Saturação — o quarto sinal de ouro, que faltava nos três incidentes
 * (§3.1 do plano de observabilidade).**
 *
 * Latência, tráfego e erro já saíam pelo `/api/metrics/http` desde a Fase 9.
 * Saturação não saía de lugar nenhum, e é o sinal que teria mostrado os três
 * incidentes chegando: as 744 h de 29/08 (horas do plano), o gatilho de
 * ~200 mil linhas da `/metrics/product` (memória) e os 45 s de 03/09 (event
 * loop). São as três medidas concretas do plano, e as três saem daqui.
 *
 * Cada medida traz o **teto** e a **razão** já calculados, para que a tela
 * desenhe o arco sem conhecer o plano do Render — e para que o número "0,82"
 * signifique a mesma coisa em qualquer consumidor.
 */

/** A memória da instância no plano free do Render. */
export const RENDER_FREE_MEMORY_BYTES = 512 * 1024 * 1024;

const ratio = (part: number, whole: number): number =>
  whole === 0 ? 0 : Number((part / whole).toFixed(4));

export async function getSaturation(now: Date = new Date()): Promise<Saturation> {
  const memory = process.memoryUsage();
  const secondsUsed = await getMonthUptimeSeconds(now);
  const hoursUsed = Number((secondsUsed / 3600).toFixed(2));
  const monthStart = startOfUtcMonth(now);

  return {
    memory: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      limitBytes: RENDER_FREE_MEMORY_BYTES,
      ratio: ratio(memory.rss, RENDER_FREE_MEMORY_BYTES),
    },
    eventLoop: getEventLoopLag(),
    plan: {
      month: monthStart.toISOString().slice(0, 7),
      monthStart: monthStart.toISOString(),
      secondsUsed,
      hoursUsed,
      limitHours: RENDER_FREE_PLAN_HOURS,
      ratio: ratio(hoursUsed, RENDER_FREE_PLAN_HOURS),
    },
  };
}
