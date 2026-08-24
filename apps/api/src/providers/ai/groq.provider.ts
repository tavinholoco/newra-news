import { env } from '../../config/env';
import { ARTICLE_SYSTEM_PROMPT } from '../../config/ai-prompts';
import {
  attachRetryAfter,
  buildArticleUserPrompt,
  parseMarkdownResponse,
  withRetry,
} from './ai-utils';
import type { RawNewsItem, GeneratedArticle } from '../types';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 60_000;

interface GroqApiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function requestArticle(newsItems: RawNewsItem[]): Promise<GeneratedArticle> {
  const userPrompt = buildArticleUserPrompt(newsItems);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: [
          { role: 'system', content: ARTICLE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw attachRetryAfter(
        new Error(`Groq API error: ${response.status} ${response.statusText}`),
        response.headers,
      );
    }

    const data = (await response.json()) as GroqApiResponse;
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      throw new Error('Groq returned empty response');
    }

    return parseMarkdownResponse(text);
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateArticleWithGroq(
  newsItems: RawNewsItem[],
): Promise<GeneratedArticle> {
  return withRetry(() => requestArticle(newsItems), 'Groq');
}
