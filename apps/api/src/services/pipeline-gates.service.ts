import { prisma } from '@newranews/database';
import type { RawNewsItem } from '../providers/types';
import {
  OUTPUT_GUARD_CHECKS,
  type GateReason,
  type OutputGuardCheck,
} from '../providers/ai/output-guard';

/**
 * **Os dois portões do pipeline — §13 do plano de observabilidade, Fase 9.**
 *
 * O briefing ia para a capa **sem ninguém conferir se ele deveria**. A
 * literatura de pipeline de dados chama a peça que falta de *portão de
 * qualidade com disjuntor*; a de LLM em produção, de *guardrail de saída*. São
 * a mesma ideia em dois vocabulários, e o pipeline precisa das duas:
 *
 * - **etapa 5.5, o portão de entrada** (`evaluateEntryGate`, aqui) — roda
 *   depois da seleção e antes da chamada de IA. O argumento é econômico antes
 *   de ser de qualidade: não gastar a chamada do modelo sobre uma colheita que
 *   não presta. Melhor nenhum briefing que um briefing escrito a partir de três
 *   matérias de uma fonte só;
 * - **etapa 6.5, o portão de saída** (`providers/ai/output-guard.ts`) — roda
 *   sobre cada candidato que um provider devolve, antes de persistir. É a
 *   camada de segurança.
 *
 * Este módulo é dono do que os dois partilham: o **conjunto de checks** (que é
 * o que entra no `route` do `ErrorEvent`, e por isso tem de ser finito), o
 * **`GateBlockedError`** (a forma pela qual um bloqueio atravessa o
 * `ai.service` e chega ao `catch` do pipeline sabendo de que portão veio), e a
 * **etapa** de cada portão.
 *
 * **Puro onde dá.** `evaluateEntryGate` recebe tudo por parâmetro — a
 * colheita, a seleção, a linha de base, o relógio — e devolve um veredito; só
 * `loadEntryBaseline` vai ao banco, e é uma consulta de sete linhas sobre o
 * índice de `DailyMetric.date`.
 */

// ── O que os dois portões partilham ─────────────────────────────────────────

export type Gate = 'entry' | 'exit';

/**
 * A etapa de cada portão. `stage` e `errorStage` são `Float` desde a 7.5, e o
 * `diagram-drift` deriva as etapas dos **literais** em `logPipelineEvent(…)` —
 * o pipeline escreve `5.5` e `6.5` à mão, e estas constantes servem a quem lê.
 */
export const GATE_STAGES: Record<Gate, number> = { entry: 5.5, exit: 6.5 };

/** Os checks do portão de entrada, como tuple. */
export const ENTRY_GATE_CHECKS = [
  'volume',
  'diversity',
  'freshness',
  'duplicate-rate',
  'category-drift',
] as const;

export type EntryGateCheck = (typeof ENTRY_GATE_CHECKS)[number];

/**
 * **Todo check dos dois portões.** É o teto da terceira peça do fingerprint
 * (`route: 'stage-6.5:unanchored-url'`): o `ErrorEvent` agrupa por
 * `(code, route)`, e o motivo do bloqueio precisa estar no `route` para a
 * distribuição de motivos existir (§13.3) — mas só pode estar lá porque o
 * conjunto é finito. `isGateCheck` é o que `recordPipelineEvent` usa para não
 * aceitar um motivo que ninguém declarou.
 */
export const GATE_CHECKS = [...ENTRY_GATE_CHECKS, ...OUTPUT_GUARD_CHECKS] as const;

export type GateCheck = EntryGateCheck | OutputGuardCheck;

export function isGateCheck(value: unknown): value is GateCheck {
  return typeof value === 'string' && (GATE_CHECKS as readonly string[]).includes(value);
}

export function isGate(value: unknown): value is Gate {
  return value === 'entry' || value === 'exit';
}

export function isGateReason(value: unknown): value is GateReason {
  return value === 'security' || value === 'quality';
}

/**
 * Um portão bloqueou, e o dia não segue por este caminho.
 *
 * Carrega o que o `catch` do pipeline precisa para gravar a falha na etapa
 * certa com o motivo no fingerprint — `extractErrorDetail` lê `gate`, `check`
 * e `reason` daqui. O `stage` sai de {@link GATE_STAGES}, e não é passado à
 * mão: o mesmo portão não bloqueia em duas etapas.
 *
 * **A mensagem de um bloqueio de segurança diz que re-disparar repete o
 * ataque.** `triggerPipeline` aceita re-disparo depois de um `FAILED`, e o
 * botão da `/admin` o faz sem perguntar — o mesmo material envenenado voltaria
 * ao modelo e o portão bloquearia de novo. Sem dano, mas sem sentido, e a
 * frase é o que evita a segunda rodada de investigação.
 */
