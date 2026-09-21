/**
 * Ensaia os dois portões da Fase 9 contra o que já está gravado — **antes de
 * confiar neles** (armadilha 18 do plano de observabilidade).
 *
 * **Por que isto é um comando no repositório, e não um teste.** A suíte roda
 * sem banco de propósito. Mas a lição da higiene de texto da Fase 12 é que um
 * teste sobre caso inventado passa nas duas versões de uma regra — a primeira
 * versão daquela correção descartaria 5.635 corpos e estava verde —, e só o
 * ensaio contra o dado real pega. A primeira medição de um portão viveria num
 * arquivo temporário e sumiria com a sessão; e o §16 tem um gatilho ("portão
 * de entrada sensível demais: mais de um bloqueio por semana sem que a
 * colheita estivesse ruim — recalibrar a mediana") que exige poder medir de
 * novo. Mesmo padrão do `measure-archive-hygiene.mjs`.
 *
 * ## O que ele mede
 *
 * **Portão de saída (6.5)**, sobre todo `Article` retido: cada check com
 * quantos briefings bloquearia ou avisaria, e a distribuição do que as réguas
 * leem — caracteres do corpo (o teto é p95 × 2) e razão de português (o piso
 * fica bem abaixo do mínimo). O material que foi ao modelo não é retido, então
 * **toda URL na saída é tratada como não ancorada** — é o pior caso, e se ele
 * bloquear zero, a forma real também bloqueia zero.
 *
 * **Portão de entrada (5.5)**, sobre `DailyMetric` e `BriefingSource`: para
 * cada dia com linha, a razão `newsCollected / mediana dos sete anteriores` e
 * a deriva de categoria contra a janela (as duas com a mesma regra do
 * pipeline); e a diversidade — quantas fontes distintas cada briefing de fato
 * levou ao modelo (a `BriefingSource` guarda a `source` de cada selecionado).
 * O frescor só é ensaiável enquanto a `News` citada existe (30 dias): é a
 * idade do item mais recente contra o `generatedAt` do briefing.
 *
 * **Se algum retido reprovaria, o errado é o portão** — e o script sai com 1.
 *
 * ## Uso
 *
 *     pnpm --filter @newranews/api gates:rehearse
 *
 * Lê o `DATABASE_URL` do ambiente (o `.env` da API, via `dotenv/config`).
 * Contra produção, exportar o `DATABASE_URL` do Neon numa sessão só — o
 * script só lê. `LIMIT` restringe o número de briefings (o padrão é todos).
 */
// O `DATABASE_URL` vem do `.env` da API. O `config/env.ts` (que carrega o
// dotenv) não está no grafo deste script de propósito: ele valida o ambiente
// inteiro e termina em `process.exit(1)` se faltar uma chave de provider que o
// ensaio não usa.
import 'dotenv/config';
import { prisma } from '@newranews/database';
import {
  MAX_ARTICLE_CONTENT_LENGTH,
  MIN_PT_STOPWORD_RATIO,
  OUTPUT_GUARD_CHECKS,
  guardArticleOutput,
  type OutputGuardCheck,
} from '../src/providers/ai/output-guard';
import {
  ENTRY_BASELINE_DAYS,
  FRESHNESS_WINDOW_MS,
  MAX_CATEGORY_DRIFT,
  MIN_BASELINE_DAYS,
  MIN_DISTINCT_SOURCES,
  MIN_VOLUME_RATIO,
  categoryDrift,
  type BaselineDay,
} from '../src/services/pipeline-gates.service';

const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : undefined;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index] as number;
}

function distribution(values: number[], digits = 0): string {
  const sorted = [...values].sort((a, b) => a - b);
  const f = (n: number): string => n.toFixed(digits);
  return `min ${f(sorted[0] ?? NaN)} · p50 ${f(quantile(sorted, 0.5))} · p95 ${f(quantile(sorted, 0.95))} · max ${f(sorted[sorted.length - 1] ?? NaN)}`;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
    : (sorted[mid] as number);
}

const day = (date: Date): string => date.toISOString().slice(0, 10);

