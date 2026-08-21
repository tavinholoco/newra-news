import { prisma, type Category } from '@newranews/database';
import { rssSources } from '../config/rss-sources';
import { decodeEntities } from '../providers/ai/ai-utils';
import { sanitizeDescription, sanitizeTitle } from '../providers/news/feed-text';
import { classifyCategory } from './category-classifier.service';

/**
 * Reaplica as regras de ingestão às notícias **já gravadas**.
 *
 * Existe porque corrigir a ingestão só conserta o que entra daqui pra frente.
 * O acervo vive 30 dias antes do cleanup, então a Home continuaria mostrando
 * matéria policial dentro da seção "Tecnologia" por um mês depois do conserto —
 * e a Home da V2 agrupa por categoria, o que torna o erro visível na primeira
 * dobra.
 *
 * Faz as três coisas que a ingestão faz, e na mesma ordem, porque elas
 * dependem uma da outra: decodifica entidades, higieniza título e descrição, e
 * só então classifica. Reclassificar sobre a descrição suja daria um resultado
 * **diferente** do que a mesma matéria teria se entrasse hoje — que é
 * exatamente a divergência que este job existe para eliminar.
 */

/**
 * Só as fontes cuja categoria o classificador decidiu.
 *
 * Fonte com `category` fixa em `rss-sources.ts` (TechCrunch, InfoMoney, ESPN…)
 * teve a categoria escolhida pela configuração, não por palavra-chave —
 * recalcular ali destruiria um dado correto. Deriva da mesma lista que a
 * ingestão usa para não haver duas verdades.
 *
 * **Limitação conhecida:** o `source` de uma notícia do NewsData é o nome que a
 * API devolve para o veículo ("Terra", "Estadao Br"), e nada garante que ele
 * nunca coincida com um destes quatro. Uma coincidência faria o job recalcular
 * uma categoria que veio da API. É por isso que o `dryRun` é o padrão: a lista
 * de mudanças é para ser lida antes de ser aplicada.
 */
export const CLASSIFIER_OWNED_SOURCES: string[] = rssSources
  .filter((source) => !source.category)
  .map((source) => source.name);

export interface RenormalizeOptions {
  /** Padrão `true`: sem passar `false` explícito, nada é gravado. */
  dryRun?: boolean;
  /** Teto de linhas examinadas, das mais recentes para as mais antigas. */
  limit?: number;
  /** Sobrescreve o recorte de fontes. Vazio ou ausente usa o padrão. */
  sources?: string[];
}

export interface CategoryTransition {
  from: Category;
  to: Category;
  count: number;
}

export interface RenormalizeChange {
  id: string;
  title: string;
  from: Category;
  to: Category;
}

export interface RenormalizeReport {
  dryRun: boolean;
  scanned: number;
  /** Linhas cujo título, descrição ou fonte mudaram com a higiene. */
  textChanged: number;
  categoryChanged: number;
  transitions: CategoryTransition[];
  /** Amostra das reclassificações, para conferir antes de aplicar. */
  sample: RenormalizeChange[];
}

/** Quantas mudanças a resposta detalha. O resto vira contagem. */
const SAMPLE_SIZE = 25;

/** Linhas por transação. Uma transação com milhares de updates estoura o pool. */
const BATCH_SIZE = 100;

interface PendingUpdate {
  id: string;
  data: { title?: string; description?: string; source?: string; category?: Category };
}

export async function renormalizeStoredNews(
  options: RenormalizeOptions = {},
): Promise<RenormalizeReport> {
  const dryRun = options.dryRun ?? true;
  const sources =
    options.sources && options.sources.length > 0
      ? options.sources
      : CLASSIFIER_OWNED_SOURCES;

  const rows = await prisma.news.findMany({
    where: { source: { in: sources } },
    select: { id: true, title: true, description: true, source: true, category: true },
    orderBy: { publishedAt: 'desc' },
    ...(options.limit ? { take: options.limit } : {}),
  });

  const updates: PendingUpdate[] = [];
  const transitions = new Map<string, CategoryTransition>();
  const sample: RenormalizeChange[] = [];
  let textChanged = 0;
  let categoryChanged = 0;

  for (const row of rows) {
    const title = sanitizeTitle(decodeEntities(row.title));
    const description = sanitizeDescription(decodeEntities(row.description), title);
    // O `source` nunca passou por `decodeEntities` na ingestão do NewsData, e o
    // acervo tem "Jornal Do Com&eacute;rcio" para provar.
    const source = decodeEntities(row.source);
    const category = classifyCategory(title, description);

    const data: PendingUpdate['data'] = {};
    if (title !== row.title) data.title = title;
    if (description !== row.description) data.description = description;
    if (source !== row.source) data.source = source;
    if (category !== row.category) data.category = category;

    if (Object.keys(data).length === 0) continue;

    if (data.title || data.description || data.source) textChanged++;

    if (data.category) {
      categoryChanged++;
      const key = `${row.category}->${category}`;
      const seen = transitions.get(key);
      if (seen) {
        seen.count++;
      } else {
        transitions.set(key, { from: row.category, to: category, count: 1 });
      }
      if (sample.length < SAMPLE_SIZE) {
        sample.push({ id: row.id, title, from: row.category, to: category });
      }
    }

    updates.push({ id: row.id, data });
  }

  if (!dryRun) {
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map((update) =>
          prisma.news.update({ where: { id: update.id }, data: update.data }),
        ),
      );
    }
  }

  return {
    dryRun,
    scanned: rows.length,
    textChanged,
    categoryChanged,
    transitions: [...transitions.values()].sort((a, b) => b.count - a.count),
    sample,
  };
}