export class GateBlockedError extends Error {
  readonly gate: Gate;
  readonly stage: number;
  readonly check: GateCheck;
  readonly reason: GateReason;
  readonly detail: string;
  /** O provider cuja saída foi bloqueada — só no portão de saída. */
  readonly provider?: string;

  constructor(input: {
    gate: Gate;
    check: GateCheck;
    reason: GateReason;
    detail: string;
    provider?: string;
  }) {
    const where = input.gate === 'entry' ? 'Entry gate' : 'Output guard';
    const who = input.provider ? ` (${input.provider})` : '';
    const tail =
      input.reason === 'security'
        ? ' — security block: the cause is in the material, re-triggering repeats the attack'
        : '';
    super(`${where} blocked${who}: ${input.check} (${input.detail})${tail}`);
    this.name = 'GateBlockedError';
    this.gate = input.gate;
    this.stage = GATE_STAGES[input.gate];
    this.check = input.check;
    this.reason = input.reason;
    this.detail = input.detail;
    if (input.provider !== undefined) this.provider = input.provider;
  }
}

// ── O portão de entrada ─────────────────────────────────────────────────────

/** A janela da mediana móvel: os sete dias **anteriores** — o de hoje ainda não existe. */
export const ENTRY_BASELINE_DAYS = 7;

/**
 * Abaixo disto o portão de volume **não opina**, e diz que não opinou.
 *
 * A mediana de 7 dias precisa de dias. No primeiro dia depois do deploy ela é
 * indefinida; depois de uma lacuna como a de 29–31/08 ela seria calculada sobre
 * dias vazios — perto de zero, aprovando qualquer coisa, ou um `NaN` que
 * compara `false` em toda direção e **bloquearia tudo** (armadilha 24). Um
 * portão que não sabe o normal não tem o que dizer sobre o anormal.
 */
export const MIN_BASELINE_DAYS = 3;

/** Volume do dia abaixo desta fração da mediana bloqueia. Relativo de propósito (armadilha 16). */
export const MIN_VOLUME_RATIO = 0.3;

/** Fontes distintas entre os selecionados. */
export const MIN_DISTINCT_SOURCES = 3;

/**
 * Quantos itens a seleção alargada pega antes de o portão desistir.
 *
 * `selectTopItems` pega as 15 mais recentes; se elas vierem de menos de três
 * fontes, isso é acidente de ordenação, não escassez de matéria. O portão
 * refaz a seleção com 30 **uma vez** e só bloqueia se ainda assim não houver
 * diversidade — bloquear na primeira tentativa trocaria "a ordenação
 * concentrou" por "o dia não tem notícia", que são coisas diferentes.
 */
export const WIDENED_SELECTION = 30;

/**
 * Janela do frescor: 24 h, e não "hoje". ~39% de toda colheita chega carimbada
 * com a data da véspera — norma da série, registrada no `CLAUDE.md`.
 */
export const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Duplicados / colhidos acima disto avisa. */
export const MAX_DUPLICATE_RATE = 0.6;

/**
 * Deriva de categoria: distância de variação total entre a distribuição do
 * dia e a média da janela — `0,5 × Σ|p − q|`, que vai de 0 (idêntica) a 1
 * (nenhuma categoria em comum). Acima disto avisa. É estatística normalizada,
 * então não apodrece com o acervo crescendo; o que a calibra é o ensaio.
 *
 * **Calibrado contra produção em 24/09/2026** (Fase 12, A7.04 — o
 * `gates:rehearse` sobre um branch do Neon, 155 dias com linha de base). Até
 * ali era 0,5, calibrado por cima: o banco local não tem série real. A
 * distribuição tem **dois regimes**: 16–21/08, a transição do classificador
 * de categoria, com deriva de 0,828 a 0,184; e desde 26/08, o regime
 * estável, com **máximo 0,177 e p95 0,101**. O p95 do conjunto (0,172) caía
 * no meio do regime estável e faria um dia normal como 02/09 (0,177) sair
 * `SUCCESS_DEGRADED`; 0,25 fica acima de todo dia estável com folga e abaixo
 * de quatro dos seis dias da transição — que é o que o aviso existe para
 * pegar: uma mudança de classificador ou de fontes. **O número é para
 * ajustar**: o `gates:rehearse` imprime o p95, e o gatilho do §16 ("mais de
 * um dia por semana") diz quando.
 */
