import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { proxyToApi } from '@/lib/api-proxy';
import {
  API_TIMEOUT_MS,
  BFF_TIMEOUT_MS,
  PIPELINE_TRIGGER_TIMEOUT_MS,
} from '@/lib/timeouts';

/**
 * **A costura entre as duas metades: prazo, corpo de erro e correlação.**
 *
 * As três coisas que a §11.2 foi cobrar, e as três eram a mesma ausência:
 * ninguém tinha decidido em quanto tempo desistir. Sem prazo, uma API dormindo
 * — o plano free do Render hiberna com ~15 min sem tráfego — segurava a função
 * da Vercel até o limite dela, e o navegador ficava com uma requisição que
 * nunca termina. Nenhuma tela sabe desenhar isso, porque não é um estado: é a
 * ausência de um.
 *
 * A metade difícil já estava feita desde a Fase 10: o `ApiError` separa "a API
 * não respondeu" de "a API disse não". Estourar o prazo cai no primeiro caso,
 * que é literalmente o que aconteceu.
 */

const WEB_ROOT = join(__dirname, '../..');

/** Onde há `fetch` de rede neste app: o cliente HTTP e as rotas de BFF. */
const SCANNED_DIRS = [join(WEB_ROOT, 'lib'), join(WEB_ROOT, 'app', 'api')];

/**
 * Chamadas sem `signal`, e por quê.
 *
 * A linha que decide é **quem espera a resposta**. Onde alguém espera — o
 * servidor do Next renderizando uma página, o navegador esperando uma tela —,
 * não desistir é pendurar a espera até o teto da plataforma. Onde ninguém
 * espera, o prazo não protege nada e pode atrapalhar.
 *
 * `lib/analytics/index.ts` é o segundo caso, e o único: é o `fetch` de reserva
 * do `sendBeacon`, com `keepalive: true`. Ele existe justamente para **sobreviver
 * à navegação** — abortá-lo por prazo seria cancelar a entrega que o `keepalive`
 * foi criado para garantir. Ninguém lê o resultado (`track()` engole a falha por
 * desenho), e ele roda no navegador, não numa função. Fora daqui, o mesmo lote
 * já atravessa o `POST /api/events`, que **tem** prazo — a perna que roda numa
 * função é a que precisa dele.
 */
const WITHOUT_TIMEOUT: Record<string, string> = {
  'lib/analytics/index.ts':
    'fetch de reserva do sendBeacon, com keepalive: abortar cancelaria a entrega que ele existe para garantir',
};

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory()
      ? collectFiles(full)
      : /\.tsx?$/.test(full)
        ? [full]
        : [];
  });
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * O corpo de cada `fetch(...)`, com os parênteses balanceados.
 *
 * Recortar a chamada inteira é o que permite perguntar "esta tem `signal`?" em
 * vez de "o arquivo menciona `signal` em algum lugar?" — a segunda pergunta
 * passaria verde num arquivo com duas chamadas e um timeout só.
 */
function fetchCalls(source: string): string[] {
  const calls: string[] = [];

  for (const match of source.matchAll(/\bfetch\s*\(/g)) {
    let depth = 1;
    let index = (match.index ?? 0) + match[0].length;
    const start = index;

    while (index < source.length && depth > 0) {
      const char = source[index];
      if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
      index += 1;
    }

    calls.push(source.slice(start, index - 1));
  }

  return calls;
}

function relativePath(file: string): string {
  return file.replace(/\\/g, '/').split('/apps/web/')[1] ?? file;
}

describe('BFF — o prazo de desistir', () => {
  it('declares a timeout on every network fetch', () => {
    const offenders = SCANNED_DIRS.flatMap(collectFiles)
      .flatMap((file) => {
        const source = stripComments(readFileSync(file, 'utf8'));
        return fetchCalls(source)
          .filter((call) => !/\bsignal\s*:/.test(call))
          .map(() => relativePath(file));
      })
      .filter((file) => !(file in WITHOUT_TIMEOUT));

    expect([...new Set(offenders)]).toEqual([]);
  });

  it('finds fetch calls at all — a parser that returns nothing would pass everything', () => {
    const calls = SCANNED_DIRS.flatMap(collectFiles).flatMap((file) =>
      fetchCalls(stripComments(readFileSync(file, 'utf8'))),
    );

    expect(calls.length).toBeGreaterThan(5);
    expect(calls.filter((call) => /\bsignal\s*:/.test(call)).length).toBeGreaterThan(4);
  });

  it('does not carry an exception for a file that no longer calls fetch', () => {
    const withFetch = new Set(
      SCANNED_DIRS.flatMap(collectFiles)
        .filter((file) => fetchCalls(stripComments(readFileSync(file, 'utf8'))).length > 0)
        .map(relativePath),
    );

    expect(Object.keys(WITHOUT_TIMEOUT).filter((file) => !withFetch.has(file))).toEqual(
      [],
    );
  });

  it('keeps the inner deadline strictly shorter than the outer one', () => {
    // Se as duas pernas desistissem juntas, quem estoura primeiro seria
    // imprevisível — e o navegador receberia uma requisição abortada, sem
    // status e sem corpo. Com o interno menor, é sempre o BFF que sobrevive
    // para devolver uma resposta que a tela sabe ler.
    expect(API_TIMEOUT_MS).toBeLessThan(BFF_TIMEOUT_MS);
  });

  it('keeps the API deadline above the measured cold start and under the function ceiling', () => {
    // 4,9 s foi o cold start medido na auditoria da Fase 8; 10 s é o teto da
    // função no plano Hobby da Vercel. Um prazo fora dessa faixa troca uma
    // espera por uma falha, ou entrega a decisão para a plataforma.
    expect(API_TIMEOUT_MS).toBeGreaterThan(4_900);
    expect(API_TIMEOUT_MS).toBeLessThan(10_000);
    expect(PIPELINE_TRIGGER_TIMEOUT_MS).toBeLessThan(30_000);
  });
});

const getServerSessionMock = vi.fn();
const signAuthJwtMock = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: () => getServerSessionMock(),
}));

