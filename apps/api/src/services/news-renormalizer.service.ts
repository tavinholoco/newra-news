import { prisma, type Category } from '@newranews/database';
import { rssSources } from '../config/rss-sources';
import { decodeEntities } from '../providers/ai/ai-utils';
import {
  extractImageFromHtml,
  sanitizeContent,
  sanitizeDescription,
  sanitizeTitle,
  splitDekAndBody,
} from '../providers/news/feed-text';
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
 * Faz as mesmas coisas que a ingestão faz, e na mesma ordem, porque elas
 * dependem uma da outra: decodifica entidades, higieniza título, descrição e
 * corpo, e só então classifica. Reclassificar sobre a descrição suja daria um
 * resultado **diferente** do que a mesma matéria teria se entrasse hoje — que é
 * exatamente a divergência que este job existe para eliminar.
 *
 * **O corpo entrou na Fase 12, e com ele o recorte do job mudou.** Até aqui ele
 * varria só as fontes cuja categoria o classificador decide — o filtro existia
 * para proteger a categoria de quem tem rótulo fixo em `rss-sources.ts`. Mas o
 * HTML cru estava em toda parte, e concentrado justamente nas fontes de
 * categoria fixa: **InfoMoney, Olhar Digital e Drauzio Varella com 100% do
 * corpo em HTML**, a ESPN com a palavra `null` em 158 itens. Varrer só as
 * quatro genéricas deixaria de fora quase todo o defeito.
 *
 * Então o recorte deixou de ser um só: **a higiene de texto passa em todas as
 * linhas; a reclassificação continua restrita às fontes do classificador.** É
 * a mesma decisão de antes, aplicada ao campo certo — o argumento do filtro
 * sempre foi sobre categoria, nunca sobre texto.
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

/**
 * Que mudanças de categoria o job aplica.
 *
 * - `clear-only` — **padrão** — só as que **removem** um rótulo, isto é, as que
 *   levam a matéria para `WORLD`. É a operação segura: tirar um rótulo que a
 *   evidência não sustenta.
 * - `all` — aplica também as promoções (`WORLD` → rótulo) e as trocas entre
 *   rótulos.
 *
 * O padrão não é timidez, é medição. O ensaio contra as 3.688 linhas do acervo
 * de produção em 21/08 deu 320 demoções e 1.240 promoções, e as duas metades
 * têm qualidade muito diferente: as demoções conferidas na amostra estavam
 * todas certas — matéria policial, trânsito, obituário e loteria saindo de
 * "Tecnologia" e "Economia" —, enquanto as promoções erravam perto de metade
 * das vezes, porque um corpo de milhares de caracteres acaba citando
 * "prefeitura" ou "festival" de passagem e limpa o piso de 3 palavras
 * distintas. "Carnaval 2027" virava Política; "Festival da Juventude oferece
 * vagas de estágio" virava Entretenimento.
 *
 * Aplicar tudo consertaria 320 erros e criaria algo perto de 500. O piso do
 * classificador para texto longo é o que precisa melhorar antes de `all` valer
 * a pena — e essa é uma mudança de regra, não de backfill.
 */
export type CategoryMode = 'clear-only' | 'all';

export interface RenormalizeOptions {
  /** Padrão `true`: sem passar `false` explícito, nada é gravado. */
  dryRun?: boolean;
  /** Teto de linhas examinadas, das mais recentes para as mais antigas. */
  limit?: number;
  /**
   * Restringe **a varredura inteira** a estas fontes. Ausente varre todas.
   *
   * Não confundir com o recorte da reclassificação, que é
   * `CLASSIFIER_OWNED_SOURCES` e continua valendo dentro de qualquer varredura:
   * passar `sources: ['InfoMoney']` higieniza o texto da InfoMoney e **não**
   * mexe na categoria dela, porque ela tem rótulo fixo.
   */
  sources?: string[];
  /** Ver `CategoryMode`. Padrão `clear-only`. */
  categoryMode?: CategoryMode;
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
  /** Linhas cujo título, descrição, corpo ou fonte mudaram com a higiene. */
  textChanged: number;
  /** Linhas que ganharam `imageUrl` a partir de uma `<img>` dentro do corpo. */
  imageRecovered: number;
  categoryChanged: number;
  /** Mudanças que o modo corrente **não** aplicou, mas que existiriam em `all`. */
  categorySkipped: number;
  transitions: CategoryTransition[];
  /** Amostra das reclassificações, para conferir antes de aplicar. */
  sample: RenormalizeChange[];
}

