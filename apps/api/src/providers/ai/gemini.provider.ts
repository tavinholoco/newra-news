import { env } from '../../config/env';
import { ARTICLE_SYSTEM_PROMPT, ARTICLE_USER_PROMPT } from '../../config/ai-prompts';
import {
  attachRetryAfter,
  formatNewsItems,
  parseMarkdownResponse,
  withRetry,
} from './ai-utils';
import type { RawNewsItem, GeneratedArticle } from '../types';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 60_000;

interface GeminiApiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

async function requestArticle(newsItems: RawNewsItem[]): Promise<GeneratedArticle> {
  const userPrompt = ARTICLE_USER_PROMPT + formatNewsItems(newsItems);
  const url = `${GEMINI_BASE_URL}/${env.GEMINI_MODEL}:generateContent`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: ARTICLE_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unable to read error body');
      throw attachRetryAfter(
        new Error(`Gemini API error ${response.status}: ${errorBody}`),
        response.headers,
      );
    }

    const data = (await response.json()) as GeminiApiResponse;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Gemini returned empty response');
    }

    return parseMarkdownResponse(text);
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateArticleWithGemini(
  newsItems: RawNewsItem[],
): Promise<GeneratedArticle> {
  return withRetry(() => requestArticle(newsItems), 'Gemini');
}
