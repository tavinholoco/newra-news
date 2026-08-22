import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * A guarda contra o defeito que derrubou o deploy do PR #122.
 *
 * **`tsc` compila, a suíte passa, e o servidor não sobe.** Nenhuma das duas
 * ferramentas vê o problema: os testes rodam o **fonte** com o resolvedor do
 * Vitest, e o `tsc` só checa tipo. Quem executa `dist/server.js` é o Node puro,
 * e ele não carrega TypeScript.
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
 */

const API = path.resolve(__dirname, '../..');
const RAIZ = path.resolve(API, '../..');

/** Todo `require(...)` de pacote do workspace que sobrevive à compilação. */
function workspaceRequiresNoDist(): string[] {
  const dist = path.join(API, 'dist');
  const encontrados = new Set<string>();

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (entry.endsWith('.js')) {
        const source = readFileSync(full, 'utf8');
        for (const m of source.matchAll(/require\("(@newranews\/[^"]+)"\)/g)) {
          if (m[1]) encontrados.add(m[1]);
        }
      }
    }
  }

  walk(dist);
  return [...encontrados];
}

describe('dependências de runtime do artefato compilado', () => {
  it('o dist existe — sem ele o teste não mede nada', () => {
    expect(existsSync(path.join(API, 'dist/server.js'))).toBe(true);
  });

  it('todo pacote do workspace exigido em runtime aponta para JavaScript', () => {
    // É esta asserção que teria barrado o PR #122 antes do deploy.
    const problemas: string[] = [];

    for (const pkg of workspaceRequiresNoDist()) {
      const nome = pkg.replace('@newranews/', '');
      const manifesto = path.join(RAIZ, 'packages', nome, 'package.json');
      if (!existsSync(manifesto)) continue;

      const { main } = JSON.parse(readFileSync(manifesto, 'utf8')) as {
        main?: string;
      };

      if (!main || /\.tsx?$/.test(main)) {
        problemas.push(
          `${pkg}: "main" é ${main ?? '(ausente)'} — o Node não carrega TypeScript`,
        );
        continue;
      }

      const entrada = path.join(RAIZ, 'packages', nome, main);
      if (!existsSync(entrada)) {
        problemas.push(`${pkg}: "main" aponta para ${main}, que não foi emitido`);
      }
    }

    expect(problemas).toEqual([]);
  });
});
