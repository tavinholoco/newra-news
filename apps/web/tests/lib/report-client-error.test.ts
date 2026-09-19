import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrictMode } from 'react';
import { renderHook } from '@testing-library/react';
import {
  CLIENT_ERROR_DIGEST_MAX_LENGTH,
  CLIENT_ERROR_MESSAGE_MAX_LENGTH,
  type ClientErrorReport,
} from '@newranews/types';
import { reportClientError, useReportClientError } from '@/lib/report-client-error';

/**
 * O reporter dos error boundaries (§11.2 do plano de observabilidade, Fase
 * 7b). Fala com o BFF anônimo da 7c (`/api/errors/client`), e o que se cobra
 * dele é o que um módulo dentro de um boundary **não pode** fazer: lançar.
 * Uma segunda exceção dentro do boundary é a falha dupla que não renderiza
 * nada.
 */

const fetchMock = vi.fn();

function lastBody(): ClientErrorReport {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  return JSON.parse((call[1] as RequestInit).body as string) as ClientErrorReport;
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 202 }));
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState(null, '', '/pt-BR/news/3f2a1b4c-0000-4000-8000-000000000000');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('reportClientError', () => {
  it('posts the ClientErrorReport to the anonymous BFF door with keepalive', () => {
    reportClientError({ message: 'routes is null', digest: '1234567890' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/errors/client');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(lastBody()).toEqual({
      message: 'routes is null',
      digest: '1234567890',
      path: '/pt-BR/news/3f2a1b4c-0000-4000-8000-000000000000',
    });
  });

  it('leaves the digest out when the error has none — a client render error arrives without it', () => {
    reportClientError(new Error('boom'));

    expect(lastBody()).toEqual({ message: 'boom', path: expect.any(String) });
    expect('digest' in lastBody()).toBe(false);
  });

  it('sends the pathname only — never the query string or the fragment', () => {
    window.history.replaceState(null, '', '/pt-BR/news?search=leitor%40exemplo.com#topo');

    reportClientError(new Error('boom'));

    expect(lastBody().path).toBe('/pt-BR/news');
  });

  it('truncates to the ceilings the API enforces, so the report is never a 400', () => {
    reportClientError({
      message: 'x'.repeat(CLIENT_ERROR_MESSAGE_MAX_LENGTH + 50),
      digest: 'd'.repeat(CLIENT_ERROR_DIGEST_MAX_LENGTH + 10),
    });

    expect(lastBody().message).toHaveLength(CLIENT_ERROR_MESSAGE_MAX_LENGTH);
    expect(lastBody().digest).toHaveLength(CLIENT_ERROR_DIGEST_MAX_LENGTH);
  });

  it('never sends an empty message — the schema requires one character', () => {
    reportClientError({ message: '   ' });

    expect(lastBody().message.length).toBeGreaterThan(0);
  });

  it('does not throw when fetch rejects', () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    expect(() => reportClientError(new Error('boom'))).not.toThrow();
  });

  it('does not throw when fetch throws synchronously', () => {
    fetchMock.mockImplementation(() => {
      throw new TypeError('not a function');
    });

    expect(() => reportClientError(new Error('boom'))).not.toThrow();
  });

  it('is a no-op without fetch, instead of a second exception inside the boundary', () => {
    vi.stubGlobal('fetch', undefined);

    expect(() => reportClientError(new Error('boom'))).not.toThrow();
  });

  it('is a no-op without a window — the boundary can be rendered on the server', () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error — simula o ambiente sem DOM; jsdom não deixa apagar a propriedade
    globalThis.window = undefined;
    try {
      expect(() => reportClientError(new Error('boom'))).not.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.window = originalWindow;
    }
  });
});

describe('useReportClientError', () => {
  it('reports once per mount, even under StrictMode', () => {
    /**
     * O StrictMode monta duas vezes em desenvolvimento; sem a guarda do
     * `useRef` todo erro contaria dois em `pnpm dev` — a mesma razão do
     * `PageView`. `reset()` remonta o boundary, e aí o mesmo erro no retry
     * **é** um relato novo, coalescido na mesma linha pela API.
     */
    const error = Object.assign(new Error('boom'), { digest: '42' });

    const { rerender } = renderHook(() => useReportClientError(error), {
      wrapper: StrictMode,
    });
    rerender();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(lastBody()).toMatchObject({ message: 'boom', digest: '42' });
  });

  it('reports again when the boundary is mounted again', () => {
    const error = new Error('boom');

    const first = renderHook(() => useReportClientError(error));
    first.unmount();
    renderHook(() => useReportClientError(error));

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
