import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkNewsData,
  checkGemini,
  checkGroq,
  checkAllProviders,
} from '../../src/services/health.service';
import { env } from '../../src/config/env';
import { baseLogger } from '../../src/utils/logger';

vi.mock('../../src/config/env', () => ({
  env: {
    NEWSDATA_API_KEY: 'test-newsdata-key',
    GEMINI_API_KEY: 'test-gemini-key',
    GROQ_API_KEY: 'test-groq-key',
  },
}));

function makeFetchMock(overrides: Partial<Response> = {}) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ status: 'success' }),
    ...overrides,
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', makeFetchMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
  env.NEWSDATA_API_KEY = 'test-newsdata-key';
  env.GEMINI_API_KEY = 'test-gemini-key';
  env.GROQ_API_KEY = 'test-groq-key';
});

describe('checkNewsData', () => {
  it('should return ok when API responds with status success', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({ json: vi.fn().mockResolvedValue({ status: 'success' }) }),
    );

    await expect(checkNewsData()).resolves.toBe('ok');
  });

  it('should return invalid when HTTP 200 carries an error status in the body', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetchMock({
        json: vi.fn().mockResolvedValue({
          status: 'error',
          results: { message: 'The provided API key is not valid.', code: 'Unauthorized' },
        }),
      }),
    );

    await expect(checkNewsData()).resolves.toBe('invalid');
  });

  it('should return invalid on HTTP errors', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ ok: false, status: 429 }));

    await expect(checkNewsData()).resolves.toBe('invalid');
  });

  it('should return invalid when the request fails or times out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(checkNewsData()).resolves.toBe('invalid');
  });

  it('should return not_configured when the key is missing', async () => {
    env.NEWSDATA_API_KEY = undefined;

    await expect(checkNewsData()).resolves.toBe('not_configured');
  });

  it('should make a lightweight size=1 request', async () => {
    const mockFetch = makeFetchMock({
      json: vi.fn().mockResolvedValue({ status: 'success' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await checkNewsData();

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('newsdata.io/api/1/news');
    expect(url).toContain('size=1');
  });
});

describe('checkGemini', () => {
  it('should return ok when the models endpoint responds', async () => {
    await expect(checkGemini()).resolves.toBe('ok');
  });

  it('should return invalid on 401 or 403', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ ok: false, status: 401 }));

    await expect(checkGemini()).resolves.toBe('invalid');
  });

  it('should return invalid when the request fails or times out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(checkGemini()).resolves.toBe('invalid');
  });

  it('should return not_configured when the key is missing', async () => {
    env.GEMINI_API_KEY = undefined;

    await expect(checkGemini()).resolves.toBe('not_configured');
  });

  it('should pass the key as query param and not leak it in headers', async () => {
    const mockFetch = makeFetchMock();
    vi.stubGlobal('fetch', mockFetch);

    await checkGemini();

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('key=test-gemini-key');
  });
});

describe('checkGroq', () => {
  it('should return ok when the models endpoint responds', async () => {
    await expect(checkGroq()).resolves.toBe('ok');
  });

  it('should return invalid on 401', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ ok: false, status: 401 }));

    await expect(checkGroq()).resolves.toBe('invalid');
  });

  it('should return invalid when the request fails or times out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(checkGroq()).resolves.toBe('invalid');
  });

  it('should return not_configured when the key is missing', async () => {
    env.GROQ_API_KEY = undefined;

    await expect(checkGroq()).resolves.toBe('not_configured');
  });

  it('should authenticate with Bearer token', async () => {
    const mockFetch = makeFetchMock();
    vi.stubGlobal('fetch', mockFetch);

    await checkGroq();

    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
    const headers = calledOptions.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-groq-key');
  });
});

describe('checkAllProviders', () => {
  it('should return statuses for all three providers in parallel', async () => {
    const result = await checkAllProviders();

    expect(result).toEqual({
      newsdata: 'ok',
      gemini: 'ok',
      groq: 'ok',
    });
  });

  it('should not expose the API keys in the response', async () => {
    const result = await checkAllProviders();

    expect(JSON.stringify(result)).not.toContain('test-');
  });
});

describe('a sonda diz **por que** o provider nao respondeu', () => {
  /**
   * **`invalid` colapsava tres coisas com acoes opostas.**
   *
   * "chave recusada" (rotacione a chave), "provedor fora do ar" (espere) e
   * "timeout" (pode ser rede nossa) sao a mesma palavra no
   * `/api/health/providers` e no painel dev. O status na resposta **continua o
   * mesmo** — ele e contrato declarado, lido por schema —; o que muda e que a
   * razao passa a existir no log.
   */
  it('logs the network failure, naming the provider and keeping the cause', async () => {
    const warn = vi.spyOn(baseLogger, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(
        new Error('getaddrinfo ENOTFOUND newsdata.io', {
          cause: new Error('ENOTFOUND'),
        }),
      ),
    );

    expect(await checkNewsData()).toBe('invalid');

    const [fields] = warn.mock.calls[0] as [Record<string, unknown>, string];
    expect(fields.provider).toBe('newsdata');
    expect((fields.err as Error).message).toContain('ENOTFOUND');
  });

  /**
   * **A URL da sonda carrega a chave** (`?apikey=`, `?key=`), entao ela nao
   * entra no log — e o teste mede isso em vez de confiar no redator, que so
   * conhece o valor porque o `env` esta mockado aqui.
   */
  it('never puts the probe URL, and therefore the key, into the log', async () => {
    const warn = vi.spyOn(baseLogger, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));

    await checkNewsData();

    expect(JSON.stringify(warn.mock.calls)).not.toContain('test-newsdata-key');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('newsdata.io/api');
  });

  it('tells a rejected key apart from an unreachable provider', async () => {
    const warn = vi.spyOn(baseLogger, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    expect(await checkGemini()).toBe('invalid');

    const [fields] = warn.mock.calls[0] as [Record<string, unknown>, string];
    expect(fields.provider).toBe('gemini');
    // Chave recusada tem status; provider inalcancavel nao tem. E a distincao
    // que decide entre rotacionar a chave e esperar.
    expect(fields.statusCode).toBe(401);
  });

  it('says nothing when the provider answers fine', async () => {
    const warn = vi.spyOn(baseLogger, 'warn').mockImplementation(() => undefined);

    expect(await checkNewsData()).toBe('ok');

    expect(warn).not.toHaveBeenCalled();
  });
});
