import { Category } from '@newranews/database';
import { rssSources } from '../config/rss-sources';
import { fetchFromNewsData } from '../providers/news/newsdata.provider';
import { fetchFromRss } from '../providers/news/rss.provider';
import type { RawNewsItem } from '../providers/types';

const ALL_CATEGORIES = Object.values(Category) as Category[];

/**
 * O que pode dar errado na etapa 1 sem derrubá-la.
 *
 * `provider-failed` é a exceção que subiu; `provider-empty` é o modo pior,
 * porque um provider que devolve lista vazia **sem lançar** é
 * indistinguível de um dia sem notícia. `feed-empty` é um feed RSS
 * configurado que não rendeu item nenhum.
 */
export type FetchWarningKind = 'provider-failed' | 'provider-empty' | 'feed-empty';

export interface FetchWarning {
  kind: FetchWarningKind;
  /** `newsdata` ou `rss` no nível de provider; o nome do feed em `feed-empty`. */
  source: string;
  detail?: string;
}

export interface FetchResult {
  newsDataItems: RawNewsItem[];
  rssItems: RawNewsItem[];
  allItems: RawNewsItem[];
  warnings: FetchWarning[];
}

/**
 * **A colheita degradada deixa de sair só no stdout.**
 *
 * `Promise.allSettled` continua certo — um provider fora do ar não pode
 * derrubar o dia —, mas até aqui a rejeição virava um `console.warn` no log do
 * Render e o run seguia para `SUCCESS` idêntico a um dia bom. As `warnings`
 * são o mesmo aviso em forma que a etapa 1 consegue gravar no `PipelineEvent`
 * e contar em `DailyMetric.pipelineErrors`; ver `runPipeline`.
 */
export async function fetchAll(): Promise<FetchResult> {
  const warnings: FetchWarning[] = [];

  const [newsDataResult, rssResult] = await Promise.allSettled([
    fetchFromNewsData(ALL_CATEGORIES),
    fetchFromRss(),
  ]);

  const newsDataItems = collect('newsdata', newsDataResult, warnings);
  const rssItems = collect('rss', rssResult, warnings);

  // **Um aviso por feed configurado que não rendeu nada.** A lista sai da
  // própria `rssSources` — comparar contra o conjunto de nomes presentes é o
  // único jeito de ver a fonte que sumiu, porque quem não devolve item não
  // aparece em lugar nenhum do resultado. Foi assim que a `Reuters` ficou na
  // lista com zero itens até 24/08/2026.
  //
  // **Não conta como erro do run** (ver `runPipeline`): os feeds
  // especializados publicam devagar e ficam legitimamente vazios em dias
  // comuns. Marcar isso como erro faria todo dia acender a luz, e luz que
  // acende todo dia é luz que se aprende a ignorar.
  if (rssResult.status === 'fulfilled' && rssItems.length > 0) {
    const present = new Set(rssItems.map((item) => item.source));
    for (const source of rssSources) {
      if (!present.has(source.name)) {
        console.warn(`[pipeline] rss: feed "${source.name}" rendeu zero itens`);
        warnings.push({ kind: 'feed-empty', source: source.name });
      }
    }
  }

  return { newsDataItems, rssItems, allItems: [...newsDataItems, ...rssItems], warnings };
}

function collect(
  provider: 'newsdata' | 'rss',
  result: PromiseSettledResult<RawNewsItem[]>,
  warnings: FetchWarning[],
): RawNewsItem[] {
  if (result.status === 'rejected') {
    console.warn(`[pipeline] ${provider} fetch failed:`, result.reason);
    warnings.push({
      kind: 'provider-failed',
      source: provider,
      detail: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
    return [];
  }

  if (result.value.length === 0) {
    console.warn(`[pipeline] ${provider}: zero itens`);
    warnings.push({ kind: 'provider-empty', source: provider });
  }

  return result.value;
}
