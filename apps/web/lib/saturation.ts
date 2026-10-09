import type { PlanHoursReading, Saturation, UptimeSeries } from '@newranews/types';
import { fillCalendarDays } from '@/lib/series';

/**
 * O quarto sinal de ouro, do lado de quem desenha (§3.1 e §4.3 do plano de
 * observabilidade).
 *
 * A API já devolve cada razão calculada — `hoursUsed / limitHours`,
 * `rssBytes / limitBytes` — para que a tela não precise conhecer o plano do
 * Render. O que fica aqui é o que só a tela decide: **a partir de que ponto a
 * cor muda**, **o que o ritmo do mês promete**, e — desde a Fase 13 (13b) —
 * **o workspace inteiro a partir da leitura do Billing**. O teto é sempre o
 * `limitHours` que a API manda; um `750` escrito aqui seria um segundo
 * denominador, e há guarda pelo parser contra isso.
 */

/** As horas do plano que a API mandou — as desta API, o teto e a leitura do mês. */
type Plan = NonNullable<Saturation['plan']>;

/** A partir daqui o medidor troca o neutro pelo laranja: é atenção, não alarme. */
export const ATTENTION_RATIO = 0.8;

/** Uma razão de saturação, traduzida no que a §4.2 chama de acento. */
export type SaturationTone = 'neutral' | 'attention' | 'exceeded';

/**
 * `neutral` abaixo de 80%, `attention` de 80% a 100%, `exceeded` a partir de
 * 100% — que é o que suspendeu a API em 29/08/2026. **Laranja marca o que
 * precisa de atenção; o resto é neutro** (§4.2): um medidor que já nasce
 * colorido não destaca nada quando importa.
 */
export function saturationTone(ratio: number): SaturationTone {
  if (ratio >= 1) return 'exceeded';
  if (ratio >= ATTENTION_RATIO) return 'attention';
  return 'neutral';
}

/**
 * O piso de amostra para projetar o mês: **24 h**. Com menos que isso a
 * projeção é ruído — no primeiro minuto do mês, um processo acordado projeta
 * 24/7 e pinta o medidor de vermelho sem motivo. É a armadilha 24 do §17
 * (portão que opina sem linha de base) aplicada a um gráfico. Vale igual para
 * o ritmo dos outros serviços: uma leitura do Billing tirada nas primeiras
 * 24 h do mês não tem ritmo.
 */
export const PACE_MIN_ELAPSED_HOURS = 24;

const HOUR_MS = 3_600_000;

/**
 * O mês do plano, como datas — `null` quando o texto não é um mês, ou quando
 * `now` está noutro mês (relógios em desacordo: a soma fala de outro mês, e a
 * tela não deve inventar).
 */
function planMonth(
  plan: Plan,
  now: Date,
): { monthStart: Date; hoursInMonth: number } | null {
  const monthStart = new Date(plan.monthStart);
  if (Number.isNaN(monthStart.getTime())) return null;

  const [yearText, monthText] = plan.month.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  if (now.getUTCFullYear() !== year || now.getUTCMonth() + 1 !== month) return null;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { monthStart, hoursInMonth: daysInMonth * 24 };
}

/**
 * A leitura do Billing do mês, ou `null`.
 *
 * **Ausente é o mesmo que `null`**, e é por isso que a leitura passa por
 * aqui: o preview da `dev` lê a API de produção, que só ganha o campo na
 * promoção (armadilha 37 do plano), e `plan.workspaceReading.readAt` sobre
 * `undefined` derrubaria a aba.
 */
export function workspaceReadingOf(plan: Plan): PlanHoursReading | null {
  const legacy = plan as Partial<Pick<Plan, 'workspaceReading'>>;
  return legacy.workspaceReading ?? null;
}

