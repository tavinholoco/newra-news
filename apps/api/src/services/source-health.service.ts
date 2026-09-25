import { prisma, type SourceKind, type SourceOutcome } from '@newranews/database';
import type { SourceHealthReport, SourceSeries } from '@newranews/types';
import type { RawNewsItem } from '../providers/types';
import { scrubMessage } from '../utils/logger';
import { NEWSDATA_SOURCE, type SourceFetch } from './news-fetcher.service';

/**
 * **A saúde de cada fonte, um dia de cada vez — §15 do plano de
 * observabilidade, Fase 11.**
 *
 * O que fecha: o pipeline sabia hoje qual fonte falhou e esquecia amanhã. O
 * aviso por fonte da etapa 1 virava o `context` de um `PipelineEvent` e
 * morria com o run — "há quantos dias a Superinteressante está fora?" exigia
 * ler os eventos de N dias e cruzar à mão, e a fonte que definha (entregava 20
 * por dia, passou a entregar 2) não falha nunca, então não deixava aviso
 * nenhum. Esta é a memória: **uma linha por `(source, dia)`**.
 *
 * ## `kept` é a coluna que faz a fase valer, e o que ela conta é decisão
 *
 * `fetched` mede o que a fonte publicou; `kept` mede o que ela **acrescentou
 * ao acervo** — e é o número certo para "vale a pena trocar este provedor?"
 * (§17.25: a fonte que republica o que outra já deu tem volume alto e
 * contribuição nula). O inventário da §15 mediu que "sobreviveu à deduplicação
 * da etapa 3" não separa nada — aquele dedup é por URL, e dois veículos com a
 * mesma pauta têm URLs diferentes. O que responde "acrescentou" é o
 * `skipDuplicates` da etapa 4, e por fonte é: **o item cuja URL entrou em
 * `News` naquele dia** (`createdAt >= day`) — neste run ou num anterior do
 * mesmo dia.
 *
 * "Naquele dia", e não "antes deste run", é o que salva o re-disparo: o
 * `triggerPipeline` só aceita um segundo run depois de um `FAILED`, e um
 * `FAILED` na etapa 6 já escreveu as fontes com números honestos — contar
 * "novo antes do run" no segundo acharia tudo gravado, zeraria `kept` em toda
 * fonte, e o `deleteMany` + `createMany` abaixo gravaria isso por cima.
 *
 * **O limite honesto, escrito:** a atribuição segue a deduplicação da etapa 3,
 * que fica com a **primeira** ocorrência de uma URL — e `allItems` põe a
 * NewsData antes do RSS. Uma matéria do G1 que a NewsData também trouxe conta
 * para `newsdata`, não para o feed do G1. É a contribuição *marginal* de cada
 * fonte dada a ordem em que o pipeline as consome, e é exatamente o número que
 * responde "de que eu realmente dependo".
 *
 * ## Uma escrita por run, depois da etapa 4, e ela nunca aborta o run
 *
 * `fetched` e o desfecho existem na etapa 1; `kept` só existe depois de o
 * `createMany` de `News` decidir o que era novo — por isso a escrita é depois
 * da 4, e não "na etapa 1, junto da coleta" como a §15 desenhava. **O último
 * run do dia representa o dia** (a regra da Fase 8): `deleteMany` do dia mais
 * `createMany`, numa transação de duas instruções — não treze `upsert` numa
 * instância de 0.1 vCPU. E a chamada mora num `try` cujo `catch` é `WARN` da
 * etapa 4: observabilidade nunca quebra o caminho que observa (§2.1).
 *
 * ## "Não tentada" é ausência
 *
 * `SourceOutcome` tem três valores. A fonte removida de `rss-sources.ts` e o
 * run que morreu antes da etapa 4 não produzem linha — e o web desenha o dia
 * sem linha como não tentado, como faz com o dia sem run (`NEVER_RAN`). Valor
 * que a API nunca emite não entra no tipo.
 */

/**
 * Por quantos dias a linha fica gravada.
 *
 * **90 — mais que os 14 do `ErrorEvent` e os 30 do `PipelineLog`**, porque
 * "esta fonte vale a pena?" é pergunta trimestral; e igual à do `Article`, para
 * cruzar "o briefing daquele dia" com "quem o alimentou". 90 dias × 12 fontes
 * (os 11 feeds e a NewsData) ≈ 1.080 linhas. Quem apaga é a etapa 8 do pipeline diário.
 */
export const SOURCE_HEALTH_RETENTION_DAYS = 90;

/** Teto da janela de leitura: pedir mais que a retenção devolveria dias que o expurgo já esvaziou. */
export const SOURCE_HEALTH_WINDOW_MAX_DAYS = SOURCE_HEALTH_RETENTION_DAYS;
export const SOURCE_HEALTH_WINDOW_DEFAULT_DAYS = 30;

/** Uma linha da tabela, pronta para o `createMany`. */
export interface SourceHealthRow {
  source: string;
  kind: SourceKind;
  day: Date;
  fetched: number;
  kept: number;
  outcome: SourceOutcome;
  failureReason: string | null;
  latencyMs: number | null;
  pipelineLogId: string | null;
}

/**
 * O desfecho de uma fonte a partir do que a coleta devolveu.
 *
 * A tabela é a da §15, com três linhas em vez de quatro: lançou → `FAILED`
 * (o `feed-failed`, ou o `provider-failed` por cima dela); respondeu e não
 * tinha nada → `EMPTY` (o `feed-empty`/`provider-empty`, que **não** degrada
 * o run); trouxe item → `OK`. A guarda em `source-health.test.ts` enumera as
 * quatro `FetchWarningKind` e cobra o desfecho de cada uma.
 */
