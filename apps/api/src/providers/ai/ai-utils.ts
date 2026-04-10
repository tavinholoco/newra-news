import type { RawNewsItem, GeneratedArticle } from '../types';

const MAX_DESCRIPTION_LENGTH = 300;
const MAX_CONTENT_LENGTH = 400;

const NAMED_ENTITIES: Record<string, string> = {
  // Core HTML
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0',
  // Portuguese accented characters (lower + upper)
  aacute: '\u00E1', Aacute: '\u00C1',
  agrave: '\u00E0', Agrave: '\u00C0',
  atilde: '\u00E3', Atilde: '\u00C3',
  acirc: '\u00E2', Acirc: '\u00C2',
  eacute: '\u00E9', Eacute: '\u00C9',
  egrave: '\u00E8', Egrave: '\u00C8',
  ecirc: '\u00EA', Ecirc: '\u00CA',
  iacute: '\u00ED', Iacute: '\u00CD',
  oacute: '\u00F3', Oacute: '\u00D3',
  otilde: '\u00F5', Otilde: '\u00D5',
  ocirc: '\u00F4', Ocirc: '\u00D4',
  uacute: '\u00FA', Uacute: '\u00DA',
  uuml: '\u00FC', Uuml: '\u00DC',
  ccedil: '\u00E7', Ccedil: '\u00C7',
  ntilde: '\u00F1', Ntilde: '\u00D1',
  // Typographic punctuation
  ndash: '\u2013', mdash: '\u2014',
  lsquo: '\u2018', rsquo: '\u2019',
  ldquo: '\u201C', rdquo: '\u201D',
  hellip: '\u2026', bull: '\u2022',
  copy: '\u00A9', reg: '\u00AE', trade: '\u2122',
  euro: '\u20AC', pound: '\u00A3',
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITIES[name] ?? match);
}

function stripHtml(html: string): string {
  return decodeEntities(
    html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

export function formatNewsItems(newsItems: RawNewsItem[]): string {
  return newsItems
    .map((item, index) => {
      const cleanDescription = truncate(stripHtml(item.description), MAX_DESCRIPTION_LENGTH);
      const cleanContent = item.content
        ? truncate(stripHtml(item.content), MAX_CONTENT_LENGTH)
        : 'N/A';
      return `${index + 1}. TÍTULO: ${item.title}\nFONTE: ${item.source}\nCATEGORIA: ${item.category}\nDATA: ${item.publishedAt.toISOString()}\nDESCRIÇÃO: ${cleanDescription}\nCONTEÚDO: ${cleanContent}`;
    })
    .join('\n\n');
}

export function parseMarkdownResponse(markdown: string): GeneratedArticle {
  const lines = markdown.split('\n');
  const h1Index = lines.findIndex((line) => line.startsWith('# '));

  let title: string;
  let contentLines: string[];

  if (h1Index !== -1) {
    title = (lines[h1Index] ?? '').replace(/^#\s+/, '').trim();
    contentLines = lines.filter((_, i) => i !== h1Index);
  } else {
    const firstNonEmptyIndex = lines.findIndex((l) => l.trim() !== '');
    title = lines[firstNonEmptyIndex]?.trim() ?? '';
    contentLines = lines.slice(firstNonEmptyIndex + 1);
  }

  const summary =
    contentLines
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith('#')) ?? '';

  const content = contentLines.join('\n').trim();

  return { title, summary, content };
}
