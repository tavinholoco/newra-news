import { Category } from '@newranews/database';
import { rssSources } from '../config/rss-sources';
import { fetchFromNewsData } from '../providers/news/newsdata.provider';
import { fetchFromRssWithFailures } from '../providers/news/rss.provider';
import type { RawNewsItem } from '../providers/types';
import { baseLogger } from '../utils/logger';

const ALL_CATEGORIES = Object.values(Category) as Category[];

/**
 * O que pode dar errado na etapa 1 sem derrubá-la.
 *
 * `provider-failed` é a exceção que subiu no provider inteiro; `provider-empty`
 * é o modo pior, porque devolver lista vazia **sem lançar** é indistinguível de
 * um dia sem notícia. Os dois `feed-*` são o mesmo par, no nível de **um** feed
 * RSS: `feed-failed` é a exceção que aquele feed lançou — timeout, DNS, XML
 * inválido — e **conta** como erro do run; `feed-empty` é o feed que respondeu
 * e não tinha nada, o normal de uma fonte especializada em dia comum, e **não
 * conta** (ver `runPipeline`).
 *
 * **A distinção `feed-failed`/`feed-empty` nasceu em 03/09/2026.**
 * Superinteressante, Veja Saúde e Drauzio Varella estavam em `ETIMEDOUT` havia
 * dois dias e saíam como `feed-empty` — a mesma classe de "publicou devagar" —
 * porque o `Promise.allSettled` interno do RSS provider já tinha engolido a
 * rejeição antes de esta função decidir a classificação. Ver
 * `fetchFromRssWithFailures`.
 */
export type FetchWarningKind = 'provider-failed' | 'provider-empty' | 'feed-failed' | 'feed-empty';

export interface FetchWarning {
  kind: FetchWarningKind;
  /** `newsdata` ou `rss` no nível de provider; o nome do feed em `feed-failed`/`feed-empty`. */
  source: string;
  /** A mensagem da exceção — presente em `provider-failed` e `feed-failed`. */
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
    fetchFromRssWithFailures(),
  ]);

  const newsDataItems = collect('newsdata', newsDataResult, warnings);

  let rssItems: RawNewsItem[] = [];

  if (rssResult.status === 'rejected') {
    // O outer `allSettled` só rejeita se algo estourar antes do
    // `Promise.allSettled` interno do provider — na prática não acontece,
    // porque `fetchFromRssWithFailures` engole toda rejeição por feed. Fica
    // por simetria com o `newsdata`, cujo provider pode mesmo lançar cedo
    // (ex.: `NEWSDATA_API_KEY` ausente).
    baseLogger.warn({ err: rssResult.reason }, '[pipeline] rss fetch failed');
    warnings.push({
      kind: 'provider-failed',
      source: 'rss',
      detail: rssResult.reason instanceof Error ? rssResult.reason.message : String(rssResult.reason),
    });
  } else {
    const { items, failures } = rssResult.value;
    rssItems = items;

    // **A fonte que lançou é erro de verdade, e cada uma vira uma linha.**
    // Timeout, DNS, XML inválido — o feed não conseguiu responder, o que é bem
    // diferente de responder e não ter nada. Ver o cabeçalho de
    // `FetchWarningKind` para o episódio que expôs a lacuna.
    for (const failure of failures) {
      warnings.push({ kind: 'feed-failed', source: failure.source, detail: failure.detail });
    }

    // **Um aviso por feed configurado que respondeu e não tinha nada.** A
    // lista sai da própria `rssSources` — comparar contra os nomes presentes
    // (nos itens **e** nas falhas) é o único jeito de ver a fonte que sumiu,
    // porque quem não devolve item não aparece em lugar nenhum do resultado.
    // Foi assim que a `Reuters` ficou na lista com zero itens até 24/08/2026.
    //
    // **Não conta como erro do run** (ver `runPipeline`): fonte especializada
    // fica legitimamente vazia em dia comum. Marcar isso como erro faria todo
    // dia acender a luz, e luz que acende todo dia é luz que se aprende a
    // ignorar.
    if (items.length > 0 || failures.length > 0) {
      const accountedFor = new Set([
        ...items.map((item) => item.source),
        ...failures.map((failure) => failure.source),
      ]);
      for (const source of rssSources) {
        if (accountedFor.has(source.name)) continue;
        baseLogger.warn({ feed: source.name }, '[pipeline] rss: feed rendeu zero itens');
        warnings.push({ kind: 'feed-empty', source: source.name });
      }
    } else {
      // As doze responderam, nenhuma lançou, e nenhuma trouxe item — o caso
      // que a análise por feed não cobre sozinha (comparar contra
      // `rssSources` já cobriria isto com doze `feed-empty` idênticos, e a
      // repetição afogaria o que de fato aconteceu: o provider inteiro veio
      // mudo no mesmo instante, um padrão que pede suspeita sobre a coleta
      // como um todo, não sobre cada fonte).
      baseLogger.warn({ provider: 'rss' }, '[pipeline] provider rendeu zero itens');
      warnings.push({ kind: 'provider-empty', source: 'rss' });
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
    baseLogger.warn({ provider, err: result.reason }, '[pipeline] provider fetch failed');
    warnings.push({
      kind: 'provider-failed',
      source: provider,
      detail: result.reason instanceof Error ? result.reason.message : String(result.reason),
    });
    return [];
  }

  if (result.value.length === 0) {
    baseLogger.warn({ provider }, '[pipeline] provider rendeu zero itens');
    warnings.push({ kind: 'provider-empty', source: provider });
  }

  return result.value;
}