async function rehearseOutputGuard(): Promise<number> {
  const articles = await prisma.article.findMany({
    orderBy: { date: 'desc' },
    select: { date: true, title: true, summary: true, content: true },
    ...(LIMIT ? { take: LIMIT } : {}),
  });

  console.log(`\n== Portão de saída (6.5) — ${articles.length} briefings retidos ==`);
  if (articles.length === 0) {
    console.log('nenhum briefing no banco; nada a ensaiar');
    return 0;
  }

  const blocks = new Map<OutputGuardCheck, string[]>();
  const warnings = new Map<OutputGuardCheck, string[]>();
  const chars: number[] = [];
  const ratios: number[] = [];

  for (const article of articles) {
    // Material vazio: toda URL é "não ancorada" — o pior caso.
    const verdict = guardArticleOutput(article, '');
    chars.push(verdict.measures.chars);
    ratios.push(verdict.measures.ptRatio);
    for (const block of verdict.blocks) {
      blocks.set(block.check, [...(blocks.get(block.check) ?? []), `${day(article.date)} (${block.detail})`]);
    }
    for (const warning of verdict.warnings) {
      warnings.set(warning.check, [...(warnings.get(warning.check) ?? []), `${day(article.date)} (${warning.detail})`]);
    }
  }

  const sortedChars = [...chars].sort((a, b) => a - b);
  console.log(`corpo (chars):        ${distribution(chars)}   · teto atual ${MAX_ARTICLE_CONTENT_LENGTH} · p95 × 2 = ${quantile(sortedChars, 0.95) * 2}`);
  console.log(`razão de português:   ${distribution(ratios, 3)}   · piso atual ${MIN_PT_STOPWORD_RATIO}`);

  let blocked = 0;
  for (const check of OUTPUT_GUARD_CHECKS) {
    const b = blocks.get(check) ?? [];
    const w = warnings.get(check) ?? [];
    const line = `${check.padEnd(18)} bloquearia ${String(b.length).padStart(3)}   avisaria ${String(w.length).padStart(3)}`;
    console.log(line);
    for (const hit of [...b, ...w].slice(0, 5)) console.log(`    ${hit}`);
    blocked += b.length;
  }
  return blocked;
}

