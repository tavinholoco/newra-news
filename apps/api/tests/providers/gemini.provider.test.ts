import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Category } from '@newranews/database';
import { generateArticleWithGemini } from '../../src/providers/ai/gemini.provider';

vi.mock('../../src/config/env', () => ({
  env: {
    GEMINI_API_KEY: 'test-api-key',
    GEMINI_MODEL: 'gemini-2.5-flash',
  },
}));

const MOCK_MARKDOWN = `# Título do Artigo de Teste

Este é o primeiro parágrafo com o resumo do artigo.

## Seção Principal

Conteúdo detalhado do artigo aqui.`;

function makeFetchMock(markdown = MOCK_MARKDOWN) {
  return vi.fn().mockResolvedValue(successResponse(markdown));
}

function successResponse(markdown = MOCK_MARKDOWN) {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue({
      candidates: [{ content: { parts: [{ text: markdown }] } }],
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

describe('generateArticleWithGemini', () => {
  it('should return a GeneratedArticle with title, summary and content', async () => {
    const result = await generateArticleWithGemini(mockNewsItems);

    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('content');
    expect(typeof result.title).toBe('string');
    expect(typeof result.summary).toBe('string');
    expect(typeof result.content).toBe('string');
  });

  it('should extract title from H1 heading', async () => {
    const result = await generateArticleWithGemini(mockNewsItems);

    expect(result.title).toBe('Título do Artigo de Teste');
  });

  it('should extract summary from first non-heading paragraph after title', async () => {
    const result = await generateArticleWithGemini(mockNewsItems);

    expect(result.summary).toBe('Este é o primeiro parágrafo com o resumo do artigo.');
  });

  it('should exclude the H1 line from content', async () => {
    const result = await generateArticleWithGemini(mockNewsItems);

    expect(result.content).not.toContain('# Título do Artigo de Teste');
    expect(result.content).toContain('## Seção Principal');
  });

  it('should call Gemini endpoint with correct URL and auth header', async () => {
    const mockFetch = makeFetchMock();
    vi.stubGlobal('fetch', mockFetch);

    await generateArticleWithGemini(mockNewsItems);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('gemini-2.5-flash');
    expect(calledUrl).not.toContain('key=');

    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = calledOptions.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe('test-api-key');
  });

  it('should include news item titles in the request body', async () => {
    const mockFetch = makeFetchMock();
    vi.stubGlobal('fetch', mockFetch);

    await generateArticleWithGemini(mockNewsItems);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    const userText = body.contents[0].parts[0].text as string;
    expect(userText).toContain('Notícia de Teste');
  });

  it('should throw with detailed error body when response is not ok', async () => {
    const errorJson = JSON.stringify({ error: { message: 'Model not found' } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue(errorJson),
      }),
    );

    await expect(generateArticleWithGemini(mockNewsItems)).rejects.toThrow(
      'Gemini API error 404:',
    );
    await expect(generateArticleWithGemini(mockNewsItems)).rejects.toThrow('Model not found');
  });

  it('should throw when candidates list is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ candidates: [] }),
      }),
    );

    await expect(generateArticleWithGemini(mockNewsItems)).rejects.toThrow(
      'Gemini returned empty response',
    );
  });

  it('should pass AbortSignal to fetch for timeout support', async () => {
    const mockFetch = makeFetchMock();
    vi.stubGlobal('fetch', mockFetch);

    await generateArticleWithGemini(mockNewsItems);

    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledOptions.signal).toBeInstanceOf(AbortSignal);
  });

  it('should retry on transient 429 and succeed on the second attempt', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('rate limited'),
      })
      .mockResolvedValueOnce(successResponse());
    vi.stubGlobal('fetch', mockFetch);

    const promise = generateArticleWithGemini(mockNewsItems);
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
        text: vi.fn().mockResolvedValue('internal error'),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue('unavailable'),
      })
      .mockResolvedValueOnce(successResponse());
    vi.stubGlobal('fetch', mockFetch);

    const promise = generateArticleWithGemini(mockNewsItems);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(promise).resolves.toHaveProperty('title');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should throw after exhausting retries on persistent 5xx', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue('unavailable'),
    });
    vi.stubGlobal('fetch', mockFetch);

    const promise = generateArticleWithGemini(mockNewsItems);
    // Anexa a asserção antes de avançar os timers para evitar unhandled rejection
    // (a rejeição acontece durante o advanceTimersByTimeAsync).
    const assertion = expect(promise).rejects.toThrow('Gemini API error 503:');
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(2_000);

    await assertion;
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should not retry on permanent 400 error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue('bad request'),
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(generateArticleWithGemini(mockNewsItems)).rejects.toThrow('Gemini API error 400:');
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

    const promise = generateArticleWithGemini(mockNewsItems);
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
        text: vi.fn().mockResolvedValue('rate limited'),
        headers: new Headers({ 'retry-after': '5' }),
      })
      .mockResolvedValueOnce(successResponse());
    vi.stubGlobal('fetch', mockFetch);

    const promise = generateArticleWithGemini(mockNewsItems);
    // Backoff fixo seria 1000ms; com Retry-After: 5s a 2ª tentativa só sai aos 5000ms.
    await vi.advanceTimersByTimeAsync(1_000);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4_000);
    await expect(promise).resolves.toHaveProperty('title');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should cap an excessive Retry-After header so the pipeline is not stalled', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('rate limited'),
        headers: new Headers({ 'retry-after': '3600' }),
      })
      .mockResolvedValueOnce(successResponse());
    vi.stubGlobal('fetch', mockFetch);

    const promise = generateArticleWithGemini(mockNewsItems);
    // Teto de 30s: aos 29s ainda não retentou...
    await vi.advanceTimersByTimeAsync(29_000);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    await expect(promise).resolves.toHaveProperty('title');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
