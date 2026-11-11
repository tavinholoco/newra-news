import { env } from '../../config/env';
import { ARTICLE_SYSTEM_PROMPT } from '../../config/ai-prompts';
import {
  attachRetryAfter,
  buildArticleUserPrompt,
  parseMarkdownResponse,
  withRetry,
} from './ai-utils';
import type { RawNewsItem, GeneratedArticle } from '../types';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const REQUEST_TIMEOUT_MS = 60_000;

interface GeminiPart {
  text?: string;
  /** `true` numa parte de raciocínio — só vem quando o pedido a inclui. */
  thought?: boolean;
  /** Assinatura opaca do raciocínio; pode vir numa parte com o texto. */
  thoughtSignature?: string;
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

/**
 * **O texto da resposta é a soma das partes que não são raciocínio.**
 *
 * Até 11/11/2026 a leitura era `parts[0].text`, que bastava no
 * `gemini-2.5-flash`. A troca para a linha 3.x (`gemini-3.8-flash`) traz
 * raciocínio ligado por padrão e assinaturas que podem vir "em qualquer
 * parte"; a documentação não promete que a resposta de texto venha numa
 * parte só. Ler só a primeira descartaria o resto do briefing em silêncio —
 * e o portão de saída o leria como um texto curto, não como um defeito.
 */
export function responseText(data: GeminiApiResponse): string {
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => part.thought !== true && typeof part.text === 'string')
    .map((part) => part.text)
    .join('');
}

async function requestArticle(newsItems: RawNewsItem[]): Promise<GeneratedArticle> {
  const userPrompt = buildArticleUserPrompt(newsItems);
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
    const text = responseText(data);

    if (!text.trim()) {
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
