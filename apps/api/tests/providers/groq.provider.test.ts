import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Category } from '@newranews/database';
import { generateArticleWithGroq } from '../../src/providers/ai/groq.provider';

vi.mock('../../src/config/env', () => ({
  env: {
    GROQ_API_KEY: 'test-groq-api-key',
    GROQ_MODEL: 'openai/gpt-oss-20b',
  },
}));

const MOCK_MARKDOWN = `# Título do Artigo de Teste

Este é o primeiro parágrafo com o resumo do artigo.

## Seção Principal

Conteúdo detalhado do artigo aqui, com a extensão que um briefing de verdade tem. O parser passou a recusar resposta curta demais na revisão da Fase 9, porque resposta curta é o formato de uma recusa do modelo ou do eco de uma instrução vinda no material — e não o de um artigo. O texto abaixo existe só para o fixture cruzar esse piso sem depender de número mágico espalhado pelos testes.`;

function makeFetchMock(markdown = MOCK_MARKDOWN) {
  return vi.fn().mockResolvedValue(successResponse(markdown));
}

function successResponse(markdown = MOCK_MARKDOWN) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      choices: [{ message: { content: markdown } }],
    }),
  };
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
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.stubGlobal('fetch', makeFetchMock());
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
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
    expect(body.model).toBe('openai/gpt-oss-20b');
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

  it('should throw when response is not ok (permanent error, no retry)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }),
    );

    await expect(generateArticleWithGroq(mockNewsItems)).rejects.toThrow(
      'Groq API error: 404 Not Found',
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

  it('should retry on transient 429 and succeed on the second attempt', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      })
      .mockResolvedValueOnce(successResponse());
    vi.stubGlobal('fetch', mockFetch);

    const promise = generateArticleWithGroq(mockNewsItems);
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(promise).resolves.toHaveProperty('title');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should retry multiple transient failures and succeed', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      })
      .mockResolvedValueOnce(successResponse());
    vi.stubGlobal('fetch', mockFetch);

    const promise = generateArticleWithGroq(mockNewsItems);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(promise).resolves.toHaveProperty('title');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should throw after exhausting retries on persistent 5xx', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });
    vi.stubGlobal('fetch', mockFetch);

    const promise = generateArticleWithGroq(mockNewsItems);
    // Anexa a asserção antes de avançar os timers para evitar unhandled rejection
    // (a rejeição acontece durante o advanceTimersByTimeAsync).
    const assertion = expect(promise).rejects.toThrow('Groq API error: 503 Service Unavailable');
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(2_000);

    await assertion;
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should not retry on permanent 400 error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(generateArticleWithGroq(mockNewsItems)).rejects.toThrow(
      'Groq API error: 400 Bad Request',
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should retry when the request times out (AbortError)', async () => {
    const abortError = new Error('The operation was aborted due to timeout');
    abortError.name = 'AbortError';
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(abortError)
      .mockResolvedValueOnce(successResponse());
    vi.stubGlobal('fetch', mockFetch);

    const promise = generateArticleWithGroq(mockNewsItems);
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(promise).resolves.toHaveProperty('title');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should honor the Retry-After header from 429 responses instead of the fixed backoff', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'retry-after': '5' }),
      })
      .mockResolvedValueOnce(successResponse());
    vi.stubGlobal('fetch', mockFetch);

    const promise = generateArticleWithGroq(mockNewsItems);
    // Backoff fixo seria 1000ms; com Retry-After: 5s a 2ª tentativa só sai aos 5000ms.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4_000);
    await expect(promise).resolves.toHaveProperty('title');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
