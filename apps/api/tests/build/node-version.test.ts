import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/**
 * **O Node que o Render executa é a linha do CI, sem pino de patch.**
 *
 * Achado de 22/10/2026, na conferência de fim de suporte das dependências: o
 * `render.yaml` fixava `NODE_VERSION: 22.12.0`, de dezembro de 2024. A linha 22
 * tem suporte até 30/04/2027, mas a API rodava uma versão anterior a todas as
 * correções de segurança de 2025 e 2026 (as de março, junho e julho de 2026
 * tinham *high* na 22.x, e o `undici` de que o pipeline depende para buscar os
 * feeds vem dentro do Node). O CI e a Vercel usam só a major — o CI testava a
 * 22.x mais nova, e produção rodava outra coisa.
 *
 * O Render lê `NODE_VERSION` antes de qualquer outra fonte e resolve uma major
 * para a versão mais nova dela a cada deploy. Daí as duas regras: **só a
 * major**, e **a mesma major de todo `node-version:` dos workflows** — o
 * que o CI aprova é o que vai ao ar.
 *
 * A leitura é estática, como as vizinhas de `tests/build/`.
 */

const REPO_ROOT = join(__dirname, '../../../..');
const WORKFLOWS_DIR = join(REPO_ROOT, '.github/workflows');

function renderNodeVersion(): unknown {
  const blueprint = parse(readFileSync(join(REPO_ROOT, 'render.yaml'), 'utf8')) as {
    services: Array<{ envVars?: Array<{ key: string; value?: unknown }> }>;
  };
  const entries = blueprint.services.flatMap((service) => service.envVars ?? []);
  return entries.find((entry) => entry.key === 'NODE_VERSION')?.value;
}

/** Todo `node-version:` declarado num workflow, como texto. */
function workflowNodeVersions(): string[] {
  return readdirSync(WORKFLOWS_DIR)
    .filter((name) => /\.ya?ml$/.test(name))
    .flatMap((name) => {
      const source = readFileSync(join(WORKFLOWS_DIR, name), 'utf8');
      return [...source.matchAll(/^\s*node-version:\s*['"]?([^'"\s#]+)/gm)].map((match) => match[1]);
    });
}

describe('render.yaml — NODE_VERSION', () => {
  it('declares only the major, so each deploy takes the newest patch of the line', () => {
    const version = renderNodeVersion();

    // String, não número: o YAML leria `22` sem aspas como inteiro.
    expect(typeof version).toBe('string');
    expect(version).toMatch(/^\d+$/);
  });

  it('runs the same major the CI tests', () => {
    const versions = workflowNodeVersions();

    // Uma varredura que não achasse nada aprovaria qualquer valor.
    expect(versions.length).toBeGreaterThan(0);
    expect(new Set(versions)).toEqual(new Set([renderNodeVersion()]));
  });
});
