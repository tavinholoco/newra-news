import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { UNMATCHED_ROUTE, routePatternOf } from '../../src/utils/request-route';

/**
 * O balde `unmatched` é chave em dois lugares que precisam concordar — o mapa
 * de métricas de HTTP e o `route` do `ErrorEvent` —, e antes da verificação
 * pós-merge da Fase 4 a string estava escrita **seis vezes** em `src/`. O dia
 * em que uma delas virasse `'unknown'`, o balde se partiria em dois e nenhuma
 * guarda acusaria: as duas metades continuariam válidas.
 *
 * A varredura é pelo parser (armadilha 27): a palavra aparece em prosa — o
 * comentário do `observability.ts` diz "rota `unmatched`" — e só o literal de
 * string é o defeito.
 */

const API_SRC = join(__dirname, '../../src');
const HOME = 'utils/request-route.ts';

function sourceFiles(dir: string = API_SRC): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return entry.endsWith('.ts') ? [relative(API_SRC, full).split(sep).join('/')] : [];
  });
}

/** Todo literal de string igual ao balde, fora do arquivo que o define. */
function strayLiterals(): string[] {
  const found: string[] = [];

  for (const file of sourceFiles()) {
    if (file === HOME) continue;
    const tree = ts.createSourceFile(
      file,
      readFileSync(join(API_SRC, file), 'utf8'),
      ts.ScriptTarget.ES2022,
      false,
      ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteral(node) && node.text === UNMATCHED_ROUTE) found.push(file);
      ts.forEachChild(node, visit);
    };
    visit(tree);
  }

  return found;
}

describe('o padrão da rota, uma vez só', () => {
  it('devolve o padrão quando o roteador decidiu, e o balde quando não', () => {
    expect(routePatternOf({ routeOptions: { url: '/api/news/:id' } } as never)).toBe(
      '/api/news/:id',
    );
    expect(routePatternOf({ routeOptions: {} } as never)).toBe(UNMATCHED_ROUTE);
    expect(routePatternOf({} as never)).toBe(UNMATCHED_ROUTE);
  });

  it('acha o que precisa achar — o próprio arquivo escreve o literal', () => {
    // Se a varredura deixasse de ver literais, esta asserção cairia antes da
    // de baixo passar em falso.
    const tree = ts.createSourceFile(
      HOME,
      readFileSync(join(API_SRC, HOME), 'utf8'),
      ts.ScriptTarget.ES2022,
      false,
      ts.ScriptKind.TS,
    );
    let seen = 0;
    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteral(node) && node.text === UNMATCHED_ROUTE) seen += 1;
      ts.forEachChild(node, visit);
    };
    visit(tree);
    expect(seen).toBe(1);
  });

  it('nenhum outro arquivo de src/ escreve o literal do balde', () => {
    expect(strayLiterals()).toEqual([]);
  });
});
