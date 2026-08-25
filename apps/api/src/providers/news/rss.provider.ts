import Parser from 'rss-parser';
import { classifyCategory } from '../../services/category-classifier.service';
import { decodeEntities } from '../ai/ai-utils';
import {
  extractImageFromHtml,
  sanitizeContent,
  sanitizeDescription,
  sanitizeTitle,
  splitDekAndBody,
} from './feed-text';
import type { RawNewsItem } from '../types';
import { rssSources, type RssSource } from '../../config/rss-sources';

interface CustomItem {
  mediaContent?: { $?: { url?: string } };
  mediaThumbnail?: { $?: { url?: string } };
}

/** Teto por feed. Ver a nota no `fetchFeedXml`. */
const FEED_TIMEOUT_MS = 30_000;

const parser = new Parser<Record<string, never>, CustomItem>({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
    ],
  },
});

/**
 * **Fonte que não rende nada avisa, e antes sumia em silêncio.**
 *
 * `Promise.allSettled` é o certo aqui — um feed fora do ar não pode derrubar a
 * coleta do dia —, mas ele descarta a rejeição sem deixar rastro. A `Reuters`
 * ficou na lista com **zero itens** até 24/08/2026, quando a medição do acervo
 * a expôs: `feeds.reuters.com` devolve NXDOMAIN desde que a Reuters desligou os
 * feeds públicos, e toda execução do pipeline gastava uma resolução de DNS
 * fadada a falhar.
 *
 * O aviso por fonte é o mínimo que torna a próxima visível — ele sai no log do
 * Render, ao lado do resto da execução. **Não vira teste de rede**: uma suíte
 * que bate nos treze feeds reprovaria no dia em que um publisher espirrasse, e
 * gate que falha por motivo alheio é gate que se aprende a ignorar.
 */
export async function fetchFromRss(sources: RssSource[] = rssSources): Promise<RawNewsItem[]> {
  const results = await Promise.allSettled(sources.map((source) => fetchSource(source)));

  results.forEach((result, index) => {
    const name = sources[index]?.name ?? 'desconhecida';
    if (result.status === 'rejected') {
      console.warn(`[rss] ${name}: falhou —`, result.reason);
    } else if (result.value.length === 0) {
      console.warn(`[rss] ${name}: zero itens`);
    }
  });

  return results
    .filter((r): r is PromiseFulfilledResult<RawNewsItem[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);
}

async function fetchFeedXml(url: string): Promise<string> {
  // **Prazo, pela mesma razão que o resto da fase.** Um feed que aceita a
  // conexão e não responde prenderia a etapa 1 do pipeline sem teto — e treze
  // fontes em paralelo significam que basta uma. O provider de e-mail já tinha
  // o seu (15 s); este não tinha nenhum. Trinta segundos é folga sobre o pior
  // caso observado num feed lento e cabe no orçamento do cron diário.
  const response = await fetch(url, { signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
  const buffer = await response.arrayBuffer();

  const contentType = response.headers.get('content-type') || '';
  const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
  let charset = charsetMatch?.[1]?.trim() || '';

  if (!charset) {
    const peek = new TextDecoder('ascii').decode(
      new Uint8Array(buffer, 0, Math.min(200, buffer.byteLength)),
    );
    const xmlMatch = peek.match(/encoding=["']([^"']+)["']/i);
    charset = xmlMatch?.[1] || 'utf-8';
  }

  return new TextDecoder(charset).decode(buffer);
}

/**
 * A foto da materia, nos quatro lugares onde os feeds a escondem.
 *
 * Os tres primeiros sao campos declarados de RSS. **O quarto e o corpo**, e ele
 * entrou na Fase 12: a InfoMoney nao usa nenhum dos tres e poe a foto do post
 * como primeiro elemento do `content:encoded`, entao 107 das suas 108 noticias
 * no acervo diziam nao ter imagem tendo uma. E o ultimo da lista de proposito —
 * campo declarado e a intencao do veiculo; imagem de dentro do corpo e palpite,
 * ainda que bom.
 */
function extractImageUrl(
  item: CustomItem & { enclosure?: { url?: string } },
  content: string | null | undefined,
): string | null {
  if (item.enclosure?.url) return item.enclosure.url;
  if (item.mediaContent?.$?.url) return item.mediaContent.$.url;
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  return extractImageFromHtml(content);
}

async function fetchSource(source: RssSource): Promise<RawNewsItem[]> {
  const xml = await fetchFeedXml(source.url);
  const feed = await parser.parseString(xml);

  return feed.items
    .filter((item) => item.title && (item.contentSnippet || item.content))
    .map((item) => {
      // Decodificar **antes** de higienizar e classificar: o título repetido no
      // topo da descrição chega com entidades, e sem decodificar antes ele não
      // casa com o título e a linha duplicada sobrevive. Pelo mesmo motivo o
      // classificador passou a ver o texto limpo — antes ele recebia o título
      // cru, com entidade e quebra de linha.
      const title = sanitizeTitle(decodeEntities(item.title as string));
      // O texto inteiro, sem teto: `splitDekAndBody` é quem decide, logo
      // abaixo, quanto dele é subtítulo e quanto é corpo.
      const fullText = sanitizeDescription(
        decodeEntities((item.contentSnippet || item.content) as string),
        title,
      );
      // **O corpo passa pela mesma higiene que a descrição, e até a Fase 12 não
      // passava por nenhuma.** Ele ia cru para o banco: 63,7% do acervo com tag
      // HTML, metade abrindo com um `<img>` que a tela imprimia como texto.
      const excerpt = sanitizeContent(item.content, fullText);
      const { dek, body } = splitDekAndBody(fullText, excerpt);

      return {
        title,
        description: dek,
        content: body,
        source: source.name,
        sourceUrl: item.link ?? source.url,
        // O bruto, e não o higienizado: a tag `<img>` some no `sanitizeContent`.
        imageUrl: extractImageUrl(item, item.content),
        // O classificador lê o texto **inteiro**, não o dek recortado: o piso de
        // 5 palavras distintas foi calibrado contra o corpo, e alimentá-lo com
        // 320 caracteres mudaria a categoria de metade do acervo sem que nada
        // acusasse.
        category: source.category ?? classifyCategory(title, fullText),
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      };
    });
}
