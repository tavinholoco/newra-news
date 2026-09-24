import { describe, it, expect, vi, afterEach } from 'vitest';
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { config } from 'dotenv';

/**
 * O `.env` entra por um lugar só, e em silêncio.
 *
 * O `dotenv` 18 passou a escrever `◇ injected env (N) from .env` no stderr a
 * cada boot — inclusive no Render, sem `.env`, com `(0)`. A suíte inteira
 * passava sobre isso (o PR do Dependabot, #238, estava verde): nenhuma
 * asserção olhava o que o carregamento escreve. As três de baixo olham o
 * comportamento, quem importa o pacote, e a ordem que o `gates:rehearse`
 * precisa.
 *
 * A varredura é pelo parser (armadilha 27): a palavra `dotenv` aparece em
 * prosa nos comentários, e só a declaração de import é o defeito.
 */

const API_ROOT = join(__dirname, '../..');
const LOADER = 'src/config/load-env-file.ts';
const SCANNED_DIRS = ['src', 'scripts'];

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsFiles(full);
    return entry.endsWith('.ts') ? [relative(API_ROOT, full).split(sep).join('/')] : [];
  });
}

/** Os especificadores de import do arquivo, na ordem em que aparecem. */
function importSpecifiers(file: string): string[] {
  const tree = ts.createSourceFile(
    file,
    readFileSync(join(API_ROOT, file), 'utf8'),
    ts.ScriptTarget.ES2022,
    false,
    ts.ScriptKind.TS,
  );
  return tree.statements
    .filter(ts.isImportDeclaration)
    .map((node) => (node.moduleSpecifier as ts.StringLiteral).text);
}

const scanned = SCANNED_DIRS.flatMap((dir) => tsFiles(join(API_ROOT, dir)));

const isDotenv = (specifier: string): boolean =>
  specifier === 'dotenv' || specifier.startsWith('dotenv/');
const isLoader = (specifier: string): boolean => specifier.endsWith('/load-env-file');

/** Espiões em toda saída que o `dotenv` já usou, calados. */
function spyOnOutput() {
  return [
    vi.spyOn(console, 'log').mockImplementation(() => undefined),
    vi.spyOn(console, 'info').mockImplementation(() => undefined),
    vi.spyOn(console, 'warn').mockImplementation(() => undefined),
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true),
  ];
}

describe('o carregamento do .env', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('acha o que precisa achar — o dotenv sem `quiet` escreve, e os espiões veem', () => {
    // Se o pacote mudar o canal de saída, esta cai antes de a de baixo passar
    // em falso. O caminho inexistente não põe nada no `process.env`.
    const spies = spyOnOutput();
    config({ path: join(API_ROOT, 'tests/config/nao-existe.env'), quiet: false });
    expect(spies.some((spy) => spy.mock.calls.length > 0)).toBe(true);
  });

  it('não escreve nada', async () => {
    const spies = spyOnOutput();
    vi.resetModules();
    await import('../../src/config/load-env-file');
    expect(spies.flatMap((spy) => spy.mock.calls)).toEqual([]);
  });

  it('a varredura encontra arquivos, e o carregador entre eles', () => {
    expect(scanned).toContain(LOADER);
    expect(scanned).toContain('src/config/env.ts');
    expect(scanned).toContain('scripts/rehearse-gates.ts');
  });

  it('só o carregador importa o dotenv', () => {
    const importers = scanned.filter((file) => importSpecifiers(file).some(isDotenv));
    expect(importers).toEqual([LOADER]);
  });

  it('quem importa o carregador o importa primeiro', () => {
    // Import é içado: o que vier antes roda sem o `.env` no ambiente — e o
    // `gates:rehearse` importa o `@newranews/database` logo depois.
    const importers = scanned.filter((file) => importSpecifiers(file).some(isLoader));
    expect(importers.sort()).toEqual(['scripts/rehearse-gates.ts', 'src/config/env.ts']);
    for (const file of importers) {
      expect(importSpecifiers(file)[0], file).toMatch(/\/load-env-file$/);
    }
  });
});