/** Quantas mudanças a resposta detalha. O resto vira contagem. */
const SAMPLE_SIZE = 25;

/** Linhas por transação. Uma transação com milhares de updates estoura o pool. */
const BATCH_SIZE = 100;

/**
 * Linhas por consulta na varredura.
 *
 * **A varredura era uma consulta só, e foi ela que derrubou a API em
 * 03/09/2026.** O `findMany` sem `take` trazia o acervo inteiro — 8.190 linhas
 * com `content` — e o laço de higiene passava por todas sem devolver o event
 * loop uma vez sequer. No plano free do Render (0.1 CPU) isso são **45 s** de
 * processo mudo: os health checks de 5 s do `/api/health`, que vinham a cada
 * 5 s como relógio, pararam de ser respondidos às 11:00:22 e o Render matou a
 * instância com `SIGTERM` às 11:01:07. O briefing do dia tinha sido gravado
 * 2 s antes do travamento — foi por isso que o dia não se perdeu.
 *
 * Paginar não é sobre memória: o acervo inteiro mede ~27 MB de texto, folgado
 * nos 512 MB da instância. É sobre **não segurar a CPU** — cada página é um
 * `await` que deixa o Node atender quem está esperando.
 */
const READ_PAGE_SIZE = 500;

/**
 * Linhas processadas entre dois respiros do event loop.
 *
 * A página sozinha não basta: 500 linhas seguidas ainda são ~2,7 s de CPU
 * travada com 0.1 vCPU, perto demais do timeout de 5 s do health check. Com
 * 100, o maior bloqueio contínuo fica em ~0,55 s — uma ordem de grandeza de
 * folga. São ~82 respiros para o acervo inteiro, custo desprezível ao lado de
 * uma instância morta.
 */
const YIELD_EVERY = 100;

