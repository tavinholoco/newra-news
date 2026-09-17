import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';
import { buildTestApp } from '../helpers/test-server';
import { registeredRoutes } from '../helpers/registered-routes';

/**
 * **A costura entre o BFF e a API: todo caminho que o `proxyToApi` repassa é
 * uma rota que o roteador registra, com o mesmo método.**
 *
 * Achado da verificação pós-merge do 5c (item 68 do `docs/progress.md`). O
 * 5c abriu três rotas no BFF (`/api/admin/errors`, `/audit`, `/http-metrics`),
 * cada uma repassando um caminho da API escrito como literal — e **nenhuma
 * guarda dos dois lados lia o outro lado**. Um `'/admin/error'` passaria no
 * web (o `fetch` é mockado em toda suíte de rota), passaria na API (que não
 * sabe do web), e falharia só em produção, com um 404 que a tela desenharia
 * como "não foi possível carregar". É a classe de defeito mais cara que este
 * projeto conhece: o desencontro entre os dois deploys, que só o smoke E2E
 * media — e o smoke roda só na `main`, depois da promoção.
 *
 * O desenho é o do `jobs.test.ts` para o `x-actor-id`: a suíte da API lê os
 * arquivos do web que escrevem o literal. Pelo parser (armadilha 27 do §17),
 * porque a pergunta é "qual é o segundo argumento desta chamada" — e um
 * template literal com `${params.id}` é gramática, não texto.
 *
 * **Desde a Fase 7c a costura também lê o `fetch` cru**
 * (``fetch(`${API_BASE_URL}/…`)``). A primeira versão enumerava só o
 * `proxyToApi`, e as rotas **anônimas** do BFF — o `/api/events` e, desde a
 * 7c, o `/api/errors/client` — não passam por ele de propósito (ele exige
 * sessão e assina JWT). Ficavam fora da guarda, expostas ao mesmo caractere
 * trocado que o item 68 achou: um `/errors/clientt` passaria nos dois CIs e
 * falharia só em produção. O que continua fora, com o motivo escrito, é o
 * `fetch` cujo destino vem de uma variável de ambiente inteira (o
 * `BACKEND_JOB_URL` do cron): o caminho não está no arquivo, e "não sei" ali
 * não é defeito de leitura.
 */

vi.mock('@newranews/database', async () => {
  const actual = await vi.importActual<typeof import('@newranews/database')>(
    '@newranews/database',
  );
  return { ...actual, prisma: {} };
});

vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    HOST: '0.0.0.0',
    PORT: 3001,
    CORS_ORIGIN: 'https://newra-news-web.vercel.app',
    AUTH_JWT_SECRET: 'seam-jwt-secret',
    JOB_SECRET: 'test-job-secret',
    GEMINI_MODEL: 'gemini-2.5-flash',
    GROQ_MODEL: 'openai/gpt-oss-20b',
    SITE_URL: 'http://localhost:3000',
    ADMIN_EMAILS: '',
  },
}));

const WEB_ROOT = join(__dirname, '../../../web');
const BFF_ROOT = join(WEB_ROOT, 'app', 'api');

/** Um repasse do BFF: de onde (arquivo#handler), para onde (método + caminho). */
interface ProxyCall {
  site: string;
  method: string;
  /** O caminho como padrão: `${...}` vira `:param`; `.join(` vira `*`. */
  pattern: string;
  /** Por onde o repasse sai: o cliente com sessão, ou o `fetch` sem ela. */
  via: 'proxyToApi' | 'fetch';
}

/** O identificador que as rotas anônimas do BFF interpolam na frente do caminho. */
const API_BASE_IDENTIFIER = 'API_BASE_URL';

function collectRoutes(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collectRoutes(full);
    return /(^|[\\/])route\.tsx?$/.test(full) ? [full] : [];
  });
}

function relativePath(file: string): string {
  return relative(WEB_ROOT, file).split(sep).join('/');
}

/** O nome da função exportada que envolve o nó. */
function enclosingHandler(node: ts.Node): string {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
  }
  return '<top-level>';
}

