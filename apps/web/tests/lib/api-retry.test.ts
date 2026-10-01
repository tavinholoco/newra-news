// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError, fetchApi, retryDelayMs } from '@/lib/api';
import { API_RETRY_ATTEMPTS, API_RETRY_MAX_WAIT_MS } from '@/lib/timeouts';

/**
 * **O servidor do Next repete o pedido recusado por excesso** (01/10/2026).
 *
 * O build do #255 caiu duas vezes na Vercel com `429 Too Many Requests` em toda
 * página que chama a API, logo depois de ela acordar: o build manda umas vinte
 * requisições de uma vez contra um serviço frio. Este arquivo roda em `node`
 * de propósito — é o caminho do servidor; no navegador, quem repete é o
 * TanStack Query.
 */

const response = (status: number, body: unknown = {}, retryAfter?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: retryAfter ? { 'retry-after': retryAfter } : {},
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchApi — repetição no servidor', () => {
  it('retries a 429 and returns the answer that follows', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const pending = fetchApi<{ ok: boolean }>('/home');
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a 503 too — the service still coming up', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const pending = fetchApi('/home');
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toEqual({ ok: true });
  });

  it('gives up after the last attempt and throws the status', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(async () => response(429));
    vi.stubGlobal('fetch', fetchMock);

    const pending = fetchApi('/home').catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    const error = (await pending) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(API_RETRY_ATTEMPTS + 1);
  });

  it('does not retry an answer about the request — a 404 is final', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(404));
    vi.stubGlobal('fetch', fetchMock);

    const error = (await fetchApi('/news/x').catch((e: unknown) => e)) as ApiError;

    expect(error.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('retryDelayMs', () => {
  it('honours a Retry-After in seconds', () => {
    expect(retryDelayMs(0, '3')).toBe(3_000);
  });

  it('grows when there is no Retry-After', () => {
    expect(retryDelayMs(1, null)).toBeGreaterThan(retryDelayMs(0, null));
  });

  it('never waits past the cap — a Retry-After of an hour would hold the build', () => {
    expect(retryDelayMs(0, '3600')).toBe(API_RETRY_MAX_WAIT_MS);
    expect(retryDelayMs(10, null)).toBe(API_RETRY_MAX_WAIT_MS);
  });
});
