import type { Category } from './news';
import type { BriefingSource } from './article';

/**
 * Notícia na perspectiva da **composição editorial**, não da coleta (§24 do
 * plano V2).
 *
 * A diferença em relação a `News` não é cosmética. `News` é o registro do que
 * o pipeline coletou — tem `content`, `sourceUrl`, `createdAt`. `EditorialStory`
 * é o que uma tela precisa para posicionar a matéria numa página: título, dek,
 * imagem, e os três campos que dizem *onde* ela entra.
 *
 * Nenhum dos três é coluna no banco, e nenhum exige migration (§2 dos
 * contratos):
 *
 * | Campo | De onde vem |
 * |---|---|
 * | `readingTimeMinutes` | calculado de `content`/`dek` no serviço |
 * | `isFeatured` | posição na resposta de `/api/home` |
 * | `isTrending` | score de `/api/trending`, calculado na consulta |
 */
export interface EditorialStory {
  id: string;
  title: string;
  /** A `description` da News, no vocabulário editorial. */
  dek: string | null;
  imageUrl: string | null;
  category: Category;
  source: string;
  /** URL da matéria original — a atribuição de fonte precisa dela. */
  sourceUrl: string;
  publishedAt: string;
  updatedAt: string | null;
  readingTimeMinutes: number | null;
  isFeatured?: boolean;
  isTrending?: boolean;
}

/**
 * O briefing do dia com o que a §8 precisa para exibir transparência de IA.
 *
 * `sources` e `generatedAt` vêm da migration `add_daily_briefing_metadata`, e
 * são nulos nos artigos anteriores a ela — não havia como preenchê-los
 * retroativamente, porque nada registrava as notícias de origem.
 */
export interface DailyBriefing {
  id: string;
  /** YYYY-MM-DD. */
  date: string;
  title: string;
  summary: string;
  sourceCount: number;
  readingTimeMinutes: number;
  generatedAt: string | null;
  /** Sempre `true`: todo briefing é gerado por IA e a §8 exige dizê-lo. */
  aiDisclosure: boolean;
  sources: BriefingSource[];
}

/** Uma seção por categoria da Home. Categorias sem matéria são omitidas. */
export interface HomeCategorySection {
  category: Category;
  stories: EditorialStory[];
}

/**
 * Resposta agregada da Home (§3 dos contratos).
 *
 * Existe porque a Home da V2 tem hero, briefing, top stories, trending, seções
 * por categoria e newsletter: composta bloco a bloco seriam 6+ chamadas em
 * sequência a partir de um Server Component. A da V1 fazia 2.
 *
 * **Nenhuma notícia aparece duas vezes na resposta.** A precedência é
 * `hero` → `topStories` → `trending` → `categories` → `latest`.
 *
 * Não há campo `newsletter`: o bloco é estático (texto + formulário) e não
 * depende de dado do servidor — incluí-lo seria peso morto.
 */
export interface HomeResponse {
  /** Mais recente com imagem; `null` se o acervo estiver vazio. */
  hero: EditorialStory | null;
  /** `null` quando o pipeline do dia ainda não rodou — a Home renderiza sem ele. */
  briefing: DailyBriefing | null;
  topStories: EditorialStory[];
  trending: EditorialStory[];
  latest: EditorialStory[];
  categories: HomeCategorySection[];
}

/** Janela de apuração do trending. */
export type TrendingWindow = '24h' | '7d';
