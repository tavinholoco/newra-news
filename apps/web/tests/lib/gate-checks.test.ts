import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GATE_CHECK_KEY } from '@/components/admin/gates-panel';

/**
 * **Os rótulos por motivo do painel de portões acompanham o conjunto da API.**
 *
 * O `route` de um `PIPELINE_GATE_BLOCKED` é `stage-6.5:<check>`, e o check é
 * um dos onze que a API declara em dois tuples — `ENTRY_GATE_CHECKS` em
 * `pipeline-gates.service.ts` e `OUTPUT_GUARD_CHECKS` em `output-guard.ts`.
 * O painel os traduz por um mapa escrito à mão (chave montada em runtime
 * parece órfã para o teste de i18n), e mapa escrito à mão é a família do `13`
 * dos feeds: um check novo na API entraria na rosquinha pelo nome cru, sem
 * ninguém notar. Esta guarda deriva o conjunto dos dois arquivos, nas duas
 * direções — como o `hand-written-lists.test.ts` faz com as listas do smoke.
 */

const API_SRC = path.resolve(__dirname, '../../../api/src');

/** Os literais de um `export const NAME = [ 'a', 'b' ] as const;`. */
function tupleOf(file: string, name: string): string[] {
  const source = readFileSync(path.join(API_SRC, file), 'utf8');
  const match = new RegExp(`export const ${name} = \\[([^\\]]*)\\] as const`).exec(source);
  if (!match) throw new Error(`${name} não encontrado em ${file}`);
  return [...(match[1] as string).matchAll(/'([a-z-]+)'/g)].map((m) => m[1] as string);
}

describe('os motivos do painel de portões são os checks da API', () => {
  const entry = tupleOf('services/pipeline-gates.service.ts', 'ENTRY_GATE_CHECKS');
  const exit = tupleOf('providers/ai/output-guard.ts', 'OUTPUT_GUARD_CHECKS');

  it('finds the two tuples at all — an empty match would pass everything', () => {
    expect(entry).toContain('volume');
    expect(exit).toContain('unanchored-url');
  });

  it('labels every check the API can write, and no check the API does not', () => {
    expect(Object.keys(GATE_CHECK_KEY).sort()).toEqual([...entry, ...exit].sort());
  });
});
