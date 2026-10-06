import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchApi, fetchApiDeadlineMs } from '@/lib/api';
import { API_RENDER_TIMEOUT_MS, API_TIMEOUT_MS } from '@/lib/timeouts';

/**
 * **No navegador o prazo continua curto.** O de 60 s existe para a
 * renderização no servidor, onde a página gerada fica guardada e só o primeiro
 * visitante depois de um silêncio espera; quem filtra o acervo numa tela não
 * espera um minuto, e ali o TanStack Query repete. Este arquivo roda no
 * `jsdom` (há `window`); o caminho do servidor está em `api-retry.test.ts`.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchApi — o prazo do navegador', () => {
  it('keeps the short deadline when there is a window', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );

    await fetchApi('/news');

    expect(fetchApiDeadlineMs()).toBe(API_TIMEOUT_MS);
    expect(timeoutSpy).toHaveBeenCalledWith(API_TIMEOUT_MS);
    expect(timeoutSpy).not.toHaveBeenCalledWith(API_RENDER_TIMEOUT_MS);
  });
});