export const MAX_CATEGORY_DRIFT = 0.25;

/** Uma linha de `DailyMetric` da janela — o que a linha de base lê. */
export interface BaselineDay {
  date: Date;
  newsCollected: number;
  newsByCategory: Record<string, number>;
  articleGenerated: boolean;
}

export interface EntryGateInput {
  /** A colheita deduplicada — é o "colhido" da mediana (`DailyMetric.newsCollected` é o mesmo número). */
  deduplicated: RawNewsItem[];
  /** Quantos chegaram antes da deduplicação, para a taxa de duplicata. */
  collected: number;
  /** A seleção da etapa 5. */
  selected: RawNewsItem[];
  /** Refaz a seleção mais larga — quem sabe selecionar é o pipeline. */
  widen: () => RawNewsItem[];
  /** Os dias anteriores da janela, na ordem que vier. */
  baseline: BaselineDay[];
  now: Date;
}

export interface EntryGateFinding {
  check: EntryGateCheck;
  detail: string;
}

export interface EntryGateMeasures {
  volume: number;
  /** Dias com briefing na janela — os que contam para a mediana. */
  baselineDays: number;
  /** `null` quando a linha de base é insuficiente. */
  median: number | null;
  /** `volume / median`, `null` sem linha de base. */
  volumeRatio: number | null;
  sources: number;
  widened: boolean;
  /** Horas desde o item mais recente. */
  freshestAgeHours: number;
  duplicateRate: number;
  /** `null` sem linha de base. */
  categoryDrift: number | null;
}

export interface EntryGateVerdict {
  /** O primeiro bloqueio, na ordem da tabela da §13.1: volume, diversidade, frescor. `null` é aprovado. */
  block: EntryGateFinding | null;
  warnings: EntryGateFinding[];
  /** A seleção que segue para a IA — alargada quando a diversidade pediu. */
  selected: RawNewsItem[];
  /** `insufficient` é o portão de volume dizendo que não opinou. */
  baseline: 'ok' | 'insufficient';
  measures: EntryGateMeasures;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
    : (sorted[mid] as number);
}

function distinctSources(items: RawNewsItem[]): number {
  return new Set(items.map((item) => item.source)).size;
}

function normalize(counts: Record<string, number>): Map<string, number> {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const shares = new Map<string, number>();
  if (total === 0) return shares;
  for (const [category, n] of Object.entries(counts)) shares.set(category, n / total);
  return shares;
}

/**
 * Distância de variação total entre a distribuição do dia e a **média** da
 * janela (a soma das contagens de todos os dias, normalizada — um dia grande
 * pesa mais, que é o certo para "o que é normal").
 */
export function categoryDrift(today: Record<string, number>, baseline: BaselineDay[]): number | null {
  if (baseline.length === 0) return null;
  const summed: Record<string, number> = {};
  for (const day of baseline) {
    for (const [category, n] of Object.entries(day.newsByCategory)) {
      summed[category] = (summed[category] ?? 0) + n;
    }
  }
  const p = normalize(today);
  const q = normalize(summed);
  if (p.size === 0 || q.size === 0) return null;

  let distance = 0;
  for (const category of new Set([...p.keys(), ...q.keys()])) {
    distance += Math.abs((p.get(category) ?? 0) - (q.get(category) ?? 0));
  }
  return Number((distance / 2).toFixed(3));
}

function countByCategory(items: RawNewsItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.category] = (counts[item.category] ?? 0) + 1;
  return counts;
}

/**
 * O portão de entrada, avaliado inteiro: **todo check é medido**, mesmo depois
 * de um bloqueio, porque o evento da etapa registra o retrato completo do dia
 * e não só o primeiro motivo. O que bloqueia é o primeiro da ordem da tabela.
 */
