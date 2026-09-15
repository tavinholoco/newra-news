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
}

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

export function proxyCallsIn(source: string, label: string): ProxyCall[] {
  const tree = ts.createSourceFile(label, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const calls: ProxyCall[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'proxyToApi'
    ) {
      const [, pathArgument, methodArgument] = node.arguments;
      const pattern = pathArgument ? patternOf(pathArgument) : null;
      const method =
        methodArgument && ts.isStringLiteral(methodArgument) ? methodArgument.text : 'GET';
      calls.push({
        site: `${label}#${enclosingHandler(node)}`,
        method,
        pattern: pattern ?? '<ilegível>',
      });
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
      { site: 'a.ts#GET', method: 'GET', pattern: '/news/:param' },
      { site: 'a.ts#DELETE', method: 'DELETE', pattern: '/favorites/*' },
      { site: 'a.ts#POST', method: 'POST', pattern: '<ilegível>' },
    ]);
  });

  it('would catch a typo in a forwarded path', () => {
    const routes = registeredRoutes(app);
    const typo: ProxyCall = { site: 'x', method: 'GET', pattern: '/admin/error' };
    const wrongMethod: ProxyCall = { site: 'x', method: 'POST', pattern: '/admin/errors' };
    const right: ProxyCall = { site: 'x', method: 'GET', pattern: '/admin/errors' };

    expect(routes.some((route) => matches(route, typo))).toBe(false);
    expect(routes.some((route) => matches(route, wrongMethod))).toBe(false);
    expect(routes.some((route) => matches(route, right))).toBe(true);
  });
});
