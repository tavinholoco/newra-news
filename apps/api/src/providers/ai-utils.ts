import type { RawNewsItem, GeneratedArticle } from './types';

export function formatNewsItems(newsItems: RawNewsItem[]): string {
  return newsItems
    .map(
      (item, index) =>
        `${index + 1}. TÍTULO: ${item.title}\nFONTE: ${item.source}\nCATEGORIA: ${item.category}\nDATA: ${item.publishedAt.toISOString()}\nDESCRIÇÃO: ${item.description}\nCONTEÚDO: ${item.content ?? 'N/A'}`,
    )
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
