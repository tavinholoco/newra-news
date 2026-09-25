import { Category } from '@newranews/database';
import { rssSources } from '../config/rss-sources';
import { fetchFromNewsData } from '../providers/news/newsdata.provider';
import { fetchFromRssWithOutcomes, type RssFeedOutcome } from '../providers/news/rss.provider';
import type { RawNewsItem } from '../providers/types';
import { baseLogger } from '../utils/logger';

const ALL_CATEGORIES = Object.values(Category) as Category[];

/**
 * O nome do balde do agregador em `SourceFetch.source`, em `FetchWarning.source`
 * e na `SourceHealth`. A NewsData entra como **uma** fonte e agrega dezenas de
 * veículos — o limite honesto da §15 do plano de observabilidade; o
 * `RawNewsItem.source` dela é o nome do veículo, e é por isso que a
 * atribuição por fonte não pode ler aquele campo (ver `countKeptBySource`).
 */
export const NEWSDATA_SOURCE = 'newsdata';

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
 * `fetchFromRssWithOutcomes`.
 *
 * **Tuple, e não só tipo**, desde a Fase 11: cada classe mapeia para um
 * `SourceOutcome` da `SourceHealth`, e a guarda (`source-health.test.ts`)
 * enumera as classes em tempo de execução para cobrar a tabela nos dois
 * sentidos — o idioma do `AUDIT_ACTIONS`.
 */
export const FETCH_WARNING_KINDS = [
  'provider-failed',
  'provider-empty',
  'feed-failed',
  'feed-empty',
] as const;

export type FetchWarningKind = (typeof FETCH_WARNING_KINDS)[number];

export interface FetchWarning {
  kind: FetchWarningKind;
  /** `newsdata` ou `rss` no nível de provider; o nome do feed em `feed-failed`/`feed-empty`. */
  source: string;
  /** A mensagem da exceção — presente em `provider-failed` e `feed-failed`. */
  detail?: string;
}

/** Espelho de `SourceKind` do schema, sem importar o enum para dentro da coleta. */
export type SourceFetchKind = 'RSS' | 'AGGREGATOR';

/**
 * O que **uma fonte configurada** rendeu neste run — uma entrada por fonte,
 * sempre: cada feed de `rss-sources.ts` mais o balde `newsdata`. (Fase 11
 * do plano de observabilidade)
 *
 * É o dado bruto de que `warnings` é derivado e de que a `SourceHealth` é
 * escrita. Fonte que não está aqui não foi tentada — e não há valor para isso
 * de propósito: "não tentada" é ausência, como o `NEVER_RAN` do run.
 */
export interface SourceFetch {
  source: string;
  kind: SourceFetchKind;
  /** Itens depois do filtro do provider. Zero quando falhou. */
  fetched: number;
  /** Do `fetch` ao parse; para o agregador, o provider inteiro (oito categorias em paralelo). */
  latencyMs: number;
  /** A mensagem da exceção, quando a fonte — ou o provider por cima dela — lançou. */
  failure?: string;
}

export interface FetchResult {
  newsDataItems: RawNewsItem[];
  rssItems: RawNewsItem[];
  allItems: RawNewsItem[];
  warnings: FetchWarning[];
  /** Ver `SourceFetch`. */
  sources: SourceFetch[];
}

/**
 * **A colheita degradada deixa de sair só no stdout.**
 *
 * `Promise.allSettled` continua certo — um provider fora do ar não pode
 * derrubar o dia —, mas até aqui a rejeição virava um `console.warn` no log do
 * Render e o run seguia para `SUCCESS` idêntico a um dia bom. As `warnings`
 * são o mesmo aviso em forma que a etapa 1 consegue gravar no `PipelineEvent`
 * e contar em `DailyMetric.pipelineErrors`; ver `runPipeline`.
 *
 * **Desde a Fase 11 os avisos são derivados de `sources`**, e não o contrário:
 * o provider de RSS devolve um desfecho por feed configurado, então o feed
 * vazio deixou de ser descoberto por subtração ("quem não está nos itens nem
 * nas falhas") e passou a ser lido — `fetched: 0` sem `failure`.
 */
