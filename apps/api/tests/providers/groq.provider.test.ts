import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Category } from '@newranews/database';
import { generateArticleWithGroq } from '../../src/providers/ai/groq.provider';

vi.mock('../../src/config/env', () => ({
  env: {
    GROQ_API_KEY: 'test-groq-api-key',
    GROQ_MODEL: 'llama-3.1-8b-instant',
  },
}));

const MOCK_MARKDOWN = `# Título do Artigo de Teste

Este é o primeiro parágrafo com o resumo do artigo.

## Seção Principal

Conteúdo detalhado do artigo aqui.`;

function makeFetchMock(markdown = MOCK_MARKDOWN) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({
      choices: [{ message: { content: markdown } }],
    }),
  });
}

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
  vi.stubGlobal('fetch', makeFetchMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generateArticleWithGroq', () => {
  it('should return a GeneratedArticle with title, summary and content', async () => {
    const result = await generateArticleWithGroq(mockNewsItems);

    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('content');
    expect(typeof result.title).toBe('string');
    expect(typeof result.summary).toBe('string');
    expect(typeof result.content).toBe('string');
  });

  it('should extract title from H1 heading', async () => {
    const result = await generateArticleWithGroq(mockNewsItems);

    expect(result.title).toBe('Título do Artigo de Teste');
  });

  it('should extract summary from first non-heading paragraph after title', async () => {
    const result = await generateArticleWithGroq(mockNewsItems);

    expect(result.summary).toBe('Este é o primeiro parágrafo com o resumo do artigo.');
  });

  it('should exclude the H1 line from content', async () => {
    const result = await generateArticleWithGroq(mockNewsItems);

    expect(result.content).not.toContain('# Título do Artigo de Teste');
    expect(result.content).toContain('## Seção Principal');
  });

  it('should call Groq endpoint with correct URL, Authorization header and model', async () => {
    const mockFetch = makeFetchMock();
    vi.stubGlobal('fetch', mockFetch);

    await generateArticleWithGroq(mockNewsItems);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://api.groq.com/openai/v1/chat/completions');

    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = calledOptions.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-groq-api-key');

    const body = JSON.parse(calledOptions.body as string);
    expect(body.model).toBe('llama-3.1-8b-instant');
  });

  it('should include news item titles in the request body', async () => {
    const mockFetch = makeFetchMock();
    vi.stubGlobal('fetch', mockFetch);

    await generateArticleWithGroq(mockNewsItems);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    const userMessage = body.messages.find(
      (m: { role: string }) => m.role === 'user',
    ) as { role: string; content: string };
    expect(userMessage.content).toContain('Notícia de Teste');
  });

  it('should throw when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' }),
    );

    await expect(generateArticleWithGroq(mockNewsItems)).rejects.toThrow(
      'Groq API error: 500 Internal Server Error',
    );
  });

  it('should throw when choices list is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ choices: [] }),
      }),
    );

    await expect(generateArticleWithGroq(mockNewsItems)).rejects.toThrow(
      'Groq returned empty response',
    );
  });
});
