import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import {
  AppError,
  ERROR_CATEGORIES,
  ERROR_CODES,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  logLevelFor,
} from '../../src/utils/errors';

/**
 * **A guarda da §7 — a taxonomia de erro, e o teto que ela impõe.**
 *
 * A regra que faz o desenho inteiro funcionar está escrita ao lado do tuple em
 * `src/utils/errors.ts`: **`code` é literal do tuple e nunca é interpolado.**
 * Cardinalidade de `code` sem teto é cardinalidade de fingerprint sem teto, que
 * é a tabela `ErrorEvent` da Fase 4 sem teto — ali uma linha por
 * `(fingerprint, hora)` só limita a tabela enquanto o conjunto de fingerprints
 * for finito. Um `code` montado com o id da notícia transformaria "uma linha
 * por falha distinta" em "uma linha por notícia".
 *
 * A regra é de **gramática**, não de texto: distinguir um literal de um
 * template exige o token, e é a armadilha 27 do §17 — a varredura de
 * `console.*` da Fase 1 passou verde sobre um `console.warn` real porque uma
 * aspa dentro de um literal de regex apagou 481 linhas do `src/`. Aqui a
 * pergunta é sobre a estrutura do código, então quem responde é
 * `ts.createSourceFile`.
 */

const API_SRC = join(__dirname, '../../src');
const ERRORS_FILE = 'utils/errors.ts';

/** Todo `.ts` sob `src/`, como caminho relativo com barra normal. */
function sourceFiles(dir: string = API_SRC): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return entry.endsWith('.ts') ? [relative(API_SRC, full).split(sep).join('/')] : [];
  });
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(join(API_SRC, file), 'utf8'),
    ts.ScriptTarget.ES2022,
    false,
    ts.ScriptKind.TS,
  );
}

/**
 * A família do `AppError`, **derivada do arquivo** e não digitada aqui.
 *
 * Lista escrita à mão responde "o que eu lembrei de olhar", que é a forma de
 * guarda que este projeto já viu falhar: a varredura da Fase 7a cobria
 * `app/api` e a única rota fora dali era justamente a que engolia a falha.
 * Subclasse nova entra na varredura sozinha.
 */
function appErrorFamily(): string[] {
  const tree = parse(ERRORS_FILE);
  const family = new Set<string>(['AppError']);

  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name) {
      const extendsApp = node.heritageClauses?.some((clause) =>
        clause.types.some(
          (type) => ts.isIdentifier(type.expression) && family.has(type.expression.text),
        ),
      );
      if (extendsApp) family.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };

  visit(tree);
  return [...family];
}

interface TaxonomyLiteral {
  file: string;
  property: 'code' | 'category';
  /** `undefined` quando o valor **não** é um literal de string — o defeito. */
  value: string | undefined;
  text: string;
}

/**
 * Todo `code:`/`category:` passado a um construtor da família, em `src/`.
 *
 * Alcança as duas formas: o `new NotFoundError('News')` das rotas e o `super()`
 * de dentro das próprias subclasses — que é onde moram os defaults, e portanto
 * onde metade do tuple é usada.
 */
