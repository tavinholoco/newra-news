// @ts-check
'use strict';

/**
 * Os cabeçalhos de defesa do **site** (Fase 10.S).
 *
 * A assimetria que a revisão achou: a API tem o conjunto do helmet desde a
 * Fase 2 e uma CSP de verdade desde a Fase 9, e o site — a superfície que as
 * pessoas de fato abrem num navegador — não tinha **nenhum**. Medido em
 * produção em 23/08/2026: `x-content-type-options`, `x-frame-options`,
 * `referrer-policy`, `cross-origin-opener-policy` e `content-security-policy`
 * todos ausentes na `vercel.app`. Não era descuido de configuração: era a
 * consequência de a segurança ter sido pensada no app onde a biblioteca
 * existia.
 *
 * **Por que um `.js` e não um `.ts`:** o `next.config.js` é CommonJS e não
 * carrega TypeScript. Ter a lista aqui é o que permite ao `next.config.js` e à
 * guarda (`tests/security/response-headers.test.ts`) lerem **a mesma fonte** —
 * uma cópia no teste provaria que a cópia está certa, não o cabeçalho.
 */

/** Cabeçalhos que toda resposta do site tem de carregar. */
const REQUIRED_HEADERS = [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
];

/**
 * A origem da API, derivada de `NEXT_PUBLIC_API_URL`.
 *
 * O `connect-src` precisa dela porque **o navegador fala com a API direto**:
 * `lib/api.ts` monta o `fetch` sobre `NEXT_PUBLIC_API_URL`, e é dali que o
 * TanStack Query busca listagem, facetas e briefing depois da hidratação. Só o
 * que passa pelo BFF (`/api/events`, `/api/favorites`, `/api/account`) é
 * same-origin.
 *
 * O valor da env inclui o caminho (`.../api`); o `connect-src` quer a origem.
 *
 * @param {string | undefined} apiUrl
 * @returns {string | null}
 */
function apiOrigin(apiUrl) {
  if (!apiUrl) return null;
  try {
    return new URL(apiUrl).origin;
  } catch {
    // Env malformada não pode derrubar o build: sem origem, o `connect-src`
    // fica só com `'self'` e a falha aparece como violação de CSP no console —
    // barulhenta, e não silenciosa.
    return null;
  }
}

/**
 * A CSP do site.
 *
 * **`script-src` carrega `'unsafe-inline'`, e isso é decisão medida, não
 * preguiça.** O HTML de produção da Home tem **63 scripts inline**: um é o
 * `theme-init` (constante, hashável), um é o `application/ld+json`, e os
 * **61 restantes são os chunks de Flight do App Router**
 * (`self.__next_f.push([1,"..."])`), cujo conteúdo é o payload **daquela
 * página** — muda a cada rota e a cada regeneração da ISR. Hash não fecha um
 * conjunto que muda; nonce fecharia, mas nonce exige cabeçalho por requisição,
 * e ler `headers()` numa página do App Router a torna dinâmica. Seriam as 15
 * páginas estáticas trocadas por render sob demanda para endurecer uma
 * diretiva.
 *
 * O que sobra ainda vale a pena, e é o motivo de a CSP entrar mesmo assim:
 * sem `https:` nem curinga no `script-src`, um `<script src="https://…">`
 * injetado **não executa**; `object-src 'none'` mata plugin; `base-uri 'self'`
 * mata o sequestro de URL relativa por `<base>`; e `frame-ancestors 'none'`
 * mata clickjacking. A injeção que restaria é inline — e as duas únicas portas
 * de HTML para o DOM neste app estão auditadas e travadas por
 * `tests/security/dangerous-html.test.ts`.
 *
 * **`style-src` também leva `'unsafe-inline'`, por outro motivo.** O HTML tem
 * zero `<style>` inline (o `next/font` escreve no CSS) mas **26 atributos
 * `style=`**, emitidos pelo `fill` do `next/image`. A diretiva precisa dos
 * atributos: `style-src-attr` os separaria, mas o suporte não é universal e o
 * preço de errar é imagem fora de posição para leitor de verdade.
 *
 * @param {{ apiUrl?: string, isProduction: boolean, isVercelPreview: boolean }} options
 * @returns {string}
 */
function contentSecurityPolicy({ apiUrl, isProduction, isVercelPreview }) {
  const api = apiOrigin(apiUrl);

  // A barra de ferramentas da Vercel só é injetada em deploy de preview. Ela
  // não existe em produção, então não relaxa a política de quem lê o site.
  const vercelToolbar = isVercelPreview ? ['https://vercel.live'] : [];

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    // O webpack de desenvolvimento compila com `eval`. Em produção não há
    // `eval` nenhum, e é por isso que a diretiva não o carrega lá.
    ...(isProduction ? [] : ["'unsafe-eval'"]),
    ...vercelToolbar,
  ];

  const connectSrc = [
    "'self'",
    ...(api ? [api] : []),
    // HMR do `next dev` fala por WebSocket.
    ...(isProduction ? [] : ['ws:', 'wss:']),
    ...vercelToolbar,
  ];

  /** @type {Record<string, string[]>} */
  const directives = {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'form-action': ["'self'"],
    'script-src': scriptSrc,
    'style-src': ["'self'", "'unsafe-inline'"],
    // Toda imagem do produto passa pelo otimizador em `/_next/image`, que é
    // same-origin — inclusive as de terceiro e o avatar do OAuth. Host externo
    // no `img-src` seria permissão que nada usa.
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': connectSrc,
    'manifest-src': ["'self'"],
    'media-src': ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': vercelToolbar.length > 0 ? vercelToolbar : ["'none'"],
  };

  const policy = Object.entries(directives).map(
    ([name, values]) => `${name} ${values.join(' ')}`,
  );

  // `upgrade-insecure-requests` só em produção: em `localhost` ele reescreveria
  // o HTTP do dev server para HTTPS e a página não abriria.
  if (isProduction) policy.push('upgrade-insecure-requests');

  return policy.join('; ');
}

/**
 * A lista que o `next.config.js` devolve em `headers()`.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ key: string, value: string }[]}
 */
function securityHeaders(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  const isVercelPreview = env.VERCEL_ENV === 'preview';

  return [
    {
      key: 'Content-Security-Policy',
      value: contentSecurityPolicy({
        apiUrl: env.NEXT_PUBLIC_API_URL,
        isProduction,
        isVercelPreview,
      }),
    },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Redundante com `frame-ancestors` em navegador moderno, e é de propósito:
    // é o que cobre quem não implementa CSP nível 2.
    { key: 'X-Frame-Options', value: 'DENY' },
    // Mais frouxo que o `no-referrer` da API, e por uma razão editorial: a
    // `source-list` leva o leitor ao veículo original, e mandar a origem (não o
    // caminho) é a atribuição que um agregador de notícias deve ao publisher.
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: [
        'accelerometer=()',
        'camera=()',
        'display-capture=()',
        'geolocation=()',
        'gyroscope=()',
        'magnetometer=()',
        'microphone=()',
        'payment=()',
        'usb=()',
      ].join(', '),
    },
    // O login é redirecionamento de página inteira, não popup — `same-origin`
    // não tem contraindicação aqui.
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
}

module.exports = {
  REQUIRED_HEADERS,
  apiOrigin,
  contentSecurityPolicy,
  securityHeaders,
};