/**
 * Devolve o event loop ao Node.
 *
 * `setImmediate` roda na fase *check*, **depois** da fase de poll — então o
 * I/O que estava esperando (a conexão do health check, entre outras) é atendido
 * antes de a varredura continuar. `await Promise.resolve()` não serve: a
 * microtask volta para o mesmo tick e nada de I/O acontece no meio.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

interface PendingUpdate {
  id: string;
  data: {
    title?: string;
    description?: string;
    content?: string | null;
    imageUrl?: string | null;
    source?: string;
    category?: Category;
  };
}

export async function renormalizeStoredNews(
  options: RenormalizeOptions = {},
): Promise<RenormalizeReport> {
  const dryRun = options.dryRun ?? true;
  const categoryMode: CategoryMode = options.categoryMode ?? 'clear-only';
  const scanFilter =
    options.sources && options.sources.length > 0
      ? { source: { in: options.sources } }
      : {};
  // Recorte da **reclassificação**, dentro de qualquer varredura. Ver o
  // cabeçalho: fonte com categoria fixa não tem categoria a recalcular, tenha
  // ela texto sujo ou não.
  const classifierOwned = new Set(CLASSIFIER_OWNED_SOURCES);

  const updates: PendingUpdate[] = [];
  const transitions = new Map<string, CategoryTransition>();
  const sample: RenormalizeChange[] = [];
  let textChanged = 0;
  let imageRecovered = 0;
  let categoryChanged = 0;
  let categorySkipped = 0;
  let scanned = 0;
  let sinceLastYield = 0;
  // `undefined` na primeira página; daí em diante, o id da última linha lida.
  let cursor: string | undefined;

  for (;;) {
    // `limit` continua sendo teto da varredura inteira, não da página.
    const remaining = options.limit === undefined ? READ_PAGE_SIZE : options.limit - scanned;
    if (remaining <= 0) break;
    const take = Math.min(READ_PAGE_SIZE, remaining);

    const rows = await prisma.news.findMany({
      where: scanFilter,
      select: {
        id: true,
        title: true,
        description: true,
        content: true,
        imageUrl: true,
        source: true,
        category: true,
      },
      // **O `id` entrou como desempate porque a paginação exige ordem total.**
      // `publishedAt` repete — a colheita carimba dezenas de linhas no mesmo
      // segundo —, e cursor sobre ordem ambígua pula ou repete linha entre
      // páginas. O sentido da varredura (mais recentes primeiro) não muda.
      orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
      take,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });

    // A última linha da página é o cursor da próxima. Ler pelo elemento (e não
    // por `rows.length === 0`) é o que satisfaz `noUncheckedIndexedAccess` sem
    // asserção: página vazia e ausência de última linha são o mesmo fim.
    const last = rows[rows.length - 1];
    if (last === undefined) break;
    cursor = last.id;
    scanned += rows.length;

    for (const row of rows) {
      // Antes de qualquer `continue` do laço, senão a linha sem mudança —
      // que é a maioria em regime — pularia o respiro junto.
      if (++sinceLastYield >= YIELD_EVERY) {
        sinceLastYield = 0;
        await yieldToEventLoop();
      }

      const title = sanitizeTitle(decodeEntities(row.title));
      const fullText = sanitizeDescription(decodeEntities(row.description), title);
      // O `source` nunca passou por `decodeEntities` na ingestão do NewsData, e o
      // acervo tem "Jornal Do Com&eacute;rcio" para provar.
      const source = decodeEntities(row.source);
      const excerpt = sanitizeContent(row.content, fullText);
      const { dek, body } = splitDekAndBody(fullText, excerpt);
      // A `<img>` sai do corpo com a higiene, então a busca é sobre o **bruto** —
      // e só quando não há foto declarada, para nunca sobrescrever a do veículo.
      const imageUrl = row.imageUrl ?? extractImageFromHtml(row.content);

      // **O classificador continua lendo o texto inteiro, e é o que mantém este
      // job idempotente.** Depois da primeira passada a `description` é um dek de
      // 320 caracteres; alimentá-lo com ela mudaria a categoria de metade do
      // acervo na segunda execução, sem que nada acusasse — o piso de 5 palavras
      // distintas foi calibrado contra o corpo. `body ?? dek` é o texto inteiro
      // nas duas passadas: antes ele está na descrição, depois no corpo.
      const category = classifyCategory(title, body ?? dek);

      const data: PendingUpdate['data'] = {};
      if (title !== row.title) data.title = title;
      if (dek !== row.description) data.description = dek;
      if (body !== row.content) data.content = body;
      if (source !== row.source) data.source = source;
      if (imageUrl !== row.imageUrl) data.imageUrl = imageUrl;

      if (category !== row.category && classifierOwned.has(row.source)) {
        // Em `clear-only`, promoção e troca entram na contagem de ignoradas em
        // vez de virar update — a linha ainda pode ter reparo de texto.
        if (categoryMode === 'all' || category === 'WORLD') {
          data.category = category;
        } else {
          categorySkipped++;
        }
      }

      if (Object.keys(data).length === 0) continue;

      // `in`, e não truthiness: `content: null` é a correção mais comum das três
      // — o corpo que era o dek repetido — e `if (data.content)` a contaria como
      // "nada mudou".
      if (
        'title' in data ||
        'description' in data ||
        'content' in data ||
        'source' in data
      ) {
        textChanged++;
      }
      if ('imageUrl' in data) imageRecovered++;

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

    // Página incompleta é fim de acervo — pedir a próxima só para receber zero
    // linhas é uma consulta a mais em toda varredura. Comparar contra o `take`
    // efetivo, e não contra `READ_PAGE_SIZE`, é o que mantém isto certo quando
    // o `limit` encurta a última página.
    if (rows.length < take) break;
  }

  if (!dryRun) {
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      await prisma.$transaction(
        batch.map((update) =>
          prisma.news.update({ where: { id: update.id }, data: update.data }),
        ),
      );
      // A transação é I/O, mas montá-la e serializar a resposta não são; com
      // milhares de updates os lotes se emendam sem folga nenhuma.
      await yieldToEventLoop();
    }
  }

  return {
    dryRun,
    scanned,
    textChanged,
    imageRecovered,
    categoryChanged,
    categorySkipped,
    transitions: [...transitions.values()].sort((a, b) => b.count - a.count),
    sample,
  };
}
