import { generateArticleWithGemini } from '../providers/ai/gemini.provider';
import { generateArticleWithGroq } from '../providers/ai/groq.provider';
import { env } from '../config/env';
import type { RawNewsItem, GeneratedArticle } from '../providers/types';

export interface GenerateArticleResult {
  article: GeneratedArticle;
  provider: 'gemini' | 'groq';
  /** Modelo que de fato gerou o artigo — gravado em `Article.modelVersion`. */
  modelVersion: string;
}

export async function generateArticle(
  newsItems: RawNewsItem[],
): Promise<GenerateArticleResult> {
  try {
    const article = await generateArticleWithGemini(newsItems);
    return { article, provider: 'gemini', modelVersion: env.GEMINI_MODEL };
  } catch (geminiError) {
    console.warn('Gemini provider failed, falling back to Groq:', geminiError);
    try {
      const article = await generateArticleWithGroq(newsItems);
      return { article, provider: 'groq', modelVersion: env.GROQ_MODEL };
    } catch (groqError) {
      // Fallback também falhou: carrega o erro primário (Gemini) junto ao erro
      // final (Groq) para o pipeline persistir os DOIS no PipelineLog — sem
      // isso, a causa real que disparou o fallback se perde (só o Groq 404
      // ficava registrado, como no run de 17/08/2026).
      throw withPrimaryError(groqError, geminiError);
    }
  }
}

function withPrimaryError(error: unknown, primaryError: unknown): Error {
  const err = error instanceof Error ? error : new Error(String(error));
  (err as Error & { primaryError?: unknown }).primaryError = primaryError;
  return err;
}
