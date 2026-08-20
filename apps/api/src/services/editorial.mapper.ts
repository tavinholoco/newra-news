import type { News } from '@newranews/database';
import type { Category, EditorialStory } from '@newranews/types';

/** Palavras por minuto de texto editorial. */
const WORDS_PER_MINUTE = 200;

/**
 * Corpo do texto para minutos de leitura, arredondando para cima.
 *
 * Devolve `null`, não zero, quando não há texto: zero minutos é uma afirmação
 * ("leva zero minuto"), e a ausência de conteúdo é outra coisa — cerca de um
 * terço do acervo vem dos feeds RSS só com o resumo.
 */
export function readingTimeMinutes(
  ...candidates: Array<string | null | undefined>
): number | null {
  const text = candidates.find((value) => value && value.trim().length > 0);
  if (!text) return null;

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return null;

  return Math.ceil(words / WORDS_PER_MINUTE);
}

/**
 * `News` (registro da coleta) para `EditorialStory` (peça de composição).
 *
 * O tempo de leitura sai do `content` quando existe e cai para a `description`
 * quando não — do contrário toda matéria de RSS ficaria sem o dado, e o card
 * mostraria a mesma lacuna em um terço da grade.
 *
 * `isFeatured` e `isTrending` **não** são inferidos aqui: são posicionais, e
 * quem sabe a posição é o serviço que monta a resposta.
 */
export function toEditorialStory(
  news: News,
  flags: { isFeatured?: boolean; isTrending?: boolean } = {},
): EditorialStory {
  return {
    id: news.id,
    title: news.title,
    dek: news.description || null,
    imageUrl: news.imageUrl,
    // O `Category` do Prisma e o de `packages/types` têm exatamente os mesmos
    // membros — os dois nascem do `schema.prisma` — mas são enums nominais
    // distintos para o TypeScript. Este mapper é a fronteira entre o registro
    // do banco e o tipo compartilhado, então é aqui que a ponte acontece, uma
    // vez só, em vez de espalhar casts pelos serviços.
    category: news.category as Category,
    source: news.source,
    sourceUrl: news.sourceUrl,
    publishedAt: news.publishedAt.toISOString(),
    updatedAt: news.updatedAt?.toISOString() ?? null,
    readingTimeMinutes: readingTimeMinutes(news.content, news.description),
    ...(flags.isFeatured ? { isFeatured: true } : {}),
    ...(flags.isTrending ? { isTrending: true } : {}),
  };
}
