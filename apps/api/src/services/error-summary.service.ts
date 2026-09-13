import { prisma } from '@newranews/database';
import type { ErrorOrigin, ErrorSeverity } from '@newranews/database';
import type { ErrorGroup, ErrorSummary, ErrorSummaryWindow } from '@newranews/types';
import { ERROR_CATEGORIES } from '../utils/errors';
import { windowStartFor } from './error-event.service';

/**
 * **A leitura do `ErrorEvent` — §9 do plano de observabilidade, PR 5b.**
 *
 * A Fase 4 fez a falha sobreviver à linha de log; até este arquivo, ninguém a
 * lia. A aba de segurança (5c) precisa de duas coisas: os erros **agrupados por
 * fingerprint** na janela (código, contagem, visto por último, rota, mensagem,
 * `lastRequestId`) e a **rosquinha por categoria** — e não existia rota que
 * devolvesse nenhuma das duas.
 *
 * ## Por que agrupar em memória, e o número que muda isso
 *
 * A tabela é coalescida por construção: uma linha por `(fingerprint, hora)`,
 * então a janela de 7 dias tem no máximo *fingerprints distintos × 168* linhas
 * — e o §16 já dá o gatilho de fingerprint granular demais em **> 2.000 linhas
 * em 14 dias**. Abaixo disso, um `findMany` com `take` e um `Map` custam menos
 * que o `groupBy` do Prisma seguido de uma segunda consulta para buscar a
 * mensagem e o `lastRequestId` de cada grupo (que o `groupBy` não devolve).
 * **Gatilho, também do §16:** p95 de `GET /api/admin/errors` acima de 1.000 ms
 * no `/api/metrics/http`.
 *
 * Fica num arquivo próprio, e não no `error-event.service.ts`, por dois
 * motivos: aquele é o **escritor** e este é o leitor; e este importa
 * `ERROR_CATEGORIES` de `utils/errors`, que importa `recordError` daquele —
 * juntar os dois fecharia um ciclo em tempo de execução.
 */

/** As duas janelas que a tela oferece, em horas. */
export const ERROR_SUMMARY_WINDOWS = { '24h': 24, '7d': 24 * 7 } as const satisfies Record<
  ErrorSummaryWindow,
  number
>;

/**
 * Teto de linhas lidas. Está **acima** do gatilho do §16 de propósito: se a
 * tabela passar dele, a tela mostra o recorte e o `truncated` diz que mostrou —
 * o que se conserta então é o normalizador do fingerprint, não este número.
 */
export const ERROR_SUMMARY_ROW_CEILING = 5_000;

const SEVERITIES: ErrorSeverity[] = ['WARN', 'ERROR', 'FATAL'];
const ORIGINS: ErrorOrigin[] = ['API', 'PIPELINE', 'WEB', 'INVARIANT'];

export async function getErrorSummary(
  windowKey: ErrorSummaryWindow,
  now: Date = new Date(),
): Promise<ErrorSummary> {
  const hours = ERROR_SUMMARY_WINDOWS[windowKey];
  /**
   * **Alinhada à hora cheia, e é achado da verificação pós-merge.** A tabela
   * guarda um balde por hora, e a primeira versão comparava `windowStart >=
   * now − 24 h`: com `now` às 15:30, o balde das 14:00 de ontem — que contém
   * ocorrências das 14:30 às 14:59, **dentro** da janela — ficava de fora
   * inteiro, porque começa antes dela. Até 59 min de "24h" sumiam, sem sinal.
   * O piso vai para a hora cheia que contém o início da janela, e o `since` da
   * resposta diz o valor de fato usado: a janela é *as últimas N horas, mais o
   * que sobrar da hora em que ela começa*.
   */
  const since = windowStartFor(new Date(now.getTime() - hours * 60 * 60 * 1000));

  // Mais recente primeiro **na leitura**, e não só na saída: com o teto, o que
  // fica de fora é o mais velho, que é o que menos responde "o que está
  // quebrado agora".
  const rows = await prisma.errorEvent.findMany({
    where: { windowStart: { gte: since } },
    orderBy: { lastSeenAt: 'desc' },
    take: ERROR_SUMMARY_ROW_CEILING,
  });

  const groups = new Map<string, ErrorGroup>();
  const byCategory = new Map<string, number>(ERROR_CATEGORIES.map((c) => [c, 0]));
  const bySeverity = new Map<ErrorSeverity, number>(SEVERITIES.map((s) => [s, 0]));
  const byOrigin = new Map<ErrorOrigin, number>(ORIGINS.map((o) => [o, 0]));
  let total = 0;

  for (const row of rows) {
    total += row.count;
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.count);
    bySeverity.set(row.severity, (bySeverity.get(row.severity) ?? 0) + row.count);
    byOrigin.set(row.origin, (byOrigin.get(row.origin) ?? 0) + row.count);

    const existing = groups.get(row.fingerprint);
    if (existing) {
      // As linhas chegam da mais recente para a mais velha, então a primeira
      // vista já trouxe mensagem, `lastSeenAt` e `lastRequestId` certos; o que
      // as seguintes acrescentam é contagem, horas e o `firstSeenAt` mais velho.
      existing.count += row.count;
      existing.hours += 1;
      if (row.firstSeenAt.toISOString() < existing.firstSeenAt) {
        existing.firstSeenAt = row.firstSeenAt.toISOString();
      }
      continue;
    }

    groups.set(row.fingerprint, {
      fingerprint: row.fingerprint,
      origin: row.origin,
      severity: row.severity,
      code: row.code,
      category: row.category,
      route: row.route,
      statusCode: row.statusCode,
      message: row.message,
      count: row.count,
      hours: 1,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      lastRequestId: row.lastRequestId,
      pipelineLogId: row.pipelineLogId,
    });
  }

  return {
    window: {
      key: windowKey,
      hours,
      since: since.toISOString(),
      until: now.toISOString(),
    },
    total,
    distinctFingerprints: groups.size,
    byCategory: [...byCategory.entries()].map(([category, count]) => ({ category, count })),
    bySeverity: [...bySeverity.entries()].map(([severity, count]) => ({ severity, count })),
    byOrigin: [...byOrigin.entries()].map(([origin, count]) => ({ origin, count })),
    groups: [...groups.values()],
    truncated: rows.length >= ERROR_SUMMARY_ROW_CEILING,
  };
}
