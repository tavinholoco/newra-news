import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * A guarda contra o defeito que derrubou o deploy do PR #122.
 *
 * **`tsc` compila, a suíte passa, e o servidor não sobe.** Nenhuma das duas
 * ferramentas vê o problema: os testes rodam o **fonte** com o resolvedor do
 * Vitest, que entende TypeScript, e o `tsc` só checa tipo. Quem executa
 * `dist/server.js` é o Node puro.
 *
 * O que aconteceu: `@newranews/types` tinha `"main": "./src/index.ts"` e um
 * `build` que era `tsc --noEmit` — ou seja, o pacote **não emitia JavaScript**.
 * Enquanto a API só importava `type` dele, o import sumia na compilação e nada
 * quebrava. O PR #122 trouxe o primeiro import de **valor**
 * (`PRODUCT_EVENT_RETENTION_DAYS`, `Category`, `EVENT_SOURCES`), que vira
 * `require('@newranews/types')` no `dist` — e o processo passou a morrer no
 * boot com `ERR_MODULE_NOT_FOUND`.
 *
 * O sintoma em produção não parecia com a causa: o Render reprovava o health
 * check, mantinha a build anterior no ar, e `/api/events` respondia 404 num
 * serviço que respondia 200 em todo o resto.
 *
 * **A checagem é estática, e é de propósito.** A primeira versão varria o
 * `dist` — e reprovou no CI, porque o job de teste roda `turbo test`, cujo
 * `dependsOn: ["^build"]` constrói as **dependências** e não o próprio
 * `apps/api`. Uma guarda que só funciona depois de um build que o CI não faz
 * não guarda nada.
 */

const API = path.resolve(__dirname, '../..');
const RAIZ = path.resolve(API, '../..');

/**
 * Este `import` traz **valor** para o runtime?
 *
 * `import type { X }` some inteiro na compilação. `import { type X }` também,
 * desde que **todos** os especificadores sejam de tipo — basta um sem o
 * prefixo para o `require` sobreviver no `dist`.
 */
function trazValor(declaracao: string): boolean {
  if (/^import\s+type\b/.test(declaracao)) return false;

  const chaves = declaracao.match(/\{([\s\S]*?)\}/);
  // Sem chaves: `import x from` ou `import * as x from` — sempre valor.
  if (!chaves?.[1]) return true;

  return chaves[1]
    .split(',')
    .map((parte) => parte.trim())
    .filter(Boolean)
    .some((parte) => !/^type\s/.test(parte));
}

/** Pacotes do workspace que o fonte da API importa como valor. */
function pacotesExigidosEmRuntime(): string[] {
  const encontrados = new Set<string>();

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.ts')) {
        const source = readFileSync(full, 'utf8');
        const imports = source.matchAll(
          /import[\s\S]*?from\s+'(@newranews\/[^']+)';/g,
        );
        for (const m of imports) {
          if (m[1] && trazValor(m[0])) encontrados.add(m[1]);
        }
      }
    }
  }

  walk(path.join(API, 'src'));
  return [...encontrados];
}

describe('dependências de runtime do artefato compilado', () => {
  it('a API importa valor de pelo menos um pacote do workspace', () => {
    // Se a varredura vier vazia, a asserção abaixo passa sem medir nada.
    expect(pacotesExigidosEmRuntime().length).toBeGreaterThan(0);
  });

  it('todo pacote exigido em runtime publica JavaScript', () => {
    // É esta asserção que teria barrado o PR #122 antes do deploy.
    const problemas: string[] = [];

    for (const pkg of pacotesExigidosEmRuntime()) {
      const nome = pkg.replace('@newranews/', '');
      const manifesto = path.join(RAIZ, 'packages', nome, 'package.json');
      if (!existsSync(manifesto)) continue;

      const { main, scripts } = JSON.parse(readFileSync(manifesto, 'utf8')) as {
        main?: string;
        scripts?: Record<string, string>;
      };

      if (!main || /\.tsx?$/.test(main)) {
        problemas.push(
          `${pkg}: "main" é ${main ?? '(ausente)'} — o Node não carrega TypeScript`,
        );
      }

      // `main` apontando para `dist` não basta se o build não emite nada.
      const build = scripts?.build;
      if (!build || build.includes('--noEmit')) {
        problemas.push(
          `${pkg}: "build" é ${build ?? '(ausente)'} — não emite JavaScript`,
        );
      }
    }

    expect(problemas).toEqual([]);
  });
});