export function evaluateEntryGate(input: EntryGateInput): EntryGateVerdict {
  const blocks: EntryGateFinding[] = [];
  const warnings: EntryGateFinding[] = [];

  // Volume, contra a mediana dos dias com briefing na janela.
  const successful = input.baseline.filter((day) => day.articleGenerated);
  const volume = input.deduplicated.length;
  const baselineOk = successful.length >= MIN_BASELINE_DAYS;
  const volumeMedian = baselineOk ? median(successful.map((day) => day.newsCollected)) : null;
  const volumeRatio =
    volumeMedian !== null && volumeMedian > 0 ? Number((volume / volumeMedian).toFixed(3)) : null;
  if (volumeMedian !== null && volume < MIN_VOLUME_RATIO * volumeMedian) {
    blocks.push({
      check: 'volume',
      detail: `${volume} < ${Math.round(MIN_VOLUME_RATIO * 100)}% of median ${volumeMedian} over ${successful.length} days`,
    });
  }

  // Diversidade, alargando uma vez antes de desistir.
  let selected = input.selected;
  let widened = false;
  let sources = distinctSources(selected);
  if (sources < MIN_DISTINCT_SOURCES) {
    const wider = input.widen();
    widened = true;
    sources = distinctSources(wider);
    if (sources >= MIN_DISTINCT_SOURCES) {
      selected = wider;
    } else {
      blocks.push({
        check: 'diversity',
        detail: `${sources} distinct sources < ${MIN_DISTINCT_SOURCES}, even among ${wider.length}`,
      });
    }
  }

  // Frescor: pelo menos um selecionado nas últimas 24 h.
  const freshest = selected.reduce(
    (latest, item) => Math.max(latest, item.publishedAt.getTime()),
    Number.NEGATIVE_INFINITY,
  );
  const freshestAgeHours =
    Number.isFinite(freshest) ? Number(((input.now.getTime() - freshest) / 3_600_000).toFixed(1)) : Infinity;
  if (!(input.now.getTime() - freshest <= FRESHNESS_WINDOW_MS)) {
    blocks.push({
      check: 'freshness',
      detail: `newest selected item is ${Number.isFinite(freshestAgeHours) ? `${freshestAgeHours} h` : 'undated'} old, window is 24 h`,
    });
  }

  // Taxa de duplicata — avisa.
  const duplicateRate =
    input.collected > 0 ? Number(((input.collected - volume) / input.collected).toFixed(3)) : 0;
  if (duplicateRate > MAX_DUPLICATE_RATE) {
    warnings.push({
      check: 'duplicate-rate',
      detail: `${Math.round(duplicateRate * 100)}% of ${input.collected} collected were duplicates`,
    });
  }

  // Deriva de categoria — avisa, e só com linha de base.
  const drift = baselineOk ? categoryDrift(countByCategory(input.deduplicated), successful) : null;
  if (drift !== null && drift > MAX_CATEGORY_DRIFT) {
    warnings.push({
      check: 'category-drift',
      detail: `distribution moved ${drift} (total variation) from the ${successful.length}-day mean`,
    });
  }

  return {
    block: blocks[0] ?? null,
    warnings,
    selected,
    baseline: baselineOk ? 'ok' : 'insufficient',
    measures: {
      volume,
      baselineDays: successful.length,
      median: volumeMedian,
      volumeRatio,
      sources,
      widened,
      freshestAgeHours,
      duplicateRate,
      categoryDrift: drift,
    },
  };
}

/**
 * Os dias **anteriores** a `today` na janela — `DailyMetric` é escrita na
 * etapa 9, então a linha de hoje ainda não existe quando a 5.5 roda. Uma
 * consulta, sete linhas no máximo, sobre o índice de `date`.
 *
 * `newsCollected` é o deduplicado (a etapa 3 grava `deduplicated.length`), e é
 * por isso que o volume do dia comparado com ele é `deduplicated.length`
 * também: a mediana e o dia medem a mesma coisa.
 */
export async function loadEntryBaseline(today: Date): Promise<BaselineDay[]> {
  const since = new Date(today);
  since.setUTCDate(since.getUTCDate() - ENTRY_BASELINE_DAYS);

  const rows = await prisma.dailyMetric.findMany({
    where: { date: { gte: since, lt: today } },
    select: { date: true, newsCollected: true, newsByCategory: true, articleGenerated: true },
    orderBy: { date: 'asc' },
  });

  return rows.map((row) => ({
    date: row.date,
    newsCollected: row.newsCollected,
    newsByCategory: (row.newsByCategory ?? {}) as Record<string, number>,
    articleGenerated: row.articleGenerated,
  }));
}
