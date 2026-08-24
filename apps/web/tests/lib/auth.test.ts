// @vitest-environment node
//
// **Ambiente node, e nao e detalhe.** O `signAuthJwt` assina HS256 pelo `jose`,
// que precisa da WebCrypto do Node; no jsdom a assinatura lanca, o `catch` do
// callback engole, e o teste passaria a medir o caminho de falha achando que
// mediu o feliz. E a mesma armadilha que o `CLAUDE.md` registra do lado da API,
// e foi a assercao de caminho feliz que a expos.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { JWT } from 'next-auth/jwt';
import type { Account, Session, User } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Os callbacks de sessão — **o caminho de identidade, e ele não tinha teste**.
 *
 * A revisão 10.T mediu `lib/auth.ts` em 41% de linhas, e o que estava
 * descoberto é justamente o que decide quem o resto do produto pensa que você
 * é: o `jwt` assina um token de escopo `auth-upsert`, persiste o usuário na API
 * e guarda `id` e `role`; o `session` os copia para o objeto que toda tela lê.
 *
 * O `catch` silencioso do `jwt` é testado de propósito, e não por completude:
 * ele é a costura entre as duas metades, e o que acontece quando ele engole a
 * falha é assunto da **Fase 11.S** — está registrado no item 35 do
 * `docs/progress.md`.
 */

const jwtCallback = authOptions.callbacks?.jwt;
const sessionCallback = authOptions.callbacks?.session;

const USER = {
  id: 'provider-123',
  email: 'leitor@exemplo.com',
  name: 'Leitor',
  image: 'https://lh3.googleusercontent.com/a/foto',
} as User;

const ACCOUNT = { provider: 'google', type: 'oauth', providerAccountId: 'g-1' } as Account;

function chamarJwt(token: JWT, extra: { user?: User; account?: Account | null } = {}) {
  // O tipo do callback do next-auth exige o objeto inteiro; o que ele lê são
  // estes quatro campos.
  return jwtCallback?.({
    token,
    user: extra.user as User,
    account: extra.account ?? null,
    trigger: 'signIn',
  } as Parameters<NonNullable<typeof jwtCallback>>[0]);
}

beforeEach(() => {
  vi.stubEnv('AUTH_JWT_SECRET', 'segredo-de-teste-com-tamanho-suficiente-para-hs256');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('callback jwt', () => {
  it('persiste o usuário na API e guarda o id e o papel que ela devolveu', async () => {
    // O id que vale é o **da API**, não o do provedor: é ele que o resto do
    // produto usa para achar favoritos e preferências.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'api-uuid-1', role: 'ADMIN' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const token = await chamarJwt({} as JWT, { user: USER, account: ACCOUNT });

    expect(token?.id).toBe('api-uuid-1');
    expect(token?.role).toBe('ADMIN');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/auth\/upsert$/);
    expect(init.method).toBe('POST');
    // O token vai no header, nunca na query string — a regra que a Fase 9
    // fixou do outro lado.
    expect(String((init.headers as Record<string, string>).Authorization)).toMatch(
      /^Bearer ey/,
    );
    expect(JSON.parse(String(init.body))).toEqual({
      email: USER.email,
      name: USER.name,
      image: USER.image,
    });
  });

  it('só chama a API no primeiro sign-in', async () => {
    // Sem `account`, o callback está sendo chamado numa renovação de token.
    // Bater na API a cada renovação seria uma escrita por requisição.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const token = await chamarJwt({ id: 'api-uuid-1', role: 'USER' } as JWT);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(token?.id).toBe('api-uuid-1');
  });

  it('a falha do upsert não derruba o login — e é isso que a Fase 11 revisita', async () => {
    /**
     * O `catch` é deliberado: a pessoa segue logada e o upsert é retentado no
     * sign-in seguinte. **O efeito colateral está registrado como item da
     * 11.S**: sem o upsert, `token.id` cai no id do *provedor*, que não é o id
     * da API — e a sessão passa a apontar para um usuário que a API não
     * conhece. O teste congela o comportamento de hoje para que a decisão da
     * 11 seja uma mudança visível, e não uma descoberta.
     */
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('API fora do ar')));

    const token = await chamarJwt({} as JWT, { user: USER, account: ACCOUNT });

    expect(token?.id).toBeUndefined();
    expect(token?.role).toBeUndefined();
  });

  it('resposta não-ok também não derruba o login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const token = await chamarJwt({} as JWT, { user: USER, account: ACCOUNT });

    expect(token?.id).toBeUndefined();
  });

  it('corpo sem `data` cai no id do provedor em vez de gravar `undefined`', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );

    const token = await chamarJwt({} as JWT, { user: USER, account: ACCOUNT });

    expect(token?.id).toBe(USER.id);
    expect(token?.role).toBeUndefined();
  });
});

/**
 * O `user` da `Session` e uma uniao: o next-auth so promete `name`/`email`/
 * `image`, e o `id`/`role` vem da ampliacao de tipo do proprio projeto. Ler
 * pelo helper mantem a assercao sobre o objeto real sem espalhar cast.
 */
function usuario(session: unknown) {
  return (session as { user?: { id?: string; role?: 'USER' | 'ADMIN' } } | undefined)
    ?.user;
}

describe('callback session', () => {
  it('copia id e papel do token para o objeto que as telas leem', async () => {
    const session = await sessionCallback?.({
      session: { user: { email: USER.email }, expires: '2030-01-01' } as Session,
      token: { id: 'api-uuid-1', role: 'ADMIN' } as JWT,
    } as Parameters<NonNullable<typeof sessionCallback>>[0]);

    expect(usuario(session)?.id).toBe('api-uuid-1');
    expect(usuario(session)?.role).toBe('ADMIN');
  });

  it('token sem id preserva o id que a sessão já tinha', async () => {
    const session = await sessionCallback?.({
      session: {
        user: { id: 'existente', email: USER.email },
        expires: '2030-01-01',
      } as Session,
      token: {} as JWT,
    } as Parameters<NonNullable<typeof sessionCallback>>[0]);

    expect(usuario(session)?.id).toBe('existente');
  });

  it('sessão sem usuário passa intacta', async () => {
    const session = await sessionCallback?.({
      session: { expires: '2030-01-01' } as Session,
      token: { id: 'api-uuid-1' } as JWT,
    } as Parameters<NonNullable<typeof sessionCallback>>[0]);

    expect(usuario(session)).toBeUndefined();
  });
});

describe('configuração', () => {
  it('a página de sign-in é a customizada', () => {
    // Sem isto, `signIn()` sem provider cai num loop na Home e a página padrão
    // do next-auth não é localizada.
    expect(authOptions.pages?.signIn).toBe('/signin');
  });

  it('os dois provedores estão registrados', () => {
    expect(authOptions.providers.map((p) => p.id).sort()).toEqual(['github', 'google']);
  });
});
