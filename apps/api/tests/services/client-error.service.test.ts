import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recordClientError } from '../../src/services/client-error.service';
import {
  CLIENT_ERROR_CODE,
  pendingErrorEvents,
  resetErrorEventBuffer,
} from '../../src/services/error-event.service';
import { UNMATCHED_ROUTE } from '../../src/utils/request-route';

/**
 * **O relato do cliente entra no `ErrorEvent` com a forma que o teto exige.**
 *
 * As quatro peças do fingerprint são de conjunto finito, e a única que o
 * cliente influencia — o `route` — passa pelo normalizador antes. O que o
 * cliente escreve de fato (`message`, `digest`, `path`) vai para onde não é
 * identidade: a mensagem da linha e o `context`.
 */

vi.mock('@newranews/database', async () => {
  const actual = await vi.importActual<typeof import('@newranews/database')>(
    '@newranews/database',
  );
  return { ...actual, prisma: { errorEvent: { upsert: vi.fn().mockResolvedValue({}) } } };
});

const NEWS_ID = '3f2a9c1e-7b4d-4e8a-9c2b-1d5e6f7a8b9c';

beforeEach(() => {
  resetErrorEventBuffer();
});

describe('recordClientError', () => {
  it('records a WEB/ERROR line keyed by the page pattern, never by the raw path', () => {
    recordClientError(
      { message: 'Cannot read properties of undefined', digest: '1234567890', path: `/pt-BR/news/${NEWS_ID}` },
      'req-ingest',
    );

    const [entry] = pendingErrorEvents();
    expect(entry).toMatchObject({
      origin: 'WEB',
      severity: 'ERROR',
      code: CLIENT_ERROR_CODE,
      category: 'internal',
      route: '/[locale]/news/[id]',
      statusCode: null,
      firstRequestId: 'req-ingest',
      count: 1,
    });
    expect(entry?.fingerprint).toBe('WEB:ERROR:CLIENT_ERROR:/[locale]/news/[id]');
    expect(entry?.fingerprint).not.toContain(NEWS_ID);
  });

  it('keeps digest and raw path in the context — diagnosis, not identity', () => {
    recordClientError(
      { message: 'boom', digest: '1234567890', path: `/pt-BR/news/${NEWS_ID}` },
      null,
    );

    expect(pendingErrorEvents()[0]?.context).toEqual({
      digest: '1234567890',
      path: `/pt-BR/news/${NEWS_ID}`,
    });
  });

  it('writes digest: null when the crash happened in the browser and there is none', () => {
    // O `digest` só existe em erro de server component. Sem ele, o `path` é o
    // único ponteiro — e `null` explícito é o que diz "não havia", em vez de
    // deixar a chave sumir do JSON.
    recordClientError({ message: 'boom', path: '/pt-BR/news' }, null);

    expect(pendingErrorEvents()[0]?.context).toEqual({ digest: null, path: '/pt-BR/news' });
  });

  it('coalesces two different errors on the same page into one line per hour', () => {
    // O teto vale mais que a distinção: a linha fica com a mensagem da
    // primeira, e o `count` diz quantas vezes a página caiu.
    recordClientError({ message: 'first', path: `/pt-BR/news/${NEWS_ID}` }, 'req-1');
    recordClientError({ message: 'second', path: `/en/news/${NEWS_ID}` }, 'req-2');

    const pending = pendingErrorEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.count).toBe(2);
    expect(pending[0]?.message).toBe('first');
    expect(pending[0]?.lastRequestId).toBe('req-2');
  });

  it('separates two pages', () => {
    recordClientError({ message: 'boom', path: '/pt-BR/news' }, null);
    recordClientError({ message: 'boom', path: '/pt-BR/article' }, null);

    expect(pendingErrorEvents().map((entry) => entry.route).sort()).toEqual([
      '/[locale]/article',
      '/[locale]/news',
    ]);
  });

  it('sends a path that is no page to the unmatched bucket, and keeps the raw path aside', () => {
    recordClientError({ message: 'boom', path: '/pt-BR/news/minha-noticia' }, null);

    const [entry] = pendingErrorEvents();
    expect(entry?.route).toBe(UNMATCHED_ROUTE);
    expect(entry?.context).toMatchObject({ path: '/pt-BR/news/minha-noticia' });
  });

  it('redacts what the browser put in the message before it reaches the buffer', () => {
    // `message` é texto do navegador: um estado de formulário com e-mail, uma
    // URL com token. O redator do logger é quem limita o conteúdo — o schema
    // da rota só limita a forma.
    recordClientError(
      {
        message: 'Failed to save leitor@example.com with token Bearer abc.def.ghi',
        path: '/pt-BR/account',
      },
      null,
    );

    const [entry] = pendingErrorEvents();
    expect(entry?.message).not.toContain('leitor@example.com');
    expect(entry?.message).not.toContain('abc.def.ghi');
  });

  it('is synchronous and never throws', () => {
    expect(() =>
      recordClientError({ message: 'boom', path: '/pt-BR' }, undefined as never),
    ).not.toThrow();
  });
});
