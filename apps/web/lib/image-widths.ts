/**
 * **Uma largura só para toda imagem que não é o LCP** — 16/10/2026.
 *
 * O plano Hobby da Vercel dá **5.000 transformações de imagem em 30 dias**, e
 * transformação é cobrada por par **(imagem, largura)** em cada cache MISS.
 * Imagem de notícia troca todo dia, então MISS aqui é o caso normal. Com
 * `fill` + `sizes`, o `next/image` oferece a imagem em até nove larguras no
 * `srcset` — e põe **a maior delas no `src`** (`getWidths` e
 * `generateImgAttrs` em `next/dist/shared/lib/get-img-props.js`, no
 * `next@14.2.35`): a miniatura de 96 px saía com `src` a `w=1920`. O Google
 * lê o `src` (e diz que nem todo robô entende `srcset`), então cada robô que
 * passa vira uma transformação de 1920 px para uma caixa de 96.
 *
 * Aqui a imagem que não é o LCP sai **com um `src` só e sem `srcset`**: uma
 * variante por imagem, a mesma para leitor e robô, e a primeira visita paga a
 * transformação de todas as seguintes. Os dois heros (`hero-story`,
 * `article-hero`) continuam com o `srcset` inteiro — é onde a nitidez e o LCP
 * pagam o custo.
 *
 * E o HTML encolhe junto: os 30 `<img>` da Home somavam **69,5 KB** de
 * atributos em produção, e a Vercel cobra a escrita da ISR em unidades de
 * 8 KB.
 *
 * **As três larguras têm de estar em `deviceSizes`/`imageSizes`** do
 * `next.config.js` — o otimizador (o do Next e o da Vercel) recusa com 400
 * qualquer `w` fora da lista. Guarda em `tests/security/image-optimizer.test.ts`.
 */
export const FIXED_IMAGE_WIDTH = {
  /** A miniatura de 96 px do `story-card-horizontal`, a 2x. */
  thumbnail: 192,
  /**
   * Os cards (384 px na grade, 100% da tela no celular), o líder de categoria
   * (608 px) e as relacionadas (288 px). 828 é o celular de 414 px a 2x; no
   * de 375 px a 3x sai a 2,2x — a densidade em que o olho para de ver
   * diferença.
   */
  card: 828,
  /** O líder de uma categoria com uma matéria só, que ocupa os 1.216 px. */
  wide: 1200,
} as const;

export type FixedImageWidth = (typeof FIXED_IMAGE_WIDTH)[keyof typeof FIXED_IMAGE_WIDTH];

/** O caminho e a qualidade do carregador padrão do `next/image`. */
const OPTIMIZER_PATH = '/_next/image';
const OPTIMIZER_QUALITY = 75;

/**
 * A URL do otimizador para uma largura, **igual à que o carregador padrão do
 * Next escreve** (`next/dist/shared/lib/image-loader.js`) — a mesma chave de
 * cache que o `srcset` usaria. Quem confere a igualdade é a guarda, contra o
 * carregador de verdade: um Next novo que mude o formato reprova lá.
 */
export function optimizedImageUrl(src: string, width: FixedImageWidth): string {
  return `${OPTIMIZER_PATH}?url=${encodeURIComponent(src)}&w=${width}&q=${OPTIMIZER_QUALITY}`;
}