export interface WorkspaceHours {
  readAt: Date;
  /** O total que o Billing mostrava na leitura. */
  readHours: number;
  /** Os outros serviços na leitura: o total do Billing menos esta API, no mesmo instante. */
  otherHoursAtRead: number;
  /**
   * Horas dos outros por hora de relógio, medidas na leitura (das 0 h do dia
   * 1º até ela). `null` com menos de {@link PACE_MIN_ELAPSED_HOURS} de mês
   * antes da leitura — ritmo de uma manhã é ruído.
   */
  otherRate: number | null;
  /** Os outros agora: a leitura mais o ritmo dela até agora (sem ritmo, a própria leitura). */
  otherHoursNow: number;
  /** Esta API (medida, `hoursUsed`) mais os outros (estimados). */
  totalHoursNow: number;
  /** `totalHoursNow / limitHours` — a saturação do plano de verdade. */
  ratio: number;
}

/**
 * **O workspace inteiro, a partir da leitura do Billing** (Fase 13, 13b).
 *
 * As 750 h são do workspace, e o workspace divide o teto com outro serviço
 * (`NetsheetEngine`) que esta API não mede. A leitura traz as duas pontas do
 * mesmo instante; a parte dos outros é a diferença, e **entre uma leitura e
 * outra eles andam no ritmo medido nela** — esta API, não: ela é medida a
 * cada tique. A próxima leitura recalibra, e a tela diz de quando é a leitura.
 *
 * `null` sem leitura no mês (ou uma leitura de outro mês — o Billing zera no
 * dia 1º), ou com o mês do plano diferente do relógio.
 */
export function workspaceHours(plan: Plan, now: Date): WorkspaceHours | null {
  const reading = workspaceReadingOf(plan);
  if (!reading) return null;

  const month = planMonth(plan, now);
  if (!month) return null;

  const readAt = new Date(reading.readAt);
  if (Number.isNaN(readAt.getTime())) return null;
  // A leitura é deste mês, ou não fala dele.
  if (
    readAt.getUTCFullYear() !== month.monthStart.getUTCFullYear() ||
    readAt.getUTCMonth() !== month.monthStart.getUTCMonth()
  ) {
    return null;
  }

  const otherHoursAtRead = reading.workspaceHours - reading.apiHours;
  const elapsedAtRead = (readAt.getTime() - month.monthStart.getTime()) / HOUR_MS;
  const otherRate = elapsedAtRead >= PACE_MIN_ELAPSED_HOURS ? otherHoursAtRead / elapsedAtRead : null;
  // Relógio do navegador atrás do servidor não anda os outros para trás.
  const sinceRead = Math.max(0, (now.getTime() - readAt.getTime()) / HOUR_MS);
  const otherHoursNow = otherHoursAtRead + (otherRate ?? 0) * sinceRead;
  const totalHoursNow = plan.hoursUsed + otherHoursNow;

  return {
    readAt,
    readHours: reading.workspaceHours,
    otherHoursAtRead,
    otherRate,
    otherHoursNow,
    totalHoursNow,
    ratio: plan.limitHours > 0 ? totalHoursNow / plan.limitHours : 0,
  };
}

export interface PacePlan {
  /** As horas que o mês inteiro teria neste ritmo. */
  projectedHours: number;
  /** `projectedHours / limitHours` — é o que teria acusado 29/08 no dia 10. */
  projectedRatio: number;
  hoursInMonth: number;
  /**
   * De quem é a projeção: `workspace` com a leitura do Billing; `api` sem ela
   * — e aí a tela diz que os outros serviços não estão na conta.
   */
  scope: 'workspace' | 'api';
}

/**
 * O que as horas do plano prometem para o fim do mês, **no ritmo atual**.
 *
 * `hoursUsed / limitHours` sozinho é o retrato de hoje, e no dia 10 ele diz
 * 32% mesmo quando a API está ligada 24/7 — que é justamente o ritmo que
 * esgota as 750 h no dia 31. O que teria avisado a tempo é a **razão entre as
 * horas consumidas e as horas de calendário decorridas**: 1,0 é "ligada o
 * tempo todo", e 1,0 × 744 h passa do teto. A projeção é essa conta.
 *
 * **Com a leitura do Billing, a conta soma os dois ritmos** (Fase 13, 13b):
 * esta API, medida até agora, e os outros serviços, no ritmo da leitura. Em
 * outubro de 2026 o arco desta API sozinha marcava ~6 % enquanto o workspace
 * caminhava para ~750 h.
 *
 * `null` antes de 24 h de amostra (ver `PACE_MIN_ELAPSED_HOURS`), quando o
 * mês do plano não é o de `now`, quando o dado é inconsistente — e quando há
 * leitura sem ritmo: projetar só esta API esconderia justamente os outros.
 */
