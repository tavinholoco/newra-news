import type { EditorialStory, News } from '@newranews/types';

/** Palavras por minuto de texto editorial — o mesmo número do backend. */
const WORDS_PER_MINUTE = 200;

/**
 * Minutos de leitura, arredondando para cima.
 *
 * Devolve `null`, não zero, quando não há texto: zero minutos é uma afirmação
 * ("leva zero minuto"), e a ausência de conteúdo é outra coisa — cerca de um
 * terço do acervo vem dos feeds RSS só com o resumo.
 */
function readingTimeMinutes(
  ...candidates: Array<string | null | undefined>
): number | null {
  const text = candidates.find((value) => value && value.trim().length > 0);
  if (!text) return null;

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words === 0 ? null : Math.ceil(words / WORDS_PER_MINUTE);
}

/**
 * `News` (registro da coleta) para `EditorialStory` (peça de composição).
 *
 * Existe porque `/api/news` devolve `News` — a listagem é o mesmo endpoint da
 * V1, e a ficha da tela em `docs/v2/02-sitemap-telas.md` a mantém sem mudança
 * de contrato — enquanto os cards de `components/editorial/` falam
 * `EditorialStory`. Sem esta ponte, `/news` teria de reconstruir os cards em
 * vez de reusar os da Home, que é exatamente o que a Fase 4 não deve fazer.
 *
 * É a contraparte de `toEditorialStory` do backend, com a mesma regra de tempo
 * de leitura. Duplicação consciente e mínima: mover o cálculo para
 * `packages/types` significaria pôr lógica num pacote que hoje só declara
 * tipos, e mover o endpoint para `EditorialStory` mudaria um contrato que a
 * admin e os favoritos também consomem.
 *
 * `isFeatured` e `isTrending` não são inferidos aqui: são posicionais, e quem
 * sabe a posição é a tela que monta a lista.
 */
export function newsToStory(news: News): EditorialStory {
  return {
    id: news.id,
    title: news.title,
    dek: news.description || null,
    imageUrl: news.imageUrl,
    category: news.category,
    source: news.source,
    sourceUrl: news.sourceUrl,
    publishedAt: news.publishedAt,
    updatedAt: news.updatedAt ?? null,
    readingTimeMinutes: readingTimeMinutes(news.content, news.description),
  };
}
