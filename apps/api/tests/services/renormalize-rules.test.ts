import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import {
  RENORMALIZE_RULES_VERSION,
  RENORMALIZE_RULE_SOURCES,
} from '../../src/services/renormalize-rules';

/**
 * **A versão das regras da etapa 8.5 acompanha o código das regras.**
 *
 * P5 do plano de ação de 11/11/2026: a 8.5 só varre o acervo inteiro quando a
 * versão muda. Se a regra mudar e a versão não, a correção nunca alcança o que
 * já está gravado — que é o defeito que a etapa existe para impedir. Esta
 * guarda tira a dependência de alguém lembrar: refaz a impressão digital dos
 * arquivos de regra e reprova dizendo o valor novo.
 *
 * A impressão digital ignora comentário e espaço (pelo parser — a lição da
 * varredura de `console.*`: um literal de regex com aspa engana quem lê o
 * texto à mão), então documentar uma regra não força uma varredura completa.
 */

const SRC = join(__dirname, '../../src');

/** O texto do código sem comentários, com todo espaço reduzido a um. */
function codeWithoutComments(fileName: string, text: string): string {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const ranges = new Map<number, number>();
  const collect = (list: ts.CommentRange[] | undefined) => {
    for (const range of list ?? []) ranges.set(range.pos, range.end);
  };
  const visit = (node: ts.Node) => {
    collect(ts.getLeadingCommentRanges(text, node.getFullStart()));
    collect(ts.getTrailingCommentRanges(text, node.getEnd()));
    ts.forEachChild(node, visit);
  };
  visit(source);
  collect(ts.getLeadingCommentRanges(text, source.endOfFileToken.getFullStart()));

  let out = '';
  let cursor = 0;
  for (const [pos, end] of [...ranges.entries()].sort((a, b) => a[0] - b[0])) {
    if (pos < cursor) continue;
    out += text.slice(cursor, pos) + ' ';
    cursor = end;
  }
  out += text.slice(cursor);
  return out.replace(/\s+/g, ' ').trim();
}

function read(relative: string): string {
  return readFileSync(join(SRC, relative), 'utf8').split('\r\n').join('\n');
}

/** As declarações de topo com estes nomes, na ordem do arquivo. */
function declarationsText(relative: string, names: readonly string[]): string {
  const text = read(relative);
  const source = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  for (const statement of source.statements) {
    const name = ts.isFunctionDeclaration(statement)
      ? statement.name?.text
      : ts.isVariableStatement(statement)
        ? statement.declarationList.declarations.map((d) => (ts.isIdentifier(d.name) ? d.name.text : '')).join(',')
        : undefined;
    if (name && names.includes(name)) found.push(statement.getText(source));
  }
  expect(found, `${relative}: declarações achadas`).toHaveLength(names.length);
  return found.join('\n');
}

function rulesFingerprint(): string {
  const hash = createHash('sha256');
  for (const file of RENORMALIZE_RULE_SOURCES.files) {
    hash.update(`${file}\n${codeWithoutComments(file, read(file))}\n`);
  }
  for (const [file, names] of Object.entries(RENORMALIZE_RULE_SOURCES.declarations)) {
    hash.update(`${file}\n${codeWithoutComments(file, declarationsText(file, names))}\n`);
  }
  return hash.digest('hex').slice(0, 12);
}

describe('RENORMALIZE_RULES_VERSION', () => {
  it('a versão das regras acompanha o código das regras', () => {
    const fingerprint = rulesFingerprint();
    expect(
      RENORMALIZE_RULES_VERSION,
      `as regras da etapa 8.5 mudaram: troque RENORMALIZE_RULES_VERSION em ` +
        `src/services/renormalize-rules.ts para '${fingerprint}' — o próximo run varre o acervo inteiro`,
    ).toBe(fingerprint);
  });

  it('comentário e espaço não mudam a impressão digital; código muda', () => {
    const base = "const A = 1; // um\nexport function f(x: string) { return x.replace(/\"/g, ''); }\n";
    const commented = "/** doc */\nconst A = 1; /* dois */\n\n\nexport function f(x: string) {\n  // três\n  return x.replace(/\"/g, '');\n}\n";
    const changed = "const A = 2;\nexport function f(x: string) { return x.replace(/\"/g, ''); }\n";
    expect(codeWithoutComments('a.ts', commented)).toBe(codeWithoutComments('a.ts', base));
    expect(codeWithoutComments('a.ts', changed)).not.toBe(codeWithoutComments('a.ts', base));
    // Uma `//` dentro de string é código, não comentário.
    expect(codeWithoutComments('a.ts', "const u = 'https://x';")).toContain('https://x');
  });

  it('os arquivos de regra existem e são os que o renormalizador importa', () => {
    const renormalizer = read('services/news-renormalizer.service.ts');
    for (const file of RENORMALIZE_RULE_SOURCES.files) {
      expect(() => read(file), file).not.toThrow();
    }
    // Um import novo de regra no renormalizador tem de entrar na lista.
    const imports = [...renormalizer.matchAll(/from '(\.\.?\/[^']+)'/g)].map((m) => m[1] as string);
    const resolved = imports.map((path) => join('services', path).split('\\').join('/').replace(/^services\/\.\.\//, ''));
    const known = new Set<string>([
      ...RENORMALIZE_RULE_SOURCES.files.map((file) => file.replace(/\.ts$/, '')),
      ...Object.keys(RENORMALIZE_RULE_SOURCES.declarations).map((file) => file.replace(/\.ts$/, '')),
      // Não são regra: o respiro do event loop e a própria versão.
      'utils/event-loop',
      'services/renormalize-rules',
    ]);
    for (const path of resolved) expect(known, `import ${path} do renormalizador`).toContain(path);
  });
});
