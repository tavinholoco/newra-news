import { generateArticleWithGemini } from '../providers/gemini.provider';
import { generateArticleWithGroq } from '../providers/groq.provider';
import type { RawNewsItem, GeneratedArticle } from '../providers/types';

export interface GenerateArticleResult {
  article: GeneratedArticle;
  provider: 'gemini' | 'groq';
}

export async function generateArticle(
  newsItems: RawNewsItem[],
): Promise<GenerateArticleResult> {
  try {
    const article = await generateArticleWithGemini(newsItems);
    return { article, provider: 'gemini' };
  } catch (geminiError) {
    console.warn('Gemini provider failed, falling back to Groq:', geminiError);
    const article = await generateArticleWithGroq(newsItems);
    return { article, provider: 'groq' };
  }
}
