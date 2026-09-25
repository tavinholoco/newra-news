import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

/**
 * **Toda suíte que lê fonte tem uma mutação que a derruba — ou um motivo
 * escrito para não ter.** (Fase 12 do plano de observabilidade, M1.)
 *
 * `scripts/guard-mutations.mjs` quebra cada guarda de propósito e confere que
 * ela reprova pelo teste certo. Rodar as mutações leva minutos e fica à mão;
 * **a cobertura**, não: ela é a parte que apodrece sozinha. A lista original do
 * M1 era digitada e deixava onze guardas de fora — a da fiação do logger entre
 * elas —, e uma guarda nova escrita amanhã ficaria fora do mesmo jeito.
 *
 * Aqui o CI roda só a derivação (`--coverage`, sem vitest aninhado): toda
 * suíte que chama `createSourceFile`, `readFileSync` ou `readdirSync` — ou
 * importa um helper de `tests/` que chama — tem de estar na tabela de
 * mutações ou em `EXCLUDED`, com o motivo. Guarda nova nasce pedindo a
 * mutação que a vê reprovar, que é a regra da §2 do plano.
 */

const RAIZ = path.resolve(__dirname, '../../../..');
const SCRIPT = path.join(RAIZ, 'scripts/guard-mutations.mjs');

function coverage(): { status: number | null; output: string } {
  const res = spawnSync(process.execPath, [SCRIPT, '--coverage'], { cwd: RAIZ, encoding: 'utf8' });
  return { status: res.status, output: `${res.stdout}${res.stderr}` };
}

describe('scripts/guard-mutations.mjs — a cobertura derivada', () => {
  it('registers every source-reading suite as a mutation or a written exclusion', () => {
    const { status, output } = coverage();

    expect(output.split('\n').filter((line) => line.includes('✗'))).toEqual([]);
    expect(status).toBe(0);
  });

  it('finds source-reading suites at all — a scan that finds nothing would pass everything', () => {
    const match = coverage().output.match(/Cobertura: (\d+) suítes leem fonte · (\d+) suítes na tabela/);

    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeGreaterThan(40);
    expect(Number(match?.[2])).toBeGreaterThan(30);
  });
});
