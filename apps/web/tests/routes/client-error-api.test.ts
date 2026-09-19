import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { POST } from '@/app/api/errors/client/route';

/**
 * **A segunda rota anônima do BFF, e as mesmas três coisas que a primeira
 * protege: nada de identidade atravessa, o status da API atravessa, e a
 * falha do repasse não vaza o porquê.**
 *
 * O relato de um error boundary (Fase 7c, §11.3) vira uma linha do
 * `ErrorEvent`, que não tem dado pessoal em coluna nenhuma. Um `userId` ou um
 * cookie que passasse por aqui "para achar quem viu o erro" mudaria a
 * natureza da tabela inteira. O outro lado — o schema da API descartando o que
 * não declara — está em `apps/api`, e é lá que tem de estar: esta rota
 * **repassa** o corpo, não o valida.
 *
 * O fonte sem comentário, pelo mesmo motivo do `events-anonymity.test.ts`:
 * a rota explica no JSDoc por que **não** usa `proxyToApi`, e um regex sobre
 * o arquivo cru leria a frase como uso.
 */
const ROUTE_SOURCE = readFileSync(join(__dirname, '../../app/api/errors/client/route.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const REPORT = JSON.stringify({ message: 'boom', digest: '1234567890', path: '/pt-BR/news' });

function request(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost:3000/api/errors/client', {
    method: 'POST',
    body: REPORT,
    headers,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/errors/client do BFF — anonimato', () => {
  it('does not import anything that resolves an identity', () => {
    expect(ROUTE_SOURCE).not.toMatch(/getServerSession|signAuthJwt|authOptions/);
    expect(ROUTE_SOURCE).not.toMatch(/from 'next\/headers'|cookies\(\)/);
  });

  it('does not use proxyToApi — that one demands a session by design', () => {
    expect(ROUTE_SOURCE).not.toMatch(/proxyToApi/);
  });

  it('forwards only the body and a content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 202,
      json: vi.fn().mockResolvedValue({ data: { accepted: true } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await POST(
      request({
        cookie: 'next-auth.session-token=nao-pode-passar',
        'x-forwarded-for': '203.0.113.7',
        'user-agent': 'Mozilla/5.0',
        authorization: 'Bearer nao-pode-passar',
        'x-request-id': 'nao-correlaciona-conta-nenhuma',
      }),
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(url).toMatch(/\/errors\/client$/);
    expect(init.method).toBe('POST');
    expect(init.body).toBe(REPORT);
    // Cookie, IP, agente, `authorization` e `x-request-id`: nenhum atravessa.
    // O IP ficar de fora é o que faz o balde da API ser um só para o site —
    // decidido lá, com o motivo escrito.
    expect(Object.keys(headers).map((key) => key.toLowerCase())).toEqual(['content-type']);
  });
});

describe('POST /api/errors/client do BFF — o status atravessa', () => {
  it.each([202, 400, 429])('passes the API status %i through, body included', async (status) => {
    // O 429 é o único código que o reporter tem motivo para ver: é o balde da
    // API dizendo que o relato não entrou. Traduzi-lo para 200 esconderia o
    // gatilho numérico da fase de quem olha o navegador.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status,
        json: vi.fn().mockResolvedValue({ echoed: status }),
      }),
    );

    const res = await POST(request());

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ echoed: status });
  });

  it('answers 502 without leaking why, when the API does not respond', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED 1.2.3.4')));

    const res = await POST(request());

    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('ECONNREFUSED');
  });

  it('gives the relay a deadline — nobody is waiting, and the function must not either', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 202,
      json: vi.fn().mockResolvedValue({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await POST(request());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
