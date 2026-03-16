import { env } from '../config/env';
import { ARTICLE_SYSTEM_PROMPT, ARTICLE_USER_PROMPT } from '../config/ai-prompts';
import { formatNewsItems, parseMarkdownResponse } from './ai-utils';
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
