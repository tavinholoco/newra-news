import type { Saturation } from '@newranews/types';
import { getEventLoopLag } from '../plugins/observability';
import { baseLogger } from '../utils/logger';
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
 *
 * ## `plan` é a única medida que vai ao banco, e por isso é a única que pode ser `null`
 *
 * Achado da verificação pós-merge do 5b: o `/api/metrics/http` é em memória
 * **de propósito** — ele responde "a API está devolvendo erro agora?"
 * justamente quando o banco é o suspeito —, e a primeira versão desta função
 * deixava o `aggregate` do `DailyUptime` sem `catch`. Banco fora ⇒ a rota
 * inteira em 500, com latência, tráfego e erro perdidos junto. Vale também na
 * janela da promoção: o deploy do Render e o `migrate.yml` correm em
 * paralelo, e a tabela pode não existir nos primeiros minutos da versão nova.
 * Memória e event loop nunca dependem de nada; as horas do plano viram
 * `null` com um `warn`, e a tela desenha "indisponível" em vez de nada.
 */

/** A memória da instância no plano free do Render. */
export const RENDER_FREE_MEMORY_BYTES = 512 * 1024 * 1024;

const ratio = (part: number, whole: number): number =>
  whole === 0 ? 0 : Number((part / whole).toFixed(4));

async function planSaturation(now: Date): Promise<Saturation['plan']> {
  const monthStart = startOfUtcMonth(now);
  try {
    const secondsUsed = await getMonthUptimeSeconds(now);
    const hoursUsed = Number((secondsUsed / 3600).toFixed(2));
    return {
      month: monthStart.toISOString().slice(0, 7),
      monthStart: monthStart.toISOString(),
      secondsUsed,
      hoursUsed,
      limitHours: RENDER_FREE_PLAN_HOURS,
      ratio: ratio(hoursUsed, RENDER_FREE_PLAN_HOURS),
    };
  } catch (error) {
    // Só `warn`: quando este `aggregate` falha, o banco está fora, e isso já
    // vira `ErrorEvent` por toda rota que responde 500 — mesma decisão do
    // heartbeat.
    baseLogger.warn({ err: error }, '[saturation] plan hours unavailable');
    return null;
  }
}

export async function getSaturation(now: Date = new Date()): Promise<Saturation> {
  const memory = process.memoryUsage();

  return {
    memory: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      limitBytes: RENDER_FREE_MEMORY_BYTES,
      ratio: ratio(memory.rss, RENDER_FREE_MEMORY_BYTES),
    },
    eventLoop: getEventLoopLag(),
    plan: await planSaturation(now),
  };
}
