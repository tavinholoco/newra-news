import { createHash } from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Category } from '@newranews/database';
import { generateArticle } from '../../src/services/ai.service';
import { env } from '../../src/config/env';
import {
  ARTICLE_PROMPT_VERSION,
  ARTICLE_SYSTEM_PROMPT,
  ARTICLE_USER_PROMPT,
  ARTICLE_USER_PROMPT_SUFFIX,
} from '../../src/config/ai-prompts';

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

  it('should carry the primary Gemini error when the Groq fallback also fails', async () => {
    const geminiError = new Error('Gemini API error 429: rate limited');
    vi.mocked(generateArticleWithGemini).mockRejectedValue(geminiError);
    vi.mocked(generateArticleWithGroq).mockRejectedValue(new Error('Groq API error: 404 Not Found'));

    const thrown = await generateArticle(mockNewsItems).catch((e: Error & { primaryError?: unknown }) => e);

    expect(thrown.message).toBe('Groq API error: 404 Not Found');
    // O erro final carrega o primário para o pipeline registrar os dois
    expect(thrown.primaryError).toBe(geminiError);
  });

  // Auditoria da geração (plano V2 §18.4): o artigo precisa registrar qual
  // modelo o gerou, e não basta o nome do provider — o modelo por trás dele
  // muda (o Groq trocou llama-3.1-8b-instant por openai/gpt-oss-20b em 08/2026).
  it('should report the Gemini model that generated the article', async () => {
    vi.mocked(generateArticleWithGemini).mockResolvedValue(mockGeneratedArticle);

    const result = await generateArticle(mockNewsItems);

    expect(result.provider).toBe('gemini');
    expect(result.modelVersion).toBe(env.GEMINI_MODEL);
  });

  it('should report the Groq model when the fallback generates the article', async () => {
    vi.mocked(generateArticleWithGemini).mockRejectedValue(new Error('Gemini down'));
    vi.mocked(generateArticleWithGroq).mockResolvedValue(mockGeneratedArticle);

    const result = await generateArticle(mockNewsItems);

    expect(result.provider).toBe('groq');
    expect(result.modelVersion).toBe(env.GROQ_MODEL);
  });
});

describe('ARTICLE_PROMPT_VERSION', () => {
  it('should be an epoch plus an 8-char content fingerprint', () => {
    expect(ARTICLE_PROMPT_VERSION).toMatch(/^v\d+-[0-9a-f]{8}$/);
  });

  it('should change when the prompt text changes', async () => {
    // A versão é derivada do conteúdo justamente para não depender de alguém
    // lembrar de subi-la à mão — uma versão manual esquecida mente sobre qual
    // prompt gerou o artigo. Este teste falha se o hash virar constante fixa.
    const digest = createHash('sha256')
      .update(ARTICLE_SYSTEM_PROMPT)
      .update(ARTICLE_USER_PROMPT)
      .update(ARTICLE_USER_PROMPT_SUFFIX)
      .digest('hex')
      .slice(0, 8);

    expect(ARTICLE_PROMPT_VERSION.endsWith(digest)).toBe(true);

    const otherDigest = createHash('sha256')
      .update(`${ARTICLE_SYSTEM_PROMPT} alterado`)
      .update(ARTICLE_USER_PROMPT)
      .update(ARTICLE_USER_PROMPT_SUFFIX)
      .digest('hex')
      .slice(0, 8);

    expect(otherDigest).not.toBe(digest);
  });

  it('should change when the closing delimiter of the material changes', () => {
    // O sufixo entra no hash porque ele **e** parte do prompt: e a linha que
    // fecha o bloco do material. Se ele saisse do calculo, mexer na fronteira
    // — que e uma mudanca de seguranca — nao mudaria a versao gravada, e dois
    // briefings gerados sob regras diferentes ficariam indistinguiveis.
    const withoutSuffix = createHash('sha256')
      .update(ARTICLE_SYSTEM_PROMPT)
      .update(ARTICLE_USER_PROMPT)
      .digest('hex')
      .slice(0, 8);

    expect(ARTICLE_PROMPT_VERSION.endsWith(withoutSuffix)).toBe(false);
  });
});