export function planPace(plan: Plan, now: Date): PacePlan | null {
  const month = planMonth(plan, now);
  if (!month) return null;

  const elapsedHours = (now.getTime() - month.monthStart.getTime()) / HOUR_MS;
  if (elapsedHours < PACE_MIN_ELAPSED_HOURS) return null;

  const apiRate = plan.hoursUsed / elapsedHours;
  const workspace = workspaceHours(plan, now);
  if (workspaceReadingOf(plan) && workspace?.otherRate == null) return null;

  const rate = workspace ? apiRate + (workspace.otherRate ?? 0) : apiRate;
  const projectedHours = rate * month.hoursInMonth;

  return {
    projectedHours,
    projectedRatio: plan.limitHours > 0 ? projectedHours / plan.limitHours : 0,
    hoursInMonth: month.hoursInMonth,
    scope: workspace ? 'workspace' : 'api',
  };
}

/**
 * Acima disto, o dia desta API é "robô" na faixa medida depois do corte de
 * 01/10/2026 (§23): até ~4 h é o esperado (cron, regenerações, visitas), de 4
 * a 10 h é robô abrindo matéria pela primeira vez, perto de 24 h ela não dorme.
 */
export const ROBOT_HOURS_PER_DAY = 10;

/** O gatilho do 13.9: tantos dias inteiros seguidos acima de {@link ROBOT_HOURS_PER_DAY}. */
export const ROBOT_STREAK_TRIGGER = 2;

/**
 * A série por dia, ou `null` — ausente é a API anterior à Fase 13 (armadilha
 * 37), e não "nenhum dia": uma série vazia desenharia catorze dias de API
 * dormindo.
 */
export function uptimeByDayOf(plan: Plan): UptimeSeries | null {
  const legacy = plan as Partial<Pick<Plan, 'uptimeByDay'>>;
  return legacy.uptimeByDay ?? null;
}

/**
 * **As horas desta API por dia, com a janela inteira** (13.9). A API manda só
 * os dias com linha; o dia sem linha é a API que não acordou, e é zero — o
 * mesmo `fillCalendarDays` da série de produto, pelo mesmo motivo.
 */
export function uptimeDays(series: UptimeSeries): Array<{ date: string; hours: number }> {
  const filled = fillCalendarDays(
    series.days,
    { start: `${series.since}T00:00:00.000Z`, end: `${series.until}T00:00:00.000Z` },
    (date) => ({ date, seconds: 0 }),
  );
  return filled.map((day) => ({ date: day.date, hours: day.seconds / 3600 }));
}

/**
 * Quantos dias **inteiros** seguidos, terminando ontem, passaram de
 * {@link ROBOT_HOURS_PER_DAY} — o gatilho do 13.9 é isto a partir de
 * {@link ROBOT_STREAK_TRIGGER}. O último dia da série é hoje e é parcial: um
 * dia que ainda não terminou não entra, nem para disparar nem para quebrar.
 * "Acima de", não "a partir de": 10 h cravadas é a borda da faixa, não robô.
 */
export function robotStreak(days: Array<{ date: string; hours: number }>): number {
  let streak = 0;
  for (let i = days.length - 2; i >= 0; i -= 1) {
    if (days[i]!.hours <= ROBOT_HOURS_PER_DAY) break;
    streak += 1;
  }
  return streak;
}

/**
 * O número do Billing como o teclado o escreve — `124,27` ou `124.27` —, em
 * horas. `null` para o que não é um número de horas não negativo: texto, sinal,
 * expoente, separador de milhar (o pool para em 750 h, e `1.234,5` é mais
 * provável de ser engano que leitura).
 *
 * A API recebe **número** e recusa texto: quem sabe o idioma de quem digita é
 * a tela.
 */
export function parseHoursInput(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+([.,]\d+)?$/.test(trimmed)) return null;
  const hours = Number(trimmed.replace(',', '.'));
  return Number.isFinite(hours) ? hours : null;
}
