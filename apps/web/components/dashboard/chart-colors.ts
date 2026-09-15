/**
 * As cinco cores de gráfico dos tokens (`--chart-1..5`), nas duas formas em
 * que um componente as escreve: `bg-*` para barra e legenda, `stroke-*` para
 * o arco de uma rosquinha em SVG.
 *
 * **Uma lista, dois consumidores.** O `CategoryBars` já tinha a sua desde a
 * Fase 8; a rosquinha da Fase 5 do plano de observabilidade precisava das
 * mesmas cores em `stroke`, e duplicar a lista seria o segundo lugar onde a
 * paleta é digitada. As classes precisam existir por extenso — o Tailwind v4
 * só emite a utility que encontra escrita.
 */
export const CHART_COLORS = [
  { bg: 'bg-chart-1', stroke: 'stroke-chart-1' },
  { bg: 'bg-chart-2', stroke: 'stroke-chart-2' },
  { bg: 'bg-chart-3', stroke: 'stroke-chart-3' },
  { bg: 'bg-chart-4', stroke: 'stroke-chart-4' },
  { bg: 'bg-chart-5', stroke: 'stroke-chart-5' },
] as const;

export type ChartColor = (typeof CHART_COLORS)[number];

/** A cor da n-ésima fatia ou barra — a paleta repete a partir da sexta. */
export function chartColor(index: number): ChartColor {
  return CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0];
}
