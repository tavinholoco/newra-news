import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Category } from '@newranews/database';
import { generateArticle } from '../../src/services/ai.service';

vi.mock('../../src/providers/ai/gemini.provider');
vi.mock('../../src/providers/ai/groq.provider');

import { generateArticleWithGemini } from '../../src/providers/ai/gemini.provider';
import { generateArticleWithGroq } from '../../src/providers/ai/groq.provider';

const mockGeneratedArticle = {
  title: 'Artigo Gerado',
  summary: 'Resumo do artigo.',
  content: 'Conteúdo completo do artigo.',
};

const mockNewsItems = [
  {
    title: 'Notícia de Teste',
    description: 'Descrição da notícia',
    content: 'Conteúdo da notícia',
    source: 'G1',
    sourceUrl: 'https://g1.globo.com/test',
    imageUrl: null,
    category: Category.TECHNOLOGY,
    publishedAt: new Date('2024-01-01T12:00:00Z'),
  },
];

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AiService', () => {
  it('should generate article using Gemini', async () => {
    vi.mocked(generateArticleWithGemini).mockResolvedValue(mockGeneratedArticle);

    const result = await generateArticle(mockNewsItems);

    expect(result.provider).toBe('gemini');
    expect(result.article).toEqual(mockGeneratedArticle);
    expect(generateArticleWithGemini).toHaveBeenCalledWith(mockNewsItems);
    expect(generateArticleWithGroq).not.toHaveBeenCalled();
  });

  it('should fallback to Groq when Gemini fails', async () => {
    vi.mocked(generateArticleWithGemini).mockRejectedValue(new Error('Gemini API error'));
    vi.mocked(generateArticleWithGroq).mockResolvedValue(mockGeneratedArticle);

    const result = await generateArticle(mockNewsItems);

    expect(result.provider).toBe('groq');
    expect(result.article).toEqual(mockGeneratedArticle);
    expect(generateArticleWithGemini).toHaveBeenCalledWith(mockNewsItems);
    expect(generateArticleWithGroq).toHaveBeenCalledWith(mockNewsItems);
  });

  it('should throw when both providers fail', async () => {
    vi.mocked(generateArticleWithGemini).mockRejectedValue(new Error('Gemini API error'));
    vi.mocked(generateArticleWithGroq).mockRejectedValue(new Error('Groq API error'));

    await expect(generateArticle(mockNewsItems)).rejects.toThrow('Groq API error');
  });
});
