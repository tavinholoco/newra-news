import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * **As variáveis do web que o Turbo esconderia — 13.10 do plano de
 * observabilidade (§23).**
 *
 * Todo build da Vercel terminava com "missing from turbo.json" para o
 * `BACKEND_JOB_*`, o `CRON_SECRET`, o `NEXTAUTH_*` e o `AUTH_JWT_SECRET`. Hoje é
 * inócuo — são lidas em runtime, não no `next build` —, mas o modo estrito do
 * Turbo 2 **filtra do ambiente da tarefa** toda variável que o `turbo.json` não
 * declara: no dia em que uma delas passar a ser lida no build, ela chega
 * `undefined`, sem erro, e o aviso que avisaria é o mesmo que todo build já
 * imprime e ninguém lê.
 *
 * **`globalPassThroughEnv`, nunca `env`/`globalEnv`.** Passagem deixa a
 * variável chegar à tarefa sem entrar na chave de cache: um segredo na chave de
 * cache invalidaria o cache a cada rotação e o espalharia pelo hash. As
 * `NEXT_PUBLIC_*` ficam de fora — o Turbo as infere do framework, e elas
 * **devem** estar na chave (vão para o bundle).
 *
 * O conjunto é **derivado** do `apps/web/.env.example`, que é o que o projeto
 * da Vercel tem — a lista do plano citava seis e esquecia as quatro do OAuth.
 */

const RAIZ = path.resolve(__dirname, '../../../..');

function envKeys(relativo: string): string[] {
  return readFileSync(path.join(RAIZ, relativo), 'utf8')
    .split(/\r?\n/)
    .map((linha) => /^([A-Z][A-Z0-9_]*)=/.exec(linha)?.[1])
    .filter((chave): chave is string => chave !== undefined);
}

interface TurboJson {
  globalEnv?: string[];
  globalPassThroughEnv?: string[];
  tasks: Record<string, { env?: string[]; passThroughEnv?: string[] }>;
}

const turbo = JSON.parse(readFileSync(path.join(RAIZ, 'turbo.json'), 'utf8')) as TurboJson;
const runtimeOnly = envKeys('apps/web/.env.example').filter((k) => !k.startsWith('NEXT_PUBLIC_'));

describe('turbo.json: as variáveis do web', () => {
  it('reads the web env keys at all — an empty list would pass everything', () => {
    expect(runtimeOnly.length).toBeGreaterThanOrEqual(6);
    expect(runtimeOnly).toContain('CRON_SECRET');
  });

  it('passes every runtime variable of the web through, so strict mode does not hide it', () => {
    const passed = new Set(turbo.globalPassThroughEnv ?? []);
    expect(runtimeOnly.filter((k) => !passed.has(k))).toEqual([]);
  });

  it('passes through nothing the web does not declare — a stale name would rot here', () => {
    const declared = new Set(envKeys('apps/web/.env.example'));
    expect((turbo.globalPassThroughEnv ?? []).filter((k) => !declared.has(k))).toEqual([]);
  });

  it('keeps every secret out of the cache key', () => {
    const inKey = [
      ...(turbo.globalEnv ?? []),
      ...Object.values(turbo.tasks).flatMap((task) => task.env ?? []),
    ];
    expect(inKey.filter((k) => runtimeOnly.includes(k))).toEqual([]);
  });
});
