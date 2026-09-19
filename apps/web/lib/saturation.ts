import type { Saturation } from '@newranews/types';

/**
 * O quarto sinal de ouro, do lado de quem desenha (§3.1 e §4.3 do plano de
 * observabilidade).
 *
 * A API já devolve cada razão calculada — `hoursUsed / limitHours`,
 * `rssBytes / limitBytes` — para que a tela não precise conhecer o plano do
 * Render. O que fica aqui é o que só a tela decide: **a partir de que ponto a
 * cor muda**, e **o que o ritmo do mês promete**.
 */

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
 * (portão que opina sem linha de base) aplicada a um gráfico.
 */
export const PACE_MIN_ELAPSED_HOURS = 24;

export interface PacePlan {
  /** As horas que o mês inteiro teria neste ritmo. */
  projectedHours: number;
  /** `projectedHours / limitHours` — é o que teria acusado 29/08 no dia 10. */
  projectedRatio: number;
  hoursInMonth: number;
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
 * `null` antes de 24 h de amostra (ver `PACE_MIN_ELAPSED_HOURS`), quando o
 * mês do plano não é o de `now` (relógios em desacordo — a tela não deve
 * inventar), ou quando o dado é inconsistente.
 */
export function planPace(
  plan: NonNullable<Saturation['plan']>,
  now: Date,
): PacePlan | null {
  const monthStart = new Date(plan.monthStart);
  if (Number.isNaN(monthStart.getTime())) return null;

  const [yearText, monthText] = plan.month.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

  // O mês de `now` tem de ser o do plano: fora disso a soma fala de outro mês.
  if (now.getUTCFullYear() !== year || now.getUTCMonth() + 1 !== month) return null;

  const elapsedHours = (now.getTime() - monthStart.getTime()) / 3_600_000;
  if (elapsedHours < PACE_MIN_ELAPSED_HOURS) return null;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const hoursInMonth = daysInMonth * 24;
  const projectedHours = (plan.hoursUsed / elapsedHours) * hoursInMonth;

  return {
    projectedHours,
    projectedRatio: plan.limitHours > 0 ? projectedHours / plan.limitHours : 0,
    hoursInMonth,
  };
}
