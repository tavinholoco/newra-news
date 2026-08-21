import Parser from 'rss-parser';
import { classifyCategory } from '../../services/category-classifier.service';
import { decodeEntities } from '../ai/ai-utils';
import { sanitizeDescription, sanitizeTitle } from './feed-text';
import type { RawNewsItem } from '../types';
import { rssSources, type RssSource } from '../../config/rss-sources';

interface CustomItem {
  mediaContent?: { $?: { url?: string } };
  mediaThumbnail?: { $?: { url?: string } };
}

const parser = new Parser<Record<string, never>, CustomItem>({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
    ],
  },
});

export async function fetchFromRss(sources: RssSource[] = rssSources): Promise<RawNewsItem[]> {
  const results = await Promise.allSettled(sources.map((source) => fetchSource(source)));

  return results
    .filter((r): r is PromiseFulfilledResult<RawNewsItem[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value);
}

async function fetchFeedXml(url: string): Promise<string> {
  const response = await fetch(url);
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

function extractImageUrl(item: CustomItem & { enclosure?: { url?: string } }): string | null {
  if (item.enclosure?.url) return item.enclosure.url;
  if (item.mediaContent?.$?.url) return item.mediaContent.$.url;
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  return null;
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
      const description = sanitizeDescription(
        decodeEntities((item.contentSnippet || item.content) as string),
        title,
      );
      return {
        title,
        description,
        content: item.content ? decodeEntities(item.content) : null,
        source: source.name,
        sourceUrl: item.link ?? source.url,
        imageUrl: extractImageUrl(item),
        category: source.category ?? classifyCategory(title, description),
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      };
    });
}
