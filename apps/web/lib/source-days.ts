import type { SourceDay, SourceHealthReport, SourceKind, SourceOutcome, SourceSeries } from '@newranews/types';
import { fillCalendarDays } from './series';

/**
 * A saúde de cada fonte, lida por dia de calendário. (§15 do plano de
 * observabilidade, Fase 11 — o `outcome-days.ts` desta série)
 *
 * A API devolve, por fonte, **só os dias com linha**; o quarto estado — "não
 * tentada" — é ausência, e a ausência é derivada aqui, pelo calendário, como
 * o `NEVER_RAN` do run. A fonte removida de `rss-sources.ts` no meio da
 * janela, o dia em que o pipeline não rodou, e o run que morreu antes da
 * etapa 4 chegam iguais: um dia sem linha, desenhado vazado. Não é falha da
 * fonte, e as duas pedem ações opostas.
 */
export type SourceDayState = SourceOutcome | 'NOT_ATTEMPTED';

export interface SourceCalendarDay {
  /** O dia UTC, `YYYY-MM-DD`. */
  date: string;
  state: SourceDayState;
  /** A linha, ou `null` em `NOT_ATTEMPTED`. */
  day: SourceDay | null;
}

/** A janela do painel: 30 dias, hoje incluído — a mesma da faixa do run. */
export const SOURCE_WINDOW_DAYS = 30;

/** A janela curta das médias e da variação. */
export const SOURCE_RECENT_DAYS = 7;

/**
 * A partir de quantos dias seguidos de `FAILED` a sequência vira gatilho — a
 * Superinteressante de 03/09/2026 estava no segundo, e ninguém viu até olhar.
 */
export const FAILED_STREAK_TRIGGER = 3;

/**
 * Abaixo de que fração da média de 30 dias a média de 7 vira gatilho de
 * definhamento: a fonte que entregava 20 e passou a entregar 2 não falha
 * nunca, e este é o único número que a acha.
 */
export const WITHERING_RATIO = 0.3;

/**
 * Amostra mínima para as médias opinarem (armadilha 24: portão sem linha de
 * base dá `NaN`, e `NaN` compara `false` em toda direção). Abaixo disto a
 * variação sai `null` e a tela diz que se calou.
 */
export const MIN_RECENT_SAMPLE = 3;
export const MIN_WINDOW_SAMPLE = 7;

/** Um dia por dia de calendário da janela, do mais antigo para o último. */
export function sourceCalendar(
  series: SourceSeries,
  window: { since: string; until: string },
): SourceCalendarDay[] {
  const points: SourceCalendarDay[] = series.days.map((day) => ({
    date: day.day.slice(0, 10),
    state: day.outcome,
    day,
  }));
  return fillCalendarDays(points, { start: window.since, end: window.until }, (date) => ({
    date,
    state: 'NOT_ATTEMPTED' as const,
    day: null,
  }));
}

/** O que a tabela mostra de cada fonte — tudo derivado da série. */
export interface SourceStats {
  source: string;
  kind: SourceKind;
  /** O último dia da janela — "hoje" na tela. */
  today: SourceCalendarDay;
  calendar: SourceCalendarDay[];
  /** Média de `kept` sobre os dias **tentados** dos últimos 7; `null` sem amostra. */
  keptAvg7: number | null;
  /** Média de `kept` sobre os dias tentados da janela; `null` sem amostra. */
  keptAvg30: number | null;
  /** Soma de `kept` na janela — a fatia da rosquinha. */
  keptTotal: number;
  /** `keptAvg7 / keptAvg30 − 1`; `null` quando uma das médias não existe ou a de 30 é zero. */
  keptChange: number | null;
  /** Dias seguidos de `FAILED`, do mais recente para trás; o dia não tentado não quebra. */
  failedStreak: number;
  /** A latência do último dia tentado, ou `null`. */
  latencyMs: number | null;
}

