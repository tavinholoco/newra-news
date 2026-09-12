import { generateArticleWithGemini } from '../providers/ai/gemini.provider';
import { generateArticleWithGroq } from '../providers/ai/groq.provider';
import { env } from '../config/env';
import type { RawNewsItem, GeneratedArticle } from '../providers/types';
import { baseLogger } from '../utils/logger';

export interface GenerateArticleResult {
  article: GeneratedArticle;
  provider: 'gemini' | 'groq';
  /** Modelo que de fato gerou o artigo — gravado em `Article.modelVersion`. */
  modelVersion: string;
  /**
   * O erro do Gemini quando foi o Groq que entregou.
   *
   * Até a verificação pós-merge da Fase 4 ele só sobrevivia ao **fallback que
   * também falhava** (`withPrimaryError`, abaixo); no dia bom — Gemini em 503,
   * Groq salvando — restava uma linha de `warn` no stdout do Render, e o
   * `DailyMetric.aiProvider`. É justamente a degradação mais frequente medida
   * neste projeto (dois dias seguidos em 02–03/09), e não tinha registro
   * durável. O pipeline o grava como `WARN` da etapa 6.
   */
  primaryError?: unknown;
}

export async function generateArticle(
  newsItems: RawNewsItem[],
): Promise<GenerateArticleResult> {
  try {
    const article = await generateArticleWithGemini(newsItems);
    return { article, provider: 'gemini', modelVersion: env.GEMINI_MODEL };
  } catch (geminiError) {
    baseLogger.warn({ err: geminiError }, 'Gemini provider failed, falling back to Groq');
    try {
      const article = await generateArticleWithGroq(newsItems);
      return {
        article,
        provider: 'groq',
        modelVersion: env.GROQ_MODEL,
        primaryError: geminiError,
      };
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