export async function fetchAll(): Promise<FetchResult> {
  const [newsData, rss] = await Promise.all([
    timedSettled(() => fetchFromNewsData(ALL_CATEGORIES)),
    timedSettled(() => fetchFromRssWithOutcomes()),
  ]);

  const sources: SourceFetch[] = [];
  const warnings: FetchWarning[] = [];

  // ── NewsData: um balde, um desfecho ────────────────────────────────────
  let newsDataItems: RawNewsItem[] = [];
  if (newsData.result.status === 'rejected') {
    const failure = reasonOf(newsData.result.reason);
    baseLogger.warn(
      { provider: NEWSDATA_SOURCE, err: newsData.result.reason },
      '[pipeline] provider fetch failed',
    );
    warnings.push({ kind: 'provider-failed', source: NEWSDATA_SOURCE, detail: failure });
    sources.push({
      source: NEWSDATA_SOURCE,
      kind: 'AGGREGATOR',
      fetched: 0,
      latencyMs: newsData.latencyMs,
      failure,
    });
  } else {
    newsDataItems = newsData.result.value;
    if (newsDataItems.length === 0) {
      baseLogger.warn({ provider: NEWSDATA_SOURCE }, '[pipeline] provider rendeu zero itens');
      warnings.push({ kind: 'provider-empty', source: NEWSDATA_SOURCE });
    }
    sources.push({
      source: NEWSDATA_SOURCE,
      kind: 'AGGREGATOR',
      fetched: newsDataItems.length,
      latencyMs: newsData.latencyMs,
    });
  }

  // ── RSS: um desfecho por feed ──────────────────────────────────────────────
  let rssItems: RawNewsItem[] = [];
  if (rss.result.status === 'rejected') {
    // O outer `allSettled` só rejeita se algo estourar antes do
    // `Promise.allSettled` interno do provider — na prática não acontece,
    // porque `fetchFromRssWithOutcomes` engole toda rejeição por feed. Fica
    // por simetria com o `newsdata`, cujo provider pode mesmo lançar cedo
    // (ex.: `NEWSDATA_API_KEY` ausente).
    //
    // **Cada feed configurado sai como falho, com a razão do provider**: o
    // provider caiu por cima deles, e uma fonte que não pôde ser tentada por
    // culpa nossa não é uma fonte que respondeu vazio. O aviso é um só, do
    // provider — repetir um `feed-failed` por feed afogaria a linha que diz o que
    // aconteceu.
    const failure = reasonOf(rss.result.reason);
    baseLogger.warn({ err: rss.result.reason }, '[pipeline] rss fetch failed');
    warnings.push({ kind: 'provider-failed', source: 'rss', detail: failure });
    for (const source of rssSources) {
      sources.push({
        source: source.name,
        kind: 'RSS',
        fetched: 0,
        latencyMs: rss.latencyMs,
        failure,
      });
    }
  } else {
    const { items, outcomes } = rss.result.value;
    rssItems = items;
    sources.push(...outcomes.map(toSourceFetch));

    const failed = outcomes.filter((outcome) => outcome.failure !== undefined);
    const empty = outcomes.filter((outcome) => outcome.failure === undefined && outcome.fetched === 0);

    // **A fonte que lançou é erro de verdade, e cada uma vira uma linha.**
    // Timeout, DNS, XML inválido — o feed não conseguiu responder, o que é bem
    // diferente de responder e não ter nada. Ver o cabeçalho de
    // `FetchWarningKind` para o episódio que expôs a lacuna.
    for (const outcome of failed) {
      warnings.push({ kind: 'feed-failed', source: outcome.source, detail: outcome.failure });
    }

    if (items.length > 0 || failed.length > 0) {
      // **Um aviso por feed configurado que respondeu e não tinha nada.** Foi
      // assim que a `Reuters` ficou na lista com zero itens até 24/08/2026 —
      // hoje o provider diz, e não é preciso deduzir por subtração.
      //
      // **Não conta como erro do run** (ver `runPipeline`): fonte especializada
      // fica legitimamente vazia em dia comum. Marcar isso como erro faria todo
      // dia acender a luz, e luz que acende todo dia é luz que se aprende a
      // ignorar.
      for (const outcome of empty) {
        baseLogger.warn({ feed: outcome.source }, '[pipeline] rss: feed rendeu zero itens');
        warnings.push({ kind: 'feed-empty', source: outcome.source });
      }
    } else {
      // Todas responderam, nenhuma lançou, e nenhuma trouxe item — o caso
      // que a análise por feed não cobre sozinha (um `feed-empty` idêntico por feed
      // afogariam o que de fato aconteceu: o provider inteiro veio mudo no
      // mesmo instante, um padrão que pede suspeita sobre a coleta como um
      // todo, não sobre cada fonte). Os desfechos por fonte continuam `EMPTY`
      // um a um — é o que a `SourceHealth` grava.
      baseLogger.warn({ provider: 'rss' }, '[pipeline] provider rendeu zero itens');
      warnings.push({ kind: 'provider-empty', source: 'rss' });
    }
  }

  return { newsDataItems, rssItems, allItems: [...newsDataItems, ...rssItems], warnings, sources };
}

function toSourceFetch(outcome: RssFeedOutcome): SourceFetch {
  return {
    source: outcome.source,
    kind: 'RSS',
    fetched: outcome.fetched,
    latencyMs: outcome.latencyMs,
    ...(outcome.failure !== undefined ? { failure: outcome.failure } : {}),
  };
}

function reasonOf(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

/**
 * `Promise.allSettled` de um só, com o relógio ao lado — o mesmo do provider
 * de RSS, aqui no nível de provider. Para a NewsData é o tempo das oito
 * categorias em paralelo, que é o que "a NewsData está lenta" significa.
 */
async function timedSettled<T>(
  run: () => Promise<T>,
): Promise<{ result: PromiseSettledResult<T>; latencyMs: number }> {
  const startedAt = Date.now();
  const [result] = await Promise.allSettled([run()]);
  return { result: result as PromiseSettledResult<T>, latencyMs: Date.now() - startedAt };
}
