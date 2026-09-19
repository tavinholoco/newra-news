import { prisma } from '@newranews/database';
import { baseLogger } from '../utils/logger';
import { ERROR_EVENT_CLOSE_TIMEOUT_MS } from './error-event.service';

/**
 * **As horas do plano, como acumulador — §3.1 e §4.3 do plano de
 * observabilidade, PR 5b.** O `model DailyUptime` do 5a, e quem o escreve.
 *
 * O que fecha: o teto que suspendeu a API em 29/08/2026 (750 h/mês no free do
 * Render, com o keep-alive gastando 744) era uma métrica de saturação que
 * ninguém observava. E `process.uptime()` não sabe dá-la: desde 01/09 a API
 * dorme e acorda várias vezes por dia, e cada acordada zera o contador — o
 * `uptimeSeconds` do `/api/metrics/http` fala só desta instância.
 *
 * ## Uma linha por dia UTC, incrementada
 *
 * A cada {@link UPTIME_HEARTBEAT_MS} o tique credita **os segundos inteiros
 * desde o último crédito** na linha do dia (`upsert` com `increment`), e
 * guarda o resto para o tique seguinte — a soma do mês fica exata ao segundo,
 * sem arredondar a cada cinco minutos. Um tique que atravessa a meia-noite UTC
 * divide o crédito entre os dois dias. O `onClose` credita o que sobrou, com o
 * mesmo prazo do flush do `ErrorEvent`; a perda máxima por `SIGKILL` é um
 * intervalo.
 *
 * ## Outbound-only, e é o que faz o desenho não se morder
 *
 * O heartbeat **escreve no banco** e não faz requisição HTTP nenhuma: o que
 * acorda e mantém o Render de pé é tráfego HTTP **de entrada**, e um timer que
 * batesse no próprio `/api/health` para "medir" seria o keep-alive de volta —
 * o mecanismo que gastou as 744 h. Quando a instância dorme, o processo morre
 * com `SIGTERM`, o `onClose` credita o resto, e o contador para de andar. É
 * exatamente o que se quer contar.
 *
 * ## Vive no `server.ts`, não no `buildApp`
 *
 * O `buildApp` roda em toda suíte de rota. Um `onClose` daqui em cada uma seria
 * uma ida ao banco por suíte — contra um banco que não existe no CI —, cada
 * uma esperando o prazo inteiro. O cron interno já vive no `server.ts` pelo
 * mesmo motivo; o heartbeat é a mesma espécie de coisa (trabalho de fundo do
 * processo, não da aplicação HTTP), e a guarda sobre a fiação está em
 * `tests/services/uptime.service.test.ts`.
 *
 * ## Nunca lança
 *
 * Um tique que falha escreve `warn` e **não avança o crédito** — o tique
 * seguinte tenta o intervalo inteiro de novo, e um banco que piscou não custa
 * cinco minutos de conta. Não vira `ErrorEvent`, de propósito: quando este
 * `upsert` falha, o banco está fora, e isso já produz linha por toda rota que
 * responde 500 — registrar o sintoma ao lado da causa seria contar duas vezes.
 */

/** De quanto em quanto tempo o crédito vai ao banco. */
export const UPTIME_HEARTBEAT_MS = 5 * 60 * 1000;