async function rehearseEntryGate(): Promise<number> {
  const rows = await prisma.dailyMetric.findMany({
    orderBy: { date: 'asc' },
    select: { date: true, newsCollected: true, newsByCategory: true, articleGenerated: true },
  });
  const days: BaselineDay[] = rows.map((row) => ({
    date: row.date,
    newsCollected: row.newsCollected,
    newsByCategory: (row.newsByCategory ?? {}) as Record<string, number>,
    articleGenerated: row.articleGenerated,
  }));

  console.log(`\n== Portão de entrada (5.5) — ${days.length} dias com DailyMetric ==`);

  const ratios: number[] = [];
  const drifts: number[] = [];
  const volumeBlocks: string[] = [];
  const driftWarnings: string[] = [];
  let withoutBaseline = 0;

  for (const today of days) {
    const since = new Date(today.date);
    since.setUTCDate(since.getUTCDate() - ENTRY_BASELINE_DAYS);
    const baseline = days.filter(
      (d) => d.articleGenerated && d.date.getTime() >= since.getTime() && d.date.getTime() < today.date.getTime(),
    );
    if (baseline.length < MIN_BASELINE_DAYS) {
      withoutBaseline += 1;
      continue;
    }
    const m = median(baseline.map((d) => d.newsCollected));
    const ratio = m > 0 ? today.newsCollected / m : NaN;
    if (Number.isFinite(ratio)) ratios.push(ratio);
    if (today.newsCollected < MIN_VOLUME_RATIO * m) {
      volumeBlocks.push(`${day(today.date)} (${today.newsCollected} vs mediana ${m}, ${baseline.length} dias)`);
    }
    const drift = categoryDrift(today.newsByCategory, baseline);
    if (drift !== null) {
      drifts.push(drift);
      if (drift > MAX_CATEGORY_DRIFT) driftWarnings.push(`${day(today.date)} (${drift})`);
    }
  }

  console.log(`dias sem linha de base (< ${MIN_BASELINE_DAYS} com briefing na janela): ${withoutBaseline}`);
  if (ratios.length > 0) {
    console.log(`volume / mediana:     ${distribution(ratios, 2)}   · piso atual ${MIN_VOLUME_RATIO}`);
    console.log(`deriva de categoria:  ${distribution(drifts, 3)}   · teto atual ${MAX_CATEGORY_DRIFT}`);
  }
  console.log(`volume             bloquearia ${String(volumeBlocks.length).padStart(3)}`);
  for (const hit of volumeBlocks.slice(0, 10)) console.log(`    ${hit}`);
  console.log(`category-drift     avisaria   ${String(driftWarnings.length).padStart(3)}`);
  for (const hit of driftWarnings.slice(0, 10)) console.log(`    ${hit}`);

  // Diversidade e frescor, pelo que cada briefing de fato levou ao modelo.
  const briefings = await prisma.article.findMany({
    orderBy: { date: 'desc' },
    select: {
      date: true,
      generatedAt: true,
      sources: { select: { source: true, newsId: true } },
    },
    ...(LIMIT ? { take: LIMIT } : {}),
  });
  const withSources = briefings.filter((b) => b.sources.length > 0);
  const diversityBlocks = withSources
    .filter((b) => new Set(b.sources.map((s) => s.source)).size < MIN_DISTINCT_SOURCES)
    .map((b) => `${day(b.date)} (${new Set(b.sources.map((s) => s.source)).size} fontes em ${b.sources.length})`);
  const distinct = withSources.map((b) => new Set(b.sources.map((s) => s.source)).size);
  console.log(`\nfontes distintas por briefing (${withSources.length} com BriefingSource): ${distribution(distinct)}   · piso ${MIN_DISTINCT_SOURCES}`);
  console.log(`diversity          bloquearia ${String(diversityBlocks.length).padStart(3)}   (sem alargar — o ensaio só vê os que foram)`);
  for (const hit of diversityBlocks.slice(0, 10)) console.log(`    ${hit}`);

  // Frescor: só onde a News citada ainda existe.
  const newsIds = withSources.flatMap((b) => b.sources.map((s) => s.newsId)).filter((id): id is string => id !== null);
  const news = newsIds.length > 0
    ? await prisma.news.findMany({ where: { id: { in: newsIds } }, select: { id: true, publishedAt: true } })
    : [];
  const publishedById = new Map(news.map((n) => [n.id, n.publishedAt.getTime()]));
  const freshnessBlocks: string[] = [];
  let freshnessMeasured = 0;
  const ages: number[] = [];
  for (const b of withSources) {
    const times = b.sources.map((s) => (s.newsId ? publishedById.get(s.newsId) : undefined)).filter((t): t is number => t !== undefined);
    if (times.length === 0 || b.generatedAt === null) continue;
    freshnessMeasured += 1;
    const age = b.generatedAt.getTime() - Math.max(...times);
    ages.push(age / 3_600_000);
    if (age > FRESHNESS_WINDOW_MS) freshnessBlocks.push(`${day(b.date)} (mais recente há ${(age / 3_600_000).toFixed(1)} h)`);
  }
  console.log(`\nidade do item mais recente (h), ${freshnessMeasured} briefings com News ainda gravada: ${ages.length ? distribution(ages, 1) : '—'}   · janela 24 h`);
  console.log(`freshness          bloquearia ${String(freshnessBlocks.length).padStart(3)}`);
  for (const hit of freshnessBlocks.slice(0, 10)) console.log(`    ${hit}`);

  return volumeBlocks.length + diversityBlocks.length + freshnessBlocks.length;
}

async function main(): Promise<void> {
  const exitBlocked = await rehearseOutputGuard();
  const entryBlocked = await rehearseEntryGate();
  const total = exitBlocked + entryBlocked;
  console.log(
    total === 0
      ? '\nNenhum retido reprovaria. Os portões estão calibrados contra este banco.'
      : `\n${total} reprovação(ões) sobre dado que foi ao ar: o errado é o portão, não o acervo.`,
  );
  process.exitCode = total === 0 ? 0 : 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
