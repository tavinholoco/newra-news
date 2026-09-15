import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import ts from 'typescript';

/**
 * **Duas listas escritas à mão que a mudança não abre, e o que cada uma
 * cobre.** (Verificação pós-merge do 5c, item 68 do `docs/progress.md`.)
 *
 * 1. A lista de 401 do smoke (`e2e/authorization.spec.ts`) — a única parte do
 *    ritual que mede a área de admin **sem os quatro segredos**. O comentário
 *    dela dizia *"rota de admin nova entra aqui no mesmo PR"*, e o 5c entrou
 *    com as três. Prosa que manda lembrar é a família do `13` dos feeds: a
 *    lista continua verde quando alguém esquece.
 * 2. As rotas do `admin:capture` (`scripts/capture-admin.mjs`) — a única
 *    ferramenta que alcança tela de admin. Uma aba nova fora dela nasce sem
 *    foto, e a captura é onde três defeitos do 5c apareceram.
 *
 * As duas são derivadas aqui do que existe em `app/`: toda rota do BFF com
 * `GET` atrás de sessão tem de estar na primeira; toda `page.tsx` sob
 * `app/[locale]/admin` tem de estar na segunda.
 */

const WEB_ROOT = join(__dirname, '../..');

function collect(dir: string, wanted: RegExp): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collect(full, wanted);
    return wanted.test(entry) ? [full] : [];
  });
}

function relativePath(file: string): string {
  return relative(WEB_ROOT, file).split(sep).join('/');
}

/**
 * Os handlers `GET` exportados que passam pelo `proxyToApi` — os que
 * respondem 401 sem sessão. Pelo parser: a pergunta é "esta função chama
 * aquela", e um `proxyToApi` num comentário não conta.
 */
function sessionGatedGetRoutes(): string[] {
  return collect(join(WEB_ROOT, 'app', 'api'), /^route\.tsx?$/)
    .filter((file) => {
      const source = readFileSync(file, 'utf8');
      const tree = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
      return tree.statements.some((statement) => {
        if (
          !ts.isFunctionDeclaration(statement) ||
          statement.name?.text !== 'GET' ||
          !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        ) {
          return false;
        }
        let proxies = false;
        const walk = (node: ts.Node): void => {
          if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'proxyToApi') {
            proxies = true;
          }
          ts.forEachChild(node, walk);
        };
        if (statement.body) walk(statement.body);
        return proxies;
      });
    })
    .map((file) => relativePath(file).replace(/^app/, '').replace(/\/route\.tsx?$/, ''))
    .sort();
}

/** `/api/admin/pipeline/runs/[pipelineId]` casa `/api/admin/pipeline/runs/aaaa-…`? */
function routeCovers(route: string, listed: string): boolean {
  const wanted = route.split('/');
  const actual = listed.split('/');
  for (let i = 0; i < wanted.length; i += 1) {
    const segment = wanted[i]!;
    if (segment.startsWith('[...')) return actual.length > i;
    if (actual[i] === undefined) return false;
    if (segment.startsWith('[')) continue;
    if (segment !== actual[i]) return false;
  }
  return actual.length === wanted.length;
}

describe('a lista de 401 do smoke cobre toda rota do BFF atrás de sessão', () => {
  const spec = readFileSync(join(WEB_ROOT, 'e2e', 'authorization.spec.ts'), 'utf8');
  const block = spec.slice(spec.indexOf("test.describe('BFF sem sessão'"));
  const listed = [...block.matchAll(/^\s*'(\/api\/[^']+)',$/gm)].map((m) => m[1]!);

  it('finds the list and the routes at all', () => {
    expect(listed.length).toBeGreaterThanOrEqual(8);
    expect(sessionGatedGetRoutes().length).toBeGreaterThanOrEqual(8);
  });

  it('lists every session-gated GET route of the BFF', () => {
    const missing = sessionGatedGetRoutes().filter(
      (route) => !listed.some((entry) => routeCovers(route, entry)),
    );

    expect(missing).toEqual([]);
  });

  it('lists nothing that is not a route', () => {
    const routes = sessionGatedGetRoutes();
    const stale = listed.filter((entry) => !routes.some((route) => routeCovers(route, entry)));

    expect(stale).toEqual([]);
  });
});

describe('o admin:capture fotografa toda aba de admin', () => {
  const script = readFileSync(join(WEB_ROOT, 'scripts', 'capture-admin.mjs'), 'utf8');
  const photographed = new Set(
    [...script.matchAll(/url:\s*'\/pt-BR(\/admin[^']*)'/g)].map((m) => m[1]!),
  );
  const pages = collect(join(WEB_ROOT, 'app', '[locale]', 'admin'), /^page\.tsx$/)
    .map((file) => `/${relative(join(WEB_ROOT, 'app', '[locale]'), file).split(sep).join('/').replace(/\/page\.tsx$/, '')}`)
    .sort();

  it('finds the admin pages and the capture routes at all', () => {
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(photographed.size).toBeGreaterThanOrEqual(3);
  });

  it('has a capture route for every admin page', () => {
    expect(pages.filter((page) => !photographed.has(page))).toEqual([]);
  });

  it('does not photograph a page that no longer exists', () => {
    expect([...photographed].filter((url) => !pages.includes(url))).toEqual([]);
  });
});
