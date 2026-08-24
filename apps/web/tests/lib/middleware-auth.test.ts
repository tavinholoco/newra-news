// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import middleware from '@/middleware';

/**
 * **O atalho de sessão do middleware: o que ele decide e o que ele não decide.**
 *
 * Achado ao escrever o smoke da §11.T: anônimo em `/pt-BR/favorites` respondia
 * **200 com `<meta http-equiv="refresh" content="1;url=/signin?…">`**, e não
 * 307. O `redirect()` do server component resolve depois de a resposta começar
 * a ser transmitida — o `loading.tsx` do segmento de idioma despacha a casca na
 * hora — e o Next cai na tag como último recurso: um segundo de espera, status
 * errado, e um salto a mais porque o alvo não levava prefixo de idioma.
 *
 * O que este teste protege são as duas metades da decisão, e a segunda importa
 * mais que a primeira:
 *
 * - **sem cookie de sessão, redireciona** — é o caso comum e agora é 307;
 * - **com cookie, não decide nada** e deixa passar. Validar o token aqui
 *   exigiria o `NEXTAUTH_SECRET` na borda, e o modo de falha seria deslogar
 *   todo mundo se a variável faltasse. O guard da página continua sendo a
 *   autoridade.
 */

vi.mock('next-intl/middleware', () => ({
  default: () => () => new Response(null, { status: 200, headers: { 'x-intl': '1' } }),
}));

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(new URL(path, 'https://newra-news-web.vercel.app'), {
    headers: cookie ? { cookie } : undefined,
  });
}

describe('middleware — atalho de sessão', () => {
  it('redirects an anonymous visitor away from every protected segment', () => {
    for (const path of [
      '/pt-BR/account',
      '/pt-BR/account/preferences',
      '/pt-BR/admin',
      '/pt-BR/admin/metrics',
      '/pt-BR/favorites',
      '/en/favorites',
    ]) {
      const response = middleware(request(path));

      expect(response.status, path).toBe(307);
      const location = new URL(response.headers.get('location') as string);
      expect(location.pathname, path).toBe(`/${path.split('/')[1]}/signin`);
      expect(location.searchParams.get('callbackUrl'), path).toBe(path);
    }
  });

  it('keeps the locale prefix on the sign-in URL', () => {
    // Sem isto o alvo é `/signin`, e o próprio middleware precisa de uma
    // segunda passada para acrescentar o idioma — um salto a mais depois de
    // uma espera de um segundo.
    const location = middleware(request('/en/account')).headers.get('location');

    expect(location).toContain('/en/signin');
  });

  it('preserves the query string in the callback', () => {
    const response = middleware(request('/pt-BR/favorites?category=WORLD'));
    const location = new URL(response.headers.get('location') as string);

    expect(location.searchParams.get('callbackUrl')).toBe(
      '/pt-BR/favorites?category=WORLD',
    );
  });

  it('does not decide anything when a session cookie is present', () => {
    // O atalho pergunta só se **existe** cookie, nunca se ele é válido. Cookie
    // presente e expirado cai no guard da página, que é quem sabe.
    for (const cookie of [
      '__Secure-next-auth.session-token=qualquer-coisa',
      'next-auth.session-token=qualquer-coisa',
    ]) {
      const response = middleware(request('/pt-BR/favorites', cookie));

      expect(response.status).not.toBe(307);
      expect(response.headers.get('x-intl')).toBe('1');
    }
  });

  it('leaves the public routes to next-intl', () => {
    for (const path of ['/pt-BR', '/pt-BR/news', '/en/about', '/pt-BR/newsletter']) {
      const response = middleware(request(path));

      expect(response.headers.get('x-intl'), path).toBe('1');
    }
  });

  it('does not mistake a prefix for a segment', () => {
    // `/accounts` não é `/account`, e `/adminstuff` não é `/admin`. Um
    // `startsWith` cru trataria os dois como rota protegida.
    for (const path of ['/pt-BR/accounts', '/pt-BR/adminstuff']) {
      const response = middleware(request(path));

      expect(response.headers.get('x-intl'), path).toBe('1');
    }
  });
});