export function outcomeForSource(fetch: Pick<SourceFetch, 'fetched' | 'failure'>): SourceOutcome {
  if (fetch.failure !== undefined) return 'FAILED';
  if (fetch.fetched === 0) return 'EMPTY';
  return 'OK';
}

/**
 * Quantos itens de cada fonte entraram no acervo naquele dia.
 *
 * `items` são os deduplicados da etapa 3 — os que chegaram ao `createMany` —,
 * `fromNewsData` é o conjunto dos objetos que o agregador devolveu (por
 * identidade, e não por `source`: o `RawNewsItem.source` da NewsData é o nome
 * do veículo, que pode coincidir com o nome de um feed), e `enteredToday`
 * responde pela URL, lendo o `createdAt` que a etapa 4 consultou.
 */
export function countKeptBySource(
  items: readonly RawNewsItem[],
  fromNewsData: ReadonlySet<RawNewsItem>,
  enteredToday: (sourceUrl: string) => boolean,
): Map<string, number> {
  const kept = new Map<string, number>();
  for (const item of items) {
    if (!enteredToday(item.sourceUrl)) continue;
    const source = fromNewsData.has(item) ? NEWSDATA_SOURCE : item.source;
    kept.set(source, (kept.get(source) ?? 0) + 1);
  }
  return kept;
}

/**
 * As linhas do dia, uma por fonte que a coleta tentou.
 *
 * `kept` nunca passa de `fetched` por construção — os itens contados vieram
 * da própria fonte —, e a guarda cobra isso porque é a asserção que pega erro
 * de atribuição de coluna. `failureReason` só existe em `FAILED`, e passa pelo
 * mesmo `scrubMessage` do `ErrorEvent` — redigida e truncada, porque coluna
 * vaza de forma durável o que o log aprendeu a esconder.
 */
export function buildSourceHealthRows(input: {
  day: Date;
  pipelineLogId: string | null;
  sources: readonly SourceFetch[];
  keptBySource: ReadonlyMap<string, number>;
}): SourceHealthRow[] {
  return input.sources.map((fetch) => {
    const outcome = outcomeForSource(fetch);
    return {
      source: fetch.source,
      kind: fetch.kind,
      day: input.day,
      fetched: fetch.fetched,
      // Sem clamp, de propósito: um `Math.min` aqui esconderia o erro de
      // atribuição que a guarda `kept ≤ fetched` existe para achar.
      kept: input.keptBySource.get(fetch.source) ?? 0,
      outcome,
      failureReason:
        outcome === 'FAILED' && fetch.failure !== undefined
          ? scrubMessage(fetch.failure)
          : null,
      latencyMs: Math.max(0, Math.round(fetch.latencyMs)),
      pipelineLogId: input.pipelineLogId,
    };
  });
}

/**
 * Grava o dia: **o último run vence**, numa transação de duas instruções.
 *
 * Com zero linhas não toca no banco — um `deleteMany` seguido de um
 * `createMany` vazio apagaria o dia que um run anterior já escreveu.
 */
export async function recordSourceHealth(day: Date, rows: SourceHealthRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  await prisma.$transaction([
    prisma.sourceHealth.deleteMany({ where: { day } }),
    prisma.sourceHealth.createMany({ data: rows }),
  ]);
  return rows.length;
}

/**
 * Apaga linha mais velha que {@link SOURCE_HEALTH_RETENTION_DAYS}, por `day`.
 */
export async function deleteExpiredSourceHealth(now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - SOURCE_HEALTH_RETENTION_DAYS);

  const { count } = await prisma.sourceHealth.deleteMany({ where: { day: { lt: cutoff } } });
  return count;
}

/**
 * A janela, agrupada por fonte — uma consulta, ordenada por fonte e dia.
 *
 * Aparece toda fonte com linha na janela, inclusive a que saiu de
 * `rss-sources.ts` no meio dela: a série termina no dia da remoção, e o web
 * desenha o resto como não tentada. As médias, a variação e a sequência de
 * falhas são derivadas no web (`lib/source-days.ts`), como o desfecho por dia
 * da Fase 8 — a API devolve o que a tabela tem.
 */
export async function getSourceHealthReport(options: {
  days: number;
  now?: Date;
}): Promise<SourceHealthReport> {
  const now = options.now ?? new Date();
  const until = new Date(now);
  until.setUTCHours(0, 0, 0, 0);
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - (options.days - 1));

  const rows = await prisma.sourceHealth.findMany({
    where: { day: { gte: since, lte: until } },
    orderBy: [{ source: 'asc' }, { day: 'asc' }],
  });

  const series = new Map<string, SourceSeries>();
  for (const row of rows) {
    let entry = series.get(row.source);
    if (!entry) {
      entry = { source: row.source, kind: row.kind, days: [] };
      series.set(row.source, entry);
    }
    entry.days.push({
      day: row.day.toISOString(),
      outcome: row.outcome,
      fetched: row.fetched,
      kept: row.kept,
      latencyMs: row.latencyMs,
      failureReason: row.failureReason,
      pipelineLogId: row.pipelineLogId,
    });
  }

  return {
    window: { days: options.days, since: since.toISOString(), until: until.toISOString() },
    sources: [...series.values()],
  };
}
