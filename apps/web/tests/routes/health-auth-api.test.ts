// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { jwtVerify } from 'jose';
import { GET, revalidate } from '@/app/api/health/auth/route';

/**
 * **A sonda do par de JWT, do lado da Vercel** — 13.7 do plano de
 * observabilidade, 09/10/2026.
 *
 * Os fluxos com login do Smoke ficam desligados por decisão do dono: pôr o
 * `NEXTAUTH_SECRET` de produção no CI daria a qualquer dependência
 * comprometida uma sessão de admin. O defeito que eles pegariam — a API
 * recusar a assinatura da Vercel, e todo leitor logado em 401 — é perguntado
 * aqui, com o `AUTH_JWT_SECRET` que já mora na Vercel, num token que só abre a
 * rota da sonda.
 */
const SECRET = 'probe-secret-for-tests';
const API = 'http://localhost:3001/api';

type Body = { ok: boolean; reason: string; status: number | null; checkedAt: string };

async function body(): Promise<{ status: number; data: Body }> {
  const res = await GET();
  return { status: res.status, data: (await res.json()) as Body };
}

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.AUTH_JWT_SECRET;
});

describe('GET /api/health/auth do web', () => {
  it('is cached for a day — a robot cannot wake the API with it', () => {
    // O cron a invalida e a pede depois do run, com a API acordada; fora
    // disso, uma regeneração por dia no máximo.
    expect(revalidate).toBe(86_400);
  });

  it('signs a health-probe token — no role, no session — and asks the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await GET();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API}/health/auth`);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    // Armadilha 48: `no-store` tornaria a rota dinâmica e o `revalidate` inútil.
    expect(init.cache).toBeUndefined();
    expect((init as RequestInit & { next?: { revalidate?: number } }).next?.revalidate).toBe(86_400);
    const header = new Headers(init.headers).get('authorization') ?? '';
    const { payload } = await jwtVerify(header.replace(/^Bearer /, ''), new TextEncoder().encode(SECRET));
    expect(payload.purpose).toBe('health-probe');
    expect(payload.role).toBeUndefined();
  });

  it('says accepted when the API takes the signature', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));

    const { status, data } = await body();

    expect(status).toBe(200);
    expect(data).toMatchObject({ ok: true, reason: 'accepted', status: 200 });
    expect(new Date(data.checkedAt).toISOString()).toBe(data.checkedAt);
  });

  it('says rejected — and still answers 200, so the cached "ok" is replaced', async () => {
    // Pela regra da Vercel, 5xx na regeneração mantém o documento anterior;
    // 200 o substitui. A sonda que falha **tem** de substituir o "ok" de
    // ontem — o oposto da armadilha 43, e de propósito.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));

    const { status, data } = await body();

    expect(status).toBe(200);
    expect(data).toMatchObject({ ok: false, reason: 'rejected', status: 401 });
  });

  it('says unreachable when the API does not answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    const { data } = await body();

    expect(data).toMatchObject({ ok: false, reason: 'unreachable', status: null });
  });

  it('says unexpected for any other status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));

    const { data } = await body();

    expect(data).toMatchObject({ ok: false, reason: 'unexpected', status: 503 });
  });

  it('says not-configured, without calling the API, when the secret is missing', async () => {
    delete process.env.AUTH_JWT_SECRET;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { data } = await body();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(data).toMatchObject({ ok: false, reason: 'not-configured', status: null });
  });
});