function taxonomyLiterals(): TaxonomyLiteral[] {
  const family = new Set(appErrorFamily());
  const found: TaxonomyLiteral[] = [];

  for (const file of sourceFiles()) {
    const tree = parse(file);

    const readOptions = (call: ts.CallExpression | ts.NewExpression): void => {
      for (const arg of call.arguments ?? []) {
        if (!ts.isObjectLiteralExpression(arg)) continue;
        for (const property of arg.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const name = property.name.getText(tree);
          if (name !== 'code' && name !== 'category') continue;
          found.push({
            file,
            property: name,
            value: ts.isStringLiteral(property.initializer)
              ? property.initializer.text
              : undefined,
            text: property.initializer.getText(tree),
          });
        }
      }
    };

    /**
     * O default do `AppError` cru — `this.code = options.code ?? 'INTERNAL'`.
     *
     * Sem isto a guarda diria que `INTERNAL` é código sem quem o lance, quando
     * ele é justamente o que **todo** `new AppError('...')` sem opções carrega:
     * a forma mais comum de todas. O literal está lá, só não como propriedade
     * de objeto.
     */
    const readFieldDefault = (node: ts.BinaryExpression): void => {
      if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return;
      if (!ts.isPropertyAccessExpression(node.left)) return;
      if (node.left.expression.kind !== ts.SyntaxKind.ThisKeyword) return;

      const name = node.left.name.text;
      if (name !== 'code' && name !== 'category') return;

      let literals = 0;
      const walk = (child: ts.Node): void => {
        if (ts.isStringLiteral(child)) {
          literals += 1;
          found.push({
            file,
            property: name,
            value: child.text,
            text: child.getText(tree),
          });
        }
        if (ts.isTemplateExpression(child)) {
          found.push({ file, property: name, value: undefined, text: child.getText(tree) });
        }
        ts.forEachChild(child, walk);
      };
      walk(node.right);

      // Um default que não chega a um literal — `options.code ?? fallback()` —
      // é a mesma perda de teto que a interpolação, e passaria em silêncio.
      if (literals === 0) {
        found.push({ file, property: name, value: undefined, text: node.right.getText(tree) });
      }
    };

    const visit = (node: ts.Node): void => {
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        family.has(node.expression.text)
      ) {
        readOptions(node);
      }
      if (file === ERRORS_FILE) {
        if (
          ts.isCallExpression(node) &&
          node.expression.kind === ts.SyntaxKind.SuperKeyword
        ) {
          readOptions(node);
        }
        if (ts.isBinaryExpression(node)) readFieldDefault(node);
      }
      ts.forEachChild(node, visit);
    };

    visit(tree);
  }

  return found;
}

