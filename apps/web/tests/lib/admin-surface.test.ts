import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

/**
 * **Toda rota sob `app/api/admin/**` exige o papel ADMIN, e esta é a guarda.**
 * (§9 do plano de observabilidade, PR 5c.)
 *
 * A porta que decide é a da API — `routes/admin/index.ts` registra `authPlugin`
 * e `requireAdmin` uma vez no grupo, e a matriz de autorização de lá cobra
 * `access: 'admin'` de cada linha. Mas o BFF é a **outra** porta, e uma rota
 * dele que assine o JWT **sem** o `role` recebe 403 da API para todo mundo —
 * inclusive para o admin, que veria a tela em erro sem saber que o defeito é
 * um argumento esquecido a três arquivos de distância. E uma rota que confira
 * a sessão à mão, como as três de admin faziam antes da revisão da Fase 11, é
 * uma cópia a mais da mesma decisão, que já divergiu das outras uma vez.
 *
 * O que se cobra é estrutural: **cada handler exportado chama `proxyToApi`
 * com `requireRole: 'ADMIN'`**. Pelo parser (armadilha 27 do §17): a pergunta
 * é "esta função chama aquela outra com aquele argumento", que é gramática, e
 * uma varredura de texto responderia "o arquivo menciona `ADMIN` em algum
 * lugar" — verde num arquivo com dois handlers e uma checagem só.
 *
 * A exceção é mapa com motivo, porque ter de escrever o porquê é o que mantém
 * a lista honesta.
 */

const WEB_ROOT = join(__dirname, '../..');
const ADMIN_API = join(WEB_ROOT, 'app', 'api', 'admin');

/**
 * Rotas de admin que **não** passam pelo `proxyToApi`, e por quê.
 *
 * Só uma, e o motivo é de desenho: o disparo do pipeline reentra na rota do
 * cron com o `CRON_SECRET`, não na API com um JWT — a API recebe o `JOB_SECRET`
 * do cron, e o ator viaja no `x-actor-id` que só esta rota sabe pôr. Ela
 * confere sessão e papel à mão, e o `admin-api.test.ts` cobra os dois.
 */
const NOT_PROXIED: Record<string, string> = {
  'app/api/admin/run-pipeline/route.ts':
    'reentra na rota do cron com CRON_SECRET, não na API com JWT; sessão e papel conferidos à mão, e o x-actor-id só nasce aqui',
};

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function collectRoutes(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collectRoutes(full);
    return /(^|[\\/])route\.tsx?$/.test(full) ? [full] : [];
  });
}

function relativePath(file: string): string {
  return relative(WEB_ROOT, file).split(sep).join('/');
}

interface Handler {
  method: string;
  /** `true` quando o corpo chama `proxyToApi(..., { requireRole: 'ADMIN' })`. */
  requiresAdmin: boolean;
}

/**
 * Os handlers HTTP exportados de um `route.ts`, e se cada um exige o papel.
 *
 * `proxyToApi(request, path, method, options)`: o papel é o campo `requireRole`
 * do quarto argumento, e só conta quando é o **literal** `'ADMIN'` num objeto
 * escrito ali — uma variável no lugar do objeto seria uma segunda fonte para a
 * mesma decisão, e o parser diria "não sei", que é a resposta certa.
 */
export function adminHandlersIn(source: string, label: string): Handler[] {
  const tree = ts.createSourceFile(label, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);

  const requiresAdmin = (root: ts.Node): boolean => {
    let found = false;
    const walk = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'proxyToApi'
      ) {
        const options = node.arguments[3];
        if (options && ts.isObjectLiteralExpression(options)) {
          for (const property of options.properties) {
            if (
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.name) &&
              property.name.text === 'requireRole' &&
              ts.isStringLiteral(property.initializer) &&
              property.initializer.text === 'ADMIN'
            ) {
              found = true;
            }
          }
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(root);
    return found;
  };

  const handlers: Handler[] = [];
  for (const statement of tree.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      HTTP_METHODS.has(statement.name.text) &&
      statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      handlers.push({
        method: statement.name.text,
        requiresAdmin: statement.body ? requiresAdmin(statement.body) : false,
      });
    }
  }
  return handlers;
}

const ROUTES = collectRoutes(ADMIN_API).map(relativePath).sort();

describe('a superfície de admin do BFF', () => {
  it('finds admin routes at all — an empty directory would pass everything', () => {
    expect(ROUTES.length).toBeGreaterThanOrEqual(6);
    expect(ROUTES).toContain('app/api/admin/metrics/route.ts');
  });

  it('proxies every handler with requireRole ADMIN, outside the written exceptions', () => {
    const offenders: string[] = [];

    for (const route of ROUTES) {
      if (route in NOT_PROXIED) continue;
      const handlers = adminHandlersIn(readFileSync(join(WEB_ROOT, route), 'utf8'), route);

      if (handlers.length === 0) offenders.push(`${route}: nenhum handler HTTP exportado`);
      for (const handler of handlers) {
        if (!handler.requiresAdmin) {
          offenders.push(`${route}#${handler.method}: sem proxyToApi(..., { requireRole: 'ADMIN' })`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('does not carry an exception for a route that no longer exists', () => {
    expect(Object.keys(NOT_PROXIED).filter((route) => !ROUTES.includes(route))).toEqual([]);
  });

  it('checks the excepted route by hand — the exception is not a hole', () => {
    // A única exceção confere sessão e papel sem o proxy. Se um dia ela deixar
    // de conferir, este teste é o que avisa que a exceção virou buraco.
    for (const route of Object.keys(NOT_PROXIED)) {
      const source = readFileSync(join(WEB_ROOT, route), 'utf8');
      expect(source).toMatch(/session\.user\.role !== 'ADMIN'/);
      expect(source).toMatch(/status: 403/);
    }
  });

  it('reports a handler that proxies without the role — the detector answers false too', () => {
    // Guarda vista reprovando (princípio 5 do §2): um handler que chama o proxy
    // sem opções, um que passa o papel errado, e um que passa o certo.
    const semOpcoes = `export async function GET(request: Request) {
      return proxyToApi(request, '/x', 'GET');
    }`;
    const papelErrado = `export async function GET(request: Request) {
      return proxyToApi(request, '/x', 'GET', { requireRole: 'USER' });
    }`;
    const certo = `export async function GET(request: Request) {
      return proxyToApi(request, '/x', 'GET', { requireRole: 'ADMIN' });
    }
    export async function DELETE(request: Request) {
      return proxyToApi(request, '/x', 'DELETE');
    }`;

    expect(adminHandlersIn(semOpcoes, 'a.ts')).toEqual([{ method: 'GET', requiresAdmin: false }]);
    expect(adminHandlersIn(papelErrado, 'b.ts')).toEqual([{ method: 'GET', requiresAdmin: false }]);
    // Dois handlers, uma checagem: é a forma que a varredura de texto perde.
    expect(adminHandlersIn(certo, 'c.ts')).toEqual([
      { method: 'GET', requiresAdmin: true },
      { method: 'DELETE', requiresAdmin: false },
    ]);
  });
});