vi.mock('@/lib/jwt', () => ({
  signAuthJwt: (payload: unknown) => signAuthJwtMock(payload),
}));

beforeEach(() => {
  getServerSessionMock.mockReset();
  signAuthJwtMock.mockReset();
  signAuthJwtMock.mockResolvedValue('signed-jwt');
  getServerSessionMock.mockResolvedValue({
    user: { id: 'user-1', email: 'user@test.com', role: 'USER' },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BFF — o que o proxy repassa e o que ele devolve', () => {
  it('answers 502 with the shared error shape when the API never responds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')),
    );

    const res = await proxyToApi(
      new Request('http://localhost:3000/api/account'),
      '/account',
    );

    // 502 e não 500: quem falhou foi o repasse, não esta rota.
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Upstream API unavailable' });
  });

  it('never answers with a null body', async () => {
    // Era o que acontecia com resposta não-JSON: `NextResponse.json(null)`,
    // status certo e corpo `null` — nenhuma tela com o que dizer.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: vi.fn().mockRejectedValue(new SyntaxError('not json')),
      }),
    );

    const res = await proxyToApi(
      new Request('http://localhost:3000/api/account'),
      '/account',
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'Upstream API returned 503' });
  });

  it('forwards the incoming x-request-id', async () => {
    // A API respeita o `x-request-id` de quem chama e o ecoa em toda resposta
    // desde a Fase 9 — é ele que liga um relato de fora à linha do log. O BFF
    // não o enviava, então cada perna da mesma chamada tinha um id diferente.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await proxyToApi(
      new Request('http://localhost:3000/api/account', {
        headers: { 'x-request-id': 'prova-da-fase-11' },
      }),
      '/account',
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-request-id']).toBe(
      'prova-da-fase-11',
    );
  });

  it('does not invent a request id when none came in', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await proxyToApi(new Request('http://localhost:3000/api/account'), '/account');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // Gerar um aqui daria um id que não existe em log nenhum: quem gera, quando
    // não vem, é a API (`genReqId`), e ela o devolve no cabeçalho.
    expect(init.headers as Record<string, string>).not.toHaveProperty(
      'x-request-id',
    );
  });

  it('never caches a per-user response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await proxyToApi(new Request('http://localhost:3000/api/favorites'), '/favorites');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.cache).toBe('no-store');
  });

  it('refuses a reader on an admin route before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await proxyToApi(
      new Request('http://localhost:3000/api/admin/metrics'),
      '/metrics/dashboard',
      'GET',
      { requireRole: 'ADMIN' },
    );

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('signs the role only where the route asks for it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ data: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);
    getServerSessionMock.mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' },
    });

    await proxyToApi(
      new Request('http://localhost:3000/api/account'),
      '/account',
    );
    expect(signAuthJwtMock).toHaveBeenLastCalledWith({
      sub: 'admin-1',
      email: 'admin@test.com',
    });

    await proxyToApi(
      new Request('http://localhost:3000/api/admin/metrics'),
      '/metrics/dashboard',
      'GET',
      { requireRole: 'ADMIN' },
    );
    expect(signAuthJwtMock).toHaveBeenLastCalledWith({
      sub: 'admin-1',
      email: 'admin@test.com',
      role: 'ADMIN',
    });
  });
});