/**
 * O segundo argumento de `proxyToApi`, como padrão de rota.
 *
 * Literal fica como está. Template literal: cada `${...}` vira `:param` — um
 * segmento —, exceto quando a expressão é um `.join(...)`, que é o catch-all
 * do `[...path]` e cobre **um ou mais** segmentos (`*`). Qualquer outra forma
 * (variável, concatenação) é "não sei", e "não sei" reprova: o caminho que o
 * BFF repassa tem de ser legível no arquivo.
 */
function patternOf(argument: ts.Expression): string | null {
  if (ts.isStringLiteral(argument)) return argument.text;
  if (ts.isNoSubstitutionTemplateLiteral(argument)) return argument.text;
  if (ts.isTemplateExpression(argument)) {
    let pattern = argument.head.text;
    for (const span of argument.templateSpans) {
      const expression = span.expression.getText();
      pattern += expression.includes('.join(') ? '*' : ':param';
      pattern += span.literal.text;
    }
    return pattern;
  }
  return null;
}

/**
 * O primeiro argumento de um `fetch` anônimo, como padrão de rota — ou `null`
 * quando a chamada não é para a API.
 *
 * Só a forma ``fetch(`${API_BASE_URL}/events`, …)`` é lida: cabeça vazia e o
 * identificador da base como primeiro `${}`. O resto do template segue a
 * mesma leitura do `proxyToApi`. Um `fetch` para qualquer outra coisa (o
 * `BACKEND_JOB_URL` do cron, um feed de terceiro) não é costura com a API e
 * não entra.
 */
function anonymousPatternOf(argument: ts.Expression): string | null {
  if (!ts.isTemplateExpression(argument)) return null;
  if (argument.head.text !== '') return null;
  const [base, ...rest] = argument.templateSpans;
  if (
    !base ||
    !ts.isIdentifier(base.expression) ||
    base.expression.text !== API_BASE_IDENTIFIER
  ) {
    return null;
  }

  let pattern = base.literal.text;
  for (const span of rest) {
    pattern += span.expression.getText().includes('.join(') ? '*' : ':param';
    pattern += span.literal.text;
  }
  return pattern;
}

/** O `method:` do objeto de opções de um `fetch`; `GET` quando não há. */
function fetchMethodOf(init: ts.Expression | undefined): string {
  if (!init || !ts.isObjectLiteralExpression(init)) return 'GET';
  for (const property of init.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      ts.isIdentifier(property.name) &&
      property.name.text === 'method' &&
      ts.isStringLiteral(property.initializer)
    ) {
      return property.initializer.text;
    }
  }
  return 'GET';
}

