import { prisma } from '@newranews/database';
import { Category } from '@newranews/database';
import type { News } from '@newranews/database';
import type {
  Category as EditorialCategory,
  DailyBriefing,
  EditorialStory,
  HomeCategorySection,
  HomeResponse,
} from '@newranews/types';
import { toEditorialStory, readingTimeMinutes } from './editorial.mapper';
import { getTrending } from './trending.service';
import { getLatestArticle } from './article.service';

const TOP_STORIES = 5;
const TRENDING = 5;

/**
 * Quantos candidatos a trending pedir para preencher `TRENDING` vagas.
 *
 * O trending é ranqueado por recência + favoritos, e `topStories` já levou as
 * mais recentes — então os primeiros colocados quase sempre já saíram. Pedindo
 * exatamente 5, o bloco voltaria vazio na maioria dos dias.
 *
 * A precedência da §3 existe para **não repetir**, não para esvaziar um bloco:
 * o que ela decide é quem fica com a notícia disputada, e o perdedor continua
 * descendo o próprio ranking até preencher. Daí pedir 4×.
 */
const TRENDING_CANDIDATES = TRENDING * 4;
const LATEST = 12;
const PER_CATEGORY = 4;

/**
 * Quantas notícias recentes carregar de uma vez.
 *
 * A Home consome no máximo 1 + 5 + 5 + 12 + (4 × 4) = 39 peças distintas, mas
 * os blocos disputam as mesmas notícias e a de-duplicação descarta, então o
 * pool precisa de folga. 150 é uma consulta só e, no volume atual (~490
 * notícias/dia), cobre as últimas horas — que é o material do qual uma home de
 * notícia deve ser feita.
 */
const POOL = 150;

/**
 * Distribuidor com memória: cada notícia sai **uma vez só**, na ordem de
 * precedência em que os blocos pedem.
 *
 * É a regra que a §3 dos contratos exige e a única parte não trivial deste
 * serviço. Sem ela a mesma manchete apareceria no hero, em "top stories" e na
 * seção da categoria dela — que é o defeito de grade uniforme que a V2 existe
 * para corrigir.
 */
class StoryPool {
  private readonly used = new Set<string>();

  constructor(private readonly items: News[]) {}

  isUsed(id: string): boolean {
    return this.used.has(id);
  }

  /** Reserva um id sem devolver nada — para blocos que escolhem por fora. */
  claim(id: string): void {
    this.used.add(id);
  }

  take(count: number, filter?: (news: News) => boolean): News[] {
    const out: News[] = [];
    if (count <= 0) return out;

    for (const news of this.items) {
      if (out.length >= count) break;
      if (this.used.has(news.id)) continue;
      if (filter && !filter(news)) continue;
      this.used.add(news.id);
      out.push(news);
    }
    return out;
  }
}

/**
 * O briefing do dia no formato da §24, ou `null` se o pipeline ainda não rodou
 * — a Home precisa renderizar sem ele.
 *
 * `aiDisclosure` é constante `true`, não coluna: todo briefing é gerado por IA
 * e a §8 exige declará-lo. Uma coluna sugeriria que existe briefing sem IA — e
 * daria a alguém a chance de gravar `false`.
 */
async function loadBriefing(): Promise<DailyBriefing | null> {
  const article = await getLatestArticle();
  if (!article) return null;

  return {
    id: article.id,
    date: article.date.toISOString().slice(0, 10),
    title: article.title,
    summary: article.summary,
    // `sources` está vazio nos artigos anteriores à migration de auditoria;
    // `newsCount` é o número solto que existia antes dela.
    sourceCount: article.sources.length || article.newsCount,
    readingTimeMinutes: readingTimeMinutes(article.content, article.summary) ?? 1,
    generatedAt: article.generatedAt?.toISOString() ?? null,
    aiDisclosure: true,
    sources: article.sources,
  };
}

export interface HomeOptions {
  /** Quantas seções por categoria devolver. */
  categories: number;
}

export async function getHome({
  categories,
}: HomeOptions): Promise<HomeResponse> {
  const [pool, briefing, ranked] = await Promise.all([
    prisma.news.findMany({ orderBy: { publishedAt: 'desc' }, take: POOL }),
    loadBriefing(),
    getTrending({ limit: TRENDING_CANDIDATES, window: '24h' }),
  ]);

  const stories = new StoryPool(pool);

  // 1. Hero — a mais recente **com imagem**. A §6.2 quer capa, e cerca de 30%
  //    do acervo vem de RSS sem imagem: pegar a mais recente sem olhar isso
  //    deixaria a capa no gradiente de placeholder na maioria dos dias.
  const [heroNews] = stories.take(1, (news) => Boolean(news.imageUrl));
  const hero = heroNews ? toEditorialStory(heroNews, { isFeatured: true }) : null;

  // 2. Top stories.
  const topStories = stories.take(TOP_STORIES).map((news) => toEditorialStory(news));

  // 3. Trending — vem de fora do pool, porque é apurado por score próprio
  //    (§4). O que o pool faz aqui é descartar o que já saiu acima e reservar
  //    o resto, para as seções seguintes não repetirem.
  const trending: EditorialStory[] = [];
  for (const story of ranked) {
    if (trending.length >= TRENDING) break;
    if (stories.isUsed(story.id)) continue;
    stories.claim(story.id);
    trending.push(story);
  }

  // 4. Seções por categoria, na ordem do enum — estável de um dia para o
  //    outro. Ordenar por volume faria os blocos da Home trocarem de lugar
  //    sozinhos, o que desorienta quem volta todo dia.
  const sections: HomeCategorySection[] = [];
  for (const category of Object.values(Category)) {
    if (sections.length >= categories) break;
    const picked = stories.take(PER_CATEGORY, (news) => news.category === category);
    // Categorias vazias são omitidas: um bloco com título e nada dentro é pior
    // que bloco nenhum.
    if (picked.length > 0) {
      sections.push({
        // Mesma ponte de enum do `editorial.mapper`: idênticos em membros,
        // nominalmente distintos para o TypeScript.
        category: category as EditorialCategory,
        stories: picked.map((news) => toEditorialStory(news)),
      });
    }
  }

  // 5. Latest — o que sobrou, em ordem cronológica.
  const latest = stories.take(LATEST).map((news) => toEditorialStory(news));

  return { hero, briefing, topStories, trending, latest, categories: sections };
}