/** Média de `kept` sobre os dias com linha, `null` abaixo da amostra mínima. */
function keptAverage(days: SourceCalendarDay[], minSample: number): number | null {
  const attempted = days.filter((day) => day.day !== null);
  if (attempted.length < minSample) return null;
  const total = attempted.reduce((sum, day) => sum + (day.day as SourceDay).kept, 0);
  return total / attempted.length;
}

/**
 * Dias seguidos de `FAILED` do fim para o começo. **Conta dias tentados**: o
 * dia sem linha não diz que a fonte voltou — o pipeline é que não a
 * perguntou —, então não quebra a sequência; `OK` e `EMPTY` quebram.
 */
export function failedStreak(calendar: SourceCalendarDay[]): number {
  let streak = 0;
  for (let index = calendar.length - 1; index >= 0; index--) {
    const state = calendar[index]?.state;
    if (state === 'NOT_ATTEMPTED') continue;
    if (state !== 'FAILED') break;
    streak++;
  }
  return streak;
}

/**
 * As médias, a variação e a sequência de cada fonte.
 *
 * **As médias são sobre os dias tentados, não sobre os dias de calendário.**
 * Contar o dia em que o pipeline não rodou como zero penalizaria a fonte
 * pela falha da API — foi o que aconteceu em 29–31/08. O dia `FAILED` e o
 * `EMPTY` **contam como zero**: ali a fonte foi perguntada e não deu nada, e
 * isso é dela.
 */
export function sourceStats(series: SourceSeries, window: { since: string; until: string }): SourceStats {
  const calendar = sourceCalendar(series, window);
  const today = calendar[calendar.length - 1] as SourceCalendarDay;
  const recent = calendar.slice(-SOURCE_RECENT_DAYS);
  const keptAvg7 = keptAverage(recent, MIN_RECENT_SAMPLE);
  const keptAvg30 = keptAverage(calendar, MIN_WINDOW_SAMPLE);
  const lastAttempted = [...calendar].reverse().find((day) => day.day !== null);

  return {
    source: series.source,
    kind: series.kind,
    today,
    calendar,
    keptAvg7,
    keptAvg30,
    keptTotal: series.days.reduce((sum, day) => sum + day.kept, 0),
    keptChange:
      keptAvg7 !== null && keptAvg30 !== null && keptAvg30 > 0 ? keptAvg7 / keptAvg30 - 1 : null,
    failedStreak: failedStreak(calendar),
    latencyMs: lastAttempted?.day?.latencyMs ?? null,
  };
}

/** Os dois gatilhos numéricos da §15, medidos — e só eles. */
export type SourceAlert =
  | { kind: 'failed-streak'; source: string; days: number }
  | { kind: 'withering'; source: string; ratio: number };

/**
 * A fonte com 3 dias seguidos de `FAILED` (a Superinteressante de 03/09), e
 * a fonte cujo `kept` de 7 dias caiu abaixo de 30 % do de 30 (a que definha,
 * que ninguém via). A linha só existe a partir do gatilho: uma linha por
 * fonte quieta ensina a ignorá-la.
 */
export function sourceAlerts(stats: SourceStats[]): SourceAlert[] {
  const alerts: SourceAlert[] = [];
  for (const entry of stats) {
    if (entry.failedStreak >= FAILED_STREAK_TRIGGER) {
      alerts.push({ kind: 'failed-streak', source: entry.source, days: entry.failedStreak });
    }
    if (
      entry.keptAvg7 !== null &&
      entry.keptAvg30 !== null &&
      entry.keptAvg30 > 0 &&
      entry.keptAvg7 / entry.keptAvg30 < WITHERING_RATIO &&
      entry.failedStreak < FAILED_STREAK_TRIGGER
    ) {
      alerts.push({ kind: 'withering', source: entry.source, ratio: entry.keptAvg7 / entry.keptAvg30 });
    }
  }
  return alerts;
}

/** As estatísticas de todas as fontes do relatório. */
export function reportStats(report: SourceHealthReport): SourceStats[] {
  return report.sources.map((series) => sourceStats(series, report.window));
}