export function proxyCallsIn(source: string, label: string): ProxyCall[] {
  const tree = ts.createSourceFile(label, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const calls: ProxyCall[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === 'proxyToApi') {
        const [, pathArgument, methodArgument] = node.arguments;
        const pattern = pathArgument ? patternOf(pathArgument) : null;
        const method =
          methodArgument && ts.isStringLiteral(methodArgument) ? methodArgument.text : 'GET';
        calls.push({
          site: `${label}#${enclosingHandler(node)}`,
          method,
          pattern: pattern ?? '<ilegível>',
          via: 'proxyToApi',
        });
      } else if (node.expression.text === 'fetch') {
        const [urlArgument, initArgument] = node.arguments;
        const pattern = urlArgument ? anonymousPatternOf(urlArgument) : null;
        if (pattern !== null) {
          calls.push({
            site: `${label}#${enclosingHandler(node)}`,
            method: fetchMethodOf(initArgument),
            pattern,
            via: 'fetch',
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(tree);
  return calls;
}

/** `GET /api/admin/pipeline/runs/:pipelineId` casa `/admin/pipeline/runs/:param`? */
function matches(registered: string, call: ProxyCall): boolean {
  const [method, path] = registered.split(' ') as [string, string];
  if (method !== call.method) return false;

  const wanted = `/api${call.pattern}`.split('/');
  const actual = path.split('/');

  let i = 0;
  for (; i < wanted.length; i += 1) {
    const segment = wanted[i]!;
    if (segment === '*') return actual.length > i;
    const real = actual[i];
    if (real === undefined) return false;
    if (segment === ':param') {
      if (!real.startsWith(':')) return false;
      continue;
    }
    if (segment !== real) return false;
  }
  return actual.length === wanted.length;
}

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('a costura BFF → API', () => {
  const calls = collectRoutes(BFF_ROOT).flatMap((file) =>
    proxyCallsIn(readFileSync(file, 'utf8'), relativePath(file)),
  );

  it('finds proxy calls at all — a parser that returns nothing would pass everything', () => {
    expect(calls.length).toBeGreaterThanOrEqual(12);
    expect(calls.some((call) => call.pattern.includes(':param'))).toBe(true);
    expect(calls.some((call) => call.pattern.includes('*'))).toBe(true);
  });

  it('finds the anonymous relays too — the routes that never touch proxyToApi', () => {
    // As duas portas sem sessão do BFF, e a asserção é pelo caminho: se a
    // leitura do `fetch` cru quebrar, é aqui que ela aparece — não numa lista
    // vazia que aprova tudo.
    const anonymous = calls.filter((call) => call.via === 'fetch');

    expect(anonymous.map((call) => `${call.method} /api${call.pattern}`).sort()).toEqual([
      'POST /api/errors/client',
      'POST /api/events',
    ]);
  });

  it('every path the BFF forwards is a route the API registers, with the same method', () => {
    const routes = registeredRoutes(app);

    const orphans = calls
      .filter((call) => !routes.some((route) => matches(route, call)))
      .map((call) => `${call.site} → ${call.method} /api${call.pattern}`);

    expect(orphans).toEqual([]);
  });

  it('reads a template path as a pattern, and refuses one it cannot read', () => {
    // Guarda vista reprovando (princípio 5 do §2), sobre a própria leitura.
    const source = `
      export async function GET(request: Request, { params }: { params: { id: string } }) {
        return proxyToApi(request, \`/news/\${params.id}\`, 'GET');
      }
      export async function DELETE(request: Request, { params }: { params: { path: string[] } }) {
        return proxyToApi(request, \`/favorites/\${params.path.join('/')}\`, 'DELETE');
      }
      export async function POST(request: Request) {
        const target = '/x';
        return proxyToApi(request, target, 'POST');
      }
    `;

    expect(proxyCallsIn(source, 'a.ts')).toEqual([
      { site: 'a.ts#GET', method: 'GET', pattern: '/news/:param', via: 'proxyToApi' },
      { site: 'a.ts#DELETE', method: 'DELETE', pattern: '/favorites/*', via: 'proxyToApi' },
      { site: 'a.ts#POST', method: 'POST', pattern: '<ilegível>', via: 'proxyToApi' },
    ]);
  });

  it('reads a raw fetch to the API, and ignores a fetch to anywhere else', () => {
    // A leitura nova, vista nas duas direções: o que é costura entra com o
    // método declarado (ou `GET` por omissão), e o que não aponta para a base
    // da API — variável de ambiente inteira, URL de terceiro, base no meio do
    // template — fica de fora em vez de virar "<ilegível>".
    const source = `
      export async function POST(request: Request) {
        await fetch(\`\${API_BASE_URL}/errors/client\`, { method: 'POST', body });
        await fetch(\`\${API_BASE_URL}/health\`);
        await fetch(\`\${process.env.BACKEND_JOB_URL}\`, { method: 'POST' });
        await fetch('https://example.com/feed.xml');
        await fetch(\`https://\${API_BASE_URL}/x\`);
      }
    `;

    expect(proxyCallsIn(source, 'b.ts')).toEqual([
      { site: 'b.ts#POST', method: 'POST', pattern: '/errors/client', via: 'fetch' },
      { site: 'b.ts#POST', method: 'GET', pattern: '/health', via: 'fetch' },
    ]);
  });

  it('would catch a typo in a forwarded path', () => {
    const routes = registeredRoutes(app);
    const via = 'proxyToApi' as const;
    const typo: ProxyCall = { site: 'x', method: 'GET', pattern: '/admin/error', via };
    const wrongMethod: ProxyCall = { site: 'x', method: 'POST', pattern: '/admin/errors', via };
    const right: ProxyCall = { site: 'x', method: 'GET', pattern: '/admin/errors', via };

    expect(routes.some((route) => matches(route, typo))).toBe(false);
    expect(routes.some((route) => matches(route, wrongMethod))).toBe(false);
    expect(routes.some((route) => matches(route, right))).toBe(true);
  });
});
