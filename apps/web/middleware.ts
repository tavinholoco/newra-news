import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Middleware do next-intl: negocia o locale (cookie NEXT_LOCALE → accept-language
// → default pt-BR) e redireciona URLs sem prefixo para `/pt/...` ou `/en/...`
// (localePrefix: 'always'). A preferência fica salva no cookie NEXT_LOCALE.
const intlMiddleware = createMiddleware(routing);

/**
 * Segmentos que só existem para quem tem sessão, sem o prefixo de idioma.
 *
 * A lista é a mesma que os guards de página já aplicam — `account/layout.tsx`,
 * `admin/layout.tsx` e `favorites/page.tsx`. Aqui ela não substitui nenhum
 * deles: é um atalho para o caso comum, e a decisão continua sendo do servidor.
 */
const AUTHENTICATED_SEGMENTS = ['/account', '/admin', '/favorites'];

/**
 * O cookie de sessão do next-auth, com e sem o prefixo `__Secure-`.
 *
 * O prefixo entra quando a `NEXTAUTH_URL` é HTTPS, ou seja, em produção e não
 * em desenvolvimento. Procurar os dois nomes é o que faz este atalho valer nos
 * dois ambientes — e é também por isso que `lib/auth.ts` **não** declara
 * `cookies` à mão: fixar o nome tiraria o prefixo em produção e derrubaria toda
 * sessão viva no deploy seguinte.
 */
const SESSION_COOKIES = [
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
];

/**
 * **Anônimo em rota de conta responde 307, e antes respondia 200.**
 *
 * Achado ao escrever o smoke da §11.T, e é do tipo que só um navegador de
 * verdade encontra. `redirect()` dentro de um server component é resolvido
 * *depois* que a resposta começou a ser transmitida — o `app/[locale]/loading.tsx`
 * faz o Next despachar a casca na hora —, e nesse ponto não há mais como mandar
 * um 307. A saída do Next é uma tag:
 *
 * ```html
 * <meta id="__next-page-redirect" http-equiv="refresh" content="1;url=/signin?..."/>
 * ```
 *
 * Três consequências, medidas em produção em 24/08/2026:
 *
 * 1. **um segundo de espera** olhando o esqueleto antes de a tela trocar;
 * 2. **status 200** numa resposta que não é a página pedida — a mesma família
 *    do soft 404 que a Fase 10 registrou;
 * 3. **um salto a mais**, porque o alvo `/signin` não leva prefixo de idioma e
 *    quem o acrescenta é este mesmo middleware, numa segunda passada.
 *
 * O atalho abaixo decide **antes de renderizar** e resolve as três. Ele é
 * deliberadamente burro: pergunta só se **existe cookie de sessão**, nunca se
 * ele é válido. Validar aqui exigiria o `NEXTAUTH_SECRET` no runtime de borda,
 * e o modo de falha seria o pior possível — segredo ausente, `getToken`
 * devolvendo nulo, e **todo mundo deslogado** nas telas de conta. Sem cookie é
 * uma afirmação segura: aquela pessoa não tem sessão nenhuma.
 *
 * Cookie presente e inválido continua caindo no guard da página, que é a
 * autoridade e sempre foi. É o caso raro, e ele volta a pagar o meta refresh —
 * o que é aceitável porque só acontece com sessão expirada ou forjada.
 */
function signInRedirect(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl;

  const segments = pathname.split('/').filter(Boolean);
  const locale = routing.locales.find((candidate) => candidate === segments[0]);
  if (!locale) return null;

  const rest = `/${segments.slice(1).join('/')}`;
  const isProtected = AUTHENTICATED_SEGMENTS.some(
    (segment) => rest === segment || rest.startsWith(`${segment}/`),
  );
  if (!isProtected) return null;

  const hasSessionCookie = SESSION_COOKIES.some(
    (name) => request.cookies.get(name) !== undefined,
  );
  if (hasSessionCookie) return null;

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}/signin`;
  // `callbackUrl` já com o prefixo de idioma: é o mesmo valor que os guards de
  // página montam, e o que faz o retorno cair na tela de onde a pessoa veio.
  url.search = '';
  url.searchParams.set('callbackUrl', `${pathname}${search}`);

  return NextResponse.redirect(url);
}

export default function middleware(request: NextRequest) {
  return signInRedirect(request) ?? intlMiddleware(request);
}

export const config = {
  // Roda apenas em páginas — exclui rotas de API, assets do Next e arquivos
  // estáticos (ex.: favicon.ico, sitemap.xml, imagens).
  //
  // **`opengraph-image` e `apple-icon` precisam estar aqui, e a Fase 7 achou
  // isso medindo produção.** O `.*\..*` do fim exclui tudo que tem extensão —
  // e é por isso que `/icon.svg`, `/sitemap.xml` e `/robots.txt` sempre
  // funcionaram. Mas as rotas de metadata **geradas** (`opengraph-image.tsx`,
  // `apple-icon.tsx`) são servidas em URL **sem extensão**: o middleware as
  // tratava como página sem idioma e devolvia 307 para
  // `/pt-BR/opengraph-image`, que é 404. Resultado medido em produção: a
  // imagem de compartilhamento do site e o ícone do iOS estavam inalcançáveis
  // desde que existem. `twitter-image` entra por antecipação — é a mesma
  // convenção e cairia na mesma armadilha.
  matcher:
    '/((?!api|_next|_vercel|opengraph-image|twitter-image|apple-icon|.*\\..*).*)',
};
