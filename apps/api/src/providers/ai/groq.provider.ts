import { env } from '../../config/env';
import { ARTICLE_SYSTEM_PROMPT, ARTICLE_USER_PROMPT } from '../../config/ai-prompts';
import { formatNewsItems, parseMarkdownResponse } from './ai-utils';
import type { RawNewsItem, GeneratedArticle } from '../types';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface GroqApiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function generateArticleWithGroq(
  newsItems: RawNewsItem[],
): Promise<GeneratedArticle> {
  const userPrompt = ARTICLE_USER_PROMPT + formatNewsItems(newsItems);

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
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as GroqApiResponse;
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('Groq returned empty response');
  }

  return parseMarkdownResponse(text);
}
