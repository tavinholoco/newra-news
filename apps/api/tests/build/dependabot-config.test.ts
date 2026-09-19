import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

/**
 * **O `dependabot.yml` é configuração que a plataforma lê da branch padrão,
 * e nenhuma guarda o parseava.** (Pós-promoção de 19/09/2026, item 81.)
 *
 * Ao acrescentar três `ignore` depois da terceira rodada do Dependabot,
 * um `node -e` dentro de aspas simples do Bash comeu as aspas de
 * `'@typescript-eslint/eslint-plugin'` — e `@` no início de um valor é
 * indicador reservado em YAML. O arquivo ficou **inválido**, o CI inteiro
 * continuaria verde (a guarda dos workflows lê só `.github/workflows/`), e
 * o Dependabot **desligaria em silêncio**: configuração que não parseia é
 * configuração que não existe, e o sintoma seria "parou de abrir PR".
 *
 * A pergunta aqui é de sintaxe e de estrutura — parser, não regex.
 */

const RAIZ = path.resolve(__dirname, '../../../..');
const ARQUIVO = path.join(RAIZ, '.github/dependabot.yml');

interface Ignore {
  'dependency-name': string;
  'update-types'?: string[];
}

interface Update {
  'package-ecosystem': string;
  'target-branch'?: string;
  ignore?: Ignore[];
}

function config(): { version: number; updates: Update[] } {
  return parse(readFileSync(ARQUIVO, 'utf8')) as { version: number; updates: Update[] };
}

describe('.github/dependabot.yml', () => {
  it('parseia como YAML, com a forma que o Dependabot espera', () => {
    const d = config();

    expect(d.version).toBe(2);
    expect(Array.isArray(d.updates)).toBe(true);
    expect(d.updates.map((u) => u['package-ecosystem']).sort()).toEqual([
      'github-actions',
      'npm',
    ]);
  });

  it('toda entrada aponta para a `dev` — a política de 09/09/2026', () => {
    // Sem `target-branch`, o Dependabot abre contra a branch padrão — a
    // `main`, que publica. Aconteceu em 09/09 (#169–#174) e em 14/09
    // (#186–#191), e nas duas vezes o campo estava só na `dev`.
    const semDev = config()
      .updates.filter((u) => u['target-branch'] !== 'dev')
      .map((u) => u['package-ecosystem']);

    expect(semDev).toEqual([]);
  });

  it('os pacotes com escopo na lista de ignore vêm entre aspas', () => {
    /**
     * É o defeito que fez esta guarda nascer: `- dependency-name:
     * @typescript-eslint/parser` sem aspas não é YAML. O parser acima já
     * reprovaria; esta asserção diz **qual linha**, porque a mensagem do
     * parser aponta para o indicador, não para o pacote.
     */
    const linhas = readFileSync(ARQUIVO, 'utf8').split(/\r?\n/);
    const semAspas = linhas.filter((l) => /^\s*-\s*dependency-name:\s*@/.test(l));

    expect(semAspas).toEqual([]);
  });

  it('a lista de ignore do npm só tem majors, cada um com nome de pacote', () => {
    // A lista existe para segurar major que exige migração (Next 15,
    // fastify 5, React 19, ESLint 9, zod 4…). Uma entrada sem `update-types`
    // silenciaria também patch de segurança — o que o `pnpm audit` do CI
    // existe para cobrar.
    const npm = config().updates.find((u) => u['package-ecosystem'] === 'npm');
    const ignore = npm?.ignore ?? [];

    expect(ignore.length).toBeGreaterThan(10);
    const semMajor = ignore
      .filter((i) => !(i['update-types'] ?? []).includes('version-update:semver-major'))
      .map((i) => i['dependency-name']);
    expect(semMajor).toEqual([]);
    expect(ignore.every((i) => typeof i['dependency-name'] === 'string' && i['dependency-name'].length > 0)).toBe(true);
  });
});
