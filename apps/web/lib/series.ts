/**
 * Uma série por dia com **todos os dias da janela**, zero onde não houve
 * nada.
 *
 * O `byDay` do `/api/metrics/product` só traz os dias que têm evento — é um
 * `Map` preenchido a partir das linhas. Desenhado assim, um dia com evento numa
 * janela de 30 vira **uma barra de largura inteira**, e o eixo do tempo deixa
 * de existir: a barra parece dizer "o mês inteiro" quando diz "um dia". A
 * série honesta tem um lugar por dia de calendário, e o vazio é dado.
 *
 * As chaves são dias UTC (`YYYY-MM-DD`, o `toISOString().slice(0, 10)` do
 * serviço), então o calendário é gerado em UTC: `period.start` é um instante
 * (`end − days`), e o primeiro e o último dia entram parciais, como na API.
 */
export function fillCalendarDays<T extends { date: string }>(
  points: T[],
  period: { start: string; end: string },
  empty: (date: string) => T,
): T[] {
  const byDate = new Map(points.map((point) => [point.date, point]));
  const start = new Date(period.start);
  const end = new Date(period.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return points;
  }

  const filled: T[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());

  while (cursor.getTime() <= last) {
    const key = cursor.toISOString().slice(0, 10);
    filled.push(byDate.get(key) ?? empty(key));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return filled;
}
