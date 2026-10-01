import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * **As premissas das quatro advisories do `fastify` aceitas em 01/10/2026.**
 *
 * As quatro foram publicadas em 30/09/2026 e só têm correção na
 * `fastify@5.12.2` — a major que é dívida da Fase 13 da V2. O aceite em
 * `docs/security-advisories.md` diz, para cada uma, **o que este código
 * precisaria fazer para ela alcançá-lo**, e a resposta foi "nada que ele faz
 * hoje". Esta suíte transforma cada "hoje" em asserção: no dia em que uma
 * rota declarar o que a advisory precisa, o aceite deixa de ser verdade, e é
 * aqui que reprova — não em produção.
 *
 * | Advisory | A pré-condição | Por que não existe aqui |
 * |---|---|---|
 * | GHSA-667r-xxjv-c9mm | schema de requisição `$async` | a validação é do compilador do Zod, síncrono; nenhum `$async` no `src/` |
 * | GHSA-p68q-wchp-6fh7 | um not-found handler **encapsulado** que serve dado protegido | há um só, na raiz, sem `preHandler`, e ele devolve `{ error: 'Not Found' }` — o corpo é guardado em `tests/plugins/error-handler.test.ts` |
 * | GHSA-hwr6-493r-vm6h | um pedaço do schema (`body`, `querystring`…) como booleano `false` | nenhuma rota declara schema booleano |
 * | GHSA-9q9j-q6p8-xq58 | um schema de `headers` com `dependencies` | nenhuma rota declara schema de `headers` — decisão do 5b: com o type provider, ele **substitui** `request.headers` |
 *
 * Parser, não regex: a pergunta é de estrutura (armadilha da Fase 1 do plano
 * de observabilidade — uma aspa dentro de um literal de regex cegou 481 linhas).
 */

const SRC = join(__dirname, '../../src');
const ROUTES = join(SRC, 'routes');

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsFiles(full);
    return full.endsWith('.ts') ? [full] : [];
  });
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}

function rel(file: string): string {
  return relative(join(SRC, '..'), file).split(sep).join('/');
}

function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function propertyName(node: ts.PropertyAssignment): string | undefined {
  const { name } = node;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return undefined;
}

/** Todo `schema: { … }` literal sob `src/routes`, com o arquivo de onde veio. */
function routeSchemas(): { file: string; schema: ts.ObjectLiteralExpression }[] {
  const found: { file: string; schema: ts.ObjectLiteralExpression }[] = [];
  for (const file of tsFiles(ROUTES)) {
    walk(parse(file), (node) => {
      if (
        ts.isPropertyAssignment(node) &&
        propertyName(node) === 'schema' &&
        ts.isObjectLiteralExpression(node.initializer)
      ) {
        found.push({ file: rel(file), schema: node.initializer });
      }
    });
  }
  return found;
}

function parts(schema: ts.ObjectLiteralExpression): ts.PropertyAssignment[] {
  return schema.properties.filter(ts.isPropertyAssignment);
}

const REQUEST_PARTS = new Set(['body', 'querystring', 'query', 'params', 'headers']);

describe('01/10/2026 — as premissas das quatro advisories do fastify aceitas', () => {
  it('finds the route schemas — an empty sweep would approve anything', () => {
    const schemas = routeSchemas();

    expect(schemas.length).toBeGreaterThan(20);
    expect(schemas.some(({ file }) => file === 'src/routes/account/index.ts')).toBe(true);
  });

  it('no `$async` schema anywhere in src (GHSA-667r-xxjv-c9mm)', () => {
    const hits: string[] = [];
    for (const file of tsFiles(SRC)) {
      walk(parse(file), (node) => {
        const text =
          ts.isPropertyAssignment(node) ? propertyName(node)
          : ts.isStringLiteral(node) ? node.text
          : undefined;
        if (text === '$async') hits.push(rel(file));
      });
    }

    expect(hits).toEqual([]);
  });

  it('validation goes through the zod compiler, not a JSON Schema one (GHSA-667r-xxjv-c9mm)', () => {
    const app = parse(join(SRC, 'app.ts'));
    const compilers: string[] = [];
    let fromZodProvider = false;

    walk(app, (node) => {
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === 'fastify-type-provider-zod'
      ) {
        const names = node.importClause?.namedBindings;
        if (names && ts.isNamedImports(names)) {
          fromZodProvider ||= names.elements.some((el) => el.name.text === 'validatorCompiler');
        }
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'setValidatorCompiler'
      ) {
        compilers.push(node.arguments.map((arg) => arg.getText()).join(', '));
      }
    });

    expect(compilers).toEqual(['validatorCompiler']);
    expect(fromZodProvider).toBe(true);
  });

  it('one not-found handler, at the root, with no options (GHSA-p68q-wchp-6fh7)', () => {
    const calls: { file: string; args: number }[] = [];
    for (const file of tsFiles(SRC)) {
      walk(parse(file), (node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'setNotFoundHandler'
        ) {
          calls.push({ file: rel(file), args: node.arguments.length });
        }
      });
    }

    // Um segundo handler, num plugin com prefixo, é a pré-condição da
    // advisory: a URL malformada cai no handler registrado por último, de
    // qualquer prefixo, sem o `preHandler` dele. E a forma com opções é a que
    // carrega um `preHandler` de autenticação.
    expect(calls).toEqual([{ file: 'src/app.ts', args: 1 }]);
  });

  it('no route schema part is a boolean schema (GHSA-hwr6-493r-vm6h)', () => {
    const booleans = routeSchemas().flatMap(({ file, schema }) =>
      parts(schema)
        .filter((part) => REQUEST_PARTS.has(propertyName(part) ?? ''))
        .filter(
          (part) =>
            part.initializer.kind === ts.SyntaxKind.FalseKeyword ||
            part.initializer.kind === ts.SyntaxKind.TrueKeyword,
        )
        .map((part) => `${file}: ${propertyName(part)}`),
    );

    expect(booleans).toEqual([]);
  });

  it('no route declares a headers schema (GHSA-9q9j-q6p8-xq58)', () => {
    const headers = routeSchemas().flatMap(({ file, schema }) =>
      parts(schema)
        .filter((part) => propertyName(part) === 'headers')
        .map(() => file),
    );

    expect(headers).toEqual([]);
  });
});