describe('§7 — os dois conjuntos são fechados', () => {
  it('has no repeated member', () => {
    expect(new Set(ERROR_CATEGORIES).size).toBe(ERROR_CATEGORIES.length);
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it('keeps the categories the plan fixed, and only them', () => {
    expect([...ERROR_CATEGORIES].sort()).toEqual([
      'authorization',
      'contract',
      'database',
      'internal',
      'upstream',
      'validation',
    ]);
  });
});

describe('§7 — code é literal do tuple e nunca é interpolado', () => {
  it('finds no interpolated or computed code in the whole src tree', () => {
    const computed = taxonomyLiterals().filter((entry) => entry.value === undefined);

    expect(
      computed.map((entry) => `${entry.file}: ${entry.property}: ${entry.text}`),
    ).toEqual([]);
  });

  it('uses no code outside the tuple', () => {
    const known: readonly string[] = ERROR_CODES;
    const strangers = taxonomyLiterals().filter(
      (entry) =>
        entry.property === 'code' &&
        entry.value !== undefined &&
        !known.includes(entry.value),
    );

    expect(strangers.map((entry) => `${entry.file}: ${entry.value}`)).toEqual([]);
  });

  /**
   * **Código sem quem o lance não entra no tuple.** É a armadilha da tabela sem
   * leitor pelo avesso: um membro que ninguém constrói é cardinalidade
   * reservada para um consumidor imaginário, e a Fase 4 vai fingerprintar por
   * este conjunto.
   */
  it('carries no code that nothing throws', () => {
    const used = new Set(
      taxonomyLiterals()
        .filter((entry) => entry.property === 'code')
        .map((entry) => entry.value),
    );

    expect(ERROR_CODES.filter((code) => !used.has(code))).toEqual([]);
  });

  it('scans a tree that actually contains the constructions', () => {
    // Controle positivo: uma varredura que devolvesse lista vazia passaria nas
    // três asserções acima sem olhar uma linha.
    const literals = taxonomyLiterals();

    expect(appErrorFamily().sort()).toEqual([
      'AppError',
      'ForbiddenError',
      'NotFoundError',
      'UnauthorizedError',
    ]);
    expect(literals.length).toBeGreaterThan(5);
    expect(literals.some((entry) => entry.value === 'AUTH_NOT_CONFIGURED')).toBe(true);
    expect(literals.some((entry) => entry.file === 'utils/jwt.ts')).toBe(true);
  });
});

describe('§7 — cada subclasse chega com código, categoria e status', () => {
  it('classifies the four errors the API actually throws', () => {
    const notFound = new NotFoundError('News');
    expect(notFound.statusCode).toBe(404);
    expect(notFound.code).toBe('NOT_FOUND');
    expect(notFound.category).toBe('validation');

    const unauthorized = new UnauthorizedError('Invalid or missing token');
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.code).toBe('AUTH_TOKEN_INVALID');
    expect(unauthorized.category).toBe('authorization');

    const forbidden = new ForbiddenError('Admin access required');
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.code).toBe('ADMIN_REQUIRED');
    expect(forbidden.category).toBe('authorization');

    const internal = new AppError('boom');
    expect(internal.statusCode).toBe(500);
    expect(internal.code).toBe('INTERNAL');
    expect(internal.category).toBe('internal');
  });

  it('lets a call site name its own code without changing the status', () => {
    const jobSecret = new UnauthorizedError('Invalid or missing token', {
      code: 'JOB_SECRET_INVALID',
    });

    expect(jobSecret.statusCode).toBe(401);
    expect(jobSecret.code).toBe('JOB_SECRET_INVALID');
    expect(jobSecret.category).toBe('authorization');
  });

  it('does not install an empty `cause` on an error that has none', () => {
    // `{ cause: undefined }` instala a propriedade — o `Error` do ES2022 olha
    // se a chave existe, não se o valor é útil. Quem perguntar por presença
    // leria "houve causa" em todo erro do produto.
    expect(Object.hasOwn(new NotFoundError('News'), 'cause')).toBe(false);
    expect(Object.hasOwn(new AppError('boom', 500, { cause: new Error('x') }), 'cause')).toBe(
      true,
    );
  });

  it('keeps cause and context', () => {
    const cause = new Error('connect ECONNREFUSED');
    const error = new AppError('could not read the archive', 500, {
      category: 'database',
      cause,
      context: { attempt: 3, stage: 'renormalize' },
    });

    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ attempt: 3, stage: 'renormalize' });
    expect(error.category).toBe('database');
  });

  it('is still an Error, and still an AppError, for every subclass', () => {
    for (const error of [
      new NotFoundError('News'),
      new UnauthorizedError(),
      new ForbiddenError(),
    ]) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
    }
  });
});

describe('§7 — o nível de log sai da categoria, não só do status', () => {
  it('logs a 5xx as error', () => {
    expect(logLevelFor(new AppError('boom', 500))).toBe('error');
    expect(logLevelFor(new AppError('boom', 503, { category: 'upstream' }))).toBe('error');
  });

  it('sends a 404 to debug — resultado normal afogaria o sinal', () => {
    expect(logLevelFor(new NotFoundError('News'))).toBe('debug');
  });

  it('sends an authorization denial to warn', () => {
    expect(logLevelFor(new ForbiddenError('Admin access required'))).toBe('warn');
    expect(logLevelFor(new UnauthorizedError('Invalid or missing token'))).toBe('warn');
  });

  /**
   * **O 4xx que é defeito nosso não pode ir para `debug`.**
   *
   * `AUTH_JWT_SECRET` ausente faz `verifyAuthJwt` recusar **todo** token com um
   * 401 — e este projeto já perdeu essa variável em produção uma vez. Pela
   * regra escrita do plano (`< 500` vai a `debug`, exceto `authorization`), a
   * configuração que derruba conta e admin de uma vez seria a única falha da
   * API sem uma linha de log.
   */
  it('logs an internal failure as error even when it answers 4xx', () => {
    expect(
      logLevelFor(
        new UnauthorizedError('Authentication is not configured', {
          code: 'AUTH_NOT_CONFIGURED',
          category: 'internal',
        }),
      ),
    ).toBe('error');
  });
});