/** O teto do plano free do Render, em horas de instância por mês de calendário. */
export const RENDER_FREE_PLAN_HOURS = 750;

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(at: Date): Date {
  const day = new Date(at);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

export function startOfUtcMonth(at: Date): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

export interface UptimeCredit {
  /** O dia UTC, à meia-noite — a chave de `DailyUptime.date`. */
  date: Date;
  seconds: number;
}

/**
 * Reparte os segundos **inteiros** entre `from` e `to` pelos dias UTC que o
 * intervalo atravessa. Pura, e é ela que o teste exercita.
 *
 * `creditedUntil` é `from` mais os segundos inteiros: a fração que sobra fica
 * para o próximo crédito, e é assim que a soma não deriva. Na travessia da
 * meia-noite, a fração da borda cai no dia de antes (`ceil`) — um segundo por
 * dia, no pior caso, do lado errado; o total continua exato.
 */
export function splitUptimeCredit(
  from: Date,
  to: Date,
): { portions: UptimeCredit[]; creditedUntil: Date } {
  const totalSeconds = Math.floor((to.getTime() - from.getTime()) / 1000);
  if (totalSeconds <= 0) return { portions: [], creditedUntil: from };

  const portions: UptimeCredit[] = [];
  let cursor = from;
  let remaining = totalSeconds;

  while (remaining > 0) {
    const day = startOfUtcDay(cursor);
    const nextMidnight = day.getTime() + DAY_MS;
    const secondsLeftInDay = Math.ceil((nextMidnight - cursor.getTime()) / 1000);
    const seconds = Math.min(remaining, secondsLeftInDay);

    portions.push({ date: day, seconds });
    remaining -= seconds;
    cursor = new Date(cursor.getTime() + seconds * 1000);
  }

  return { portions, creditedUntil: new Date(from.getTime() + totalSeconds * 1000) };
}

let creditedUntil: Date | undefined;
let inFlight: Promise<void> | undefined;

/** Começa a contar a partir de `now`. Chamado uma vez, na subida do processo. */
export function startUptimeClock(now: Date = new Date()): void {
  creditedUntil = now;
}

/** Zera o relógio. Existe para o teste. */
export function resetUptimeClock(): void {
  creditedUntil = undefined;
  inFlight = undefined;
}

/** Até onde o banco já foi creditado. Só para teste. */
export function uptimeCreditedUntil(): Date | undefined {
  return creditedUntil;
}

/**
 * Um tique: credita o que passou desde o último crédito. **Nunca lança.**
 *
 * Serializado: se o tique anterior ainda está no banco (banco lento), este não
 * abre uma segunda escrita sobre o mesmo intervalo — espera e credita o que
 * sobrar depois.
 */
export async function tickUptime(now: Date = new Date()): Promise<void> {
  if (inFlight) await inFlight;
  if (creditedUntil === undefined) return;

  const { portions, creditedUntil: next } = splitUptimeCredit(creditedUntil, now);
  if (portions.length === 0) return;

  inFlight = (async () => {
    try {
      for (const portion of portions) {
        await prisma.dailyUptime.upsert({
          where: { date: portion.date },
          create: { date: portion.date, seconds: portion.seconds },
          update: { seconds: { increment: portion.seconds } },
        });
      }
      creditedUntil = next;
    } catch (error) {
      // Sem avançar `creditedUntil`: o próximo tique tenta o intervalo inteiro.
      baseLogger.warn({ err: error }, '[uptime] failed to credit the heartbeat');
    }
  })();

  try {
    await inFlight;
  } finally {
    inFlight = undefined;
  }
}

/**
 * O crédito do desligamento: tenta, e **desiste no prazo** — o mesmo do flush
 * do `ErrorEvent`, pelo mesmo motivo: a hora em que o processo está sendo
 * derrubado é uma hora em que o banco pode ser o suspeito, e o `app.close()`
 * não pode ficar preso nele.
 */
export async function flushUptimeBeforeClose(
  timeoutMs = ERROR_EVENT_CLOSE_TIMEOUT_MS,
  now: Date = new Date(),
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;

  await Promise.race([
    tickUptime(now),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
      timer.unref();
    }),
  ]);

  if (timer !== undefined) clearTimeout(timer);
}

/**
 * Segundos de instância no mês de calendário UTC de `now`, somando os dias —
 * a linha de hoje incluída e incompleta por definição.
 *
 * Mês de calendário porque é como o Render conta: em 29/08/2026 as horas
 * acabaram e a API ficou suspensa **até o dia 1º**.
 */
export async function getMonthUptimeSeconds(now: Date = new Date()): Promise<number> {
  const result = await prisma.dailyUptime.aggregate({
    _sum: { seconds: true },
    where: { date: { gte: startOfUtcMonth(now) } },
  });

  return result._sum.seconds ?? 0;
}
