import { env } from '../config/env';
import { ARTICLE_SYSTEM_PROMPT, ARTICLE_USER_PROMPT } from '../config/ai-prompts';
import type { RawNewsItem, GeneratedArticle } from './types';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

interface GeminiApiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

export async function generateArticleWithGemini(
  newsItems: RawNewsItem[],
): Promise<GeneratedArticle> {
  const userPrompt = ARTICLE_USER_PROMPT + formatNewsItems(newsItems);
  const url = `${GEMINI_BASE_URL}/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: ARTICLE_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GeminiApiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  return parseMarkdownResponse(text);
}

function formatNewsItems(newsItems: RawNewsItem[]): string {
  return newsItems
    .map(
      (item, index) =>
        `${index + 1}. TÍTULO: ${item.title}\nFONTE: ${item.source}\nCATEGORIA: ${item.category}\nDATA: ${item.publishedAt.toISOString()}\nDESCRIÇÃO: ${item.description}\nCONTEÚDO: ${item.content ?? 'N/A'}`,
    )
    .join('\n\n');
}

function parseMarkdownResponse(markdown: string): GeneratedArticle {
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
