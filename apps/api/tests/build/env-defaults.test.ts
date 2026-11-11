import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { parse } from 'yaml';

/**
 * **O default do schema, o blueprint, o `.env.example` e as tabelas da
 * documentação dizem o mesmo valor.**
 *
 * Achado de 11/11/2026, no plano de ação da análise dos pipelines
 * (`docs/pipeline-action-plan-2026-11.md`, P2 e P3). Trocar o modelo da Gemini
 * ou o horário do cron interno é mudar **um** valor que mora em seis lugares: o
 * `.default()` de `src/config/env.ts`, o `value:` do `render.yaml`, o
 * `.env.example`, a tabela do `docs/setup.md` e as dos dois READMEs. Nenhum
 * deles lê o outro, e a mudança abre um ou dois. O que diverge em silêncio é o
 * pior: o blueprint é o que um serviço recriado recebe, e o default é o que
 * vale quando o painel não declara a variável.
 *
 * E o valor que importa tem prazo: o `gemini-2.5-flash` desliga a partir de
 * 01/12/2026, com as chamadas roteadas sozinhas para outro modelo — o
 * `modelVersion` gravado no briefing passaria a mentir.
 *
 * A leitura é estática, como as vizinhas de `tests/build/`: importar
 * `src/config/env` executaria o parse de carga do módulo, que chama
 * `process.exit(1)` quando falta variável.
 */

const REPO_ROOT = join(__dirname, '../../../..');
const ENV_SOURCE = join(__dirname, '../../src/config/env.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8').split('\r\n').join('\n');
}

/** `KEY → default` de todo campo do `envSchema` com `.default(<literal>)`. */
function schemaDefaults(): Map<string, string> {
  const source = ts.createSourceFile(ENV_SOURCE, read(ENV_SOURCE), ts.ScriptTarget.Latest, true);
  const defaults = new Map<string, string>();

  function defaultOf(node: ts.Expression): string | undefined {
    let current: ts.Expression = node;
    while (ts.isCallExpression(current)) {
      const callee = current.expression;
      if (!ts.isPropertyAccessExpression(callee)) return undefined;
      const [argument] = current.arguments;
      if (callee.name.text === 'default' && argument) {
        if (ts.isStringLiteral(argument) || ts.isNumericLiteral(argument)) return argument.text;
        return undefined;
      }
      current = callee.expression;
    }
    return undefined;
  }

  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'envSchema' &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const [shape] = node.initializer.arguments;
      if (shape && ts.isObjectLiteralExpression(shape)) {
        for (const property of shape.properties) {
          if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) continue;
          const value = defaultOf(property.initializer);
          if (value !== undefined) defaults.set(property.name.text, value);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return defaults;
}

/** `KEY → value` das variáveis do blueprint que declaram valor (não `sync: false`). */
function blueprintValues(): Map<string, string> {
  const blueprint = parse(read(join(REPO_ROOT, 'render.yaml'))) as {
    services: Array<{ envVars?: Array<{ key: string; value?: unknown }> }>;
  };
  const values = new Map<string, string>();
  for (const service of blueprint.services) {
    for (const variable of service.envVars ?? []) {
      if (variable.value !== undefined) values.set(variable.key, String(variable.value));
    }
  }
  return values;
}

/** `KEY → value` das linhas não comentadas do `.env.example`. */
function envExampleValues(): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of read(join(REPO_ROOT, 'apps/api/.env.example')).split('\n')) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (match) values.set(match[1] as string, match[2] as string);
  }
  return values;
}

/**
 * `KEY → default escrito` nas linhas de tabela de um documento: a linha que
 * abre com `` | `KEY` | `` e traz a palavra do default seguida de um valor
 * entre crases.
 */
function documentedDefaults(path: string, word: RegExp): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of read(join(REPO_ROOT, path)).split('\n')) {
    const key = /^\|\s*`([A-Z][A-Z0-9_]*)`\s*\|/.exec(line);
    if (!key) continue;
    const value = new RegExp(`${word.source}\\s+\`([^\`]*)\``).exec(line);
    if (value) values.set(key[1] as string, value[1] as string);
  }
  return values;
}

const DOCUMENTS: Array<{ path: string; word: RegExp }> = [
  { path: 'docs/setup.md', word: /default/ },
  { path: 'README.md', word: /Defaults to/ },
  { path: 'README.pt-BR.md', word: /Padrão/ },
];

/**
 * O blueprint pode declarar outro valor que o default, e diz por quê: o
 * default é o ambiente local, e o blueprint é produção.
 */
const BLUEPRINT_DIFFERS: Record<string, string> = {
  NODE_ENV: 'o default é desenvolvimento; o blueprint é produção',
  SITE_URL: 'o default é o web local; o blueprint aponta o web de produção',
};

/**
 * Modelos com desligamento anunciado pelo provedor — lidos na página oficial
 * de cada um. O default não pode apontar para nenhum deles.
 */
const SHUTDOWN_ANNOUNCED: Record<string, string> = {
  // aistudio.google.com/docs/deprecations, lida em 11/11/2026: desligamento
  // mais cedo em 01/12/2026, com roteamento automático para outro modelo.
  'gemini-2.5-flash': '2026-12-01',
  // Groq, deprecado com desligamento em 16/08/2026 (o comentário do blueprint).
  'llama-3.1-8b-instant': '2026-08-16',
};

describe('os defaults da API: schema, blueprint, .env.example e documentação', () => {
  const defaults = schemaDefaults();

  it('o parser acha os defaults do schema', () => {
    // Sem isto, um parser que devolvesse um mapa vazio faria todas as
    // asserções abaixo passarem para sempre.
    expect(defaults.get('GEMINI_MODEL')).toBeDefined();
    expect(defaults.get('CRON_SCHEDULE')).toBeDefined();
    expect(defaults.get('PORT')).toBe('3001');
    expect(defaults.size).toBeGreaterThanOrEqual(10);
  });

  it('o blueprint publica o default do schema', () => {
    const blueprint = blueprintValues();
    const compared: string[] = [];
    for (const [key, value] of blueprint) {
      const fallback = defaults.get(key);
      if (fallback === undefined || key in BLUEPRINT_DIFFERS) continue;
      compared.push(key);
      expect(value, `render.yaml → ${key}`).toBe(fallback);
    }
    expect(compared).toEqual(expect.arrayContaining(['GEMINI_MODEL', 'GROQ_MODEL', 'CRON_SCHEDULE', 'CRON_TIMEZONE']));
  });

  it('as exceções do blueprint ainda existem e ainda diferem', () => {
    const blueprint = blueprintValues();
    for (const key of Object.keys(BLUEPRINT_DIFFERS)) {
      expect(blueprint.get(key), key).toBeDefined();
      expect(blueprint.get(key), key).not.toBe(defaults.get(key));
    }
  });

  it('o .env.example escreve o default do schema', () => {
    const example = envExampleValues();
    const compared: string[] = [];
    for (const [key, value] of example) {
      const fallback = defaults.get(key);
      if (fallback === undefined) continue;
      compared.push(key);
      expect(value, `.env.example → ${key}`).toBe(fallback);
    }
    expect(compared).toEqual(expect.arrayContaining(['GEMINI_MODEL', 'CRON_SCHEDULE']));
  });

  it.each(DOCUMENTS)('a tabela de $path escreve o default do schema', ({ path, word }) => {
    const documented = documentedDefaults(path, word);
    expect(documented.has('GEMINI_MODEL'), `${path} sem a linha do GEMINI_MODEL`).toBe(true);
    expect(documented.has('CRON_SCHEDULE'), `${path} sem a linha do CRON_SCHEDULE`).toBe(true);
    for (const [key, value] of documented) {
      const fallback = defaults.get(key);
      if (fallback === undefined) continue;
      expect(value, `${path} → ${key}`).toBe(fallback);
    }
  });

  it('o default dos modelos não é um modelo com desligamento anunciado', () => {
    for (const key of ['GEMINI_MODEL', 'GROQ_MODEL']) {
      const model = defaults.get(key) as string;
      expect(SHUTDOWN_ANNOUNCED[model], `${key} = ${model}`).toBeUndefined();
    }
  });

  it('o cron interno não dispara no topo da hora', () => {
    // Os runs que o cron interno começava às 11:00:00 UTC caíram no Groq 8 de
    // 9 vezes (503 "high demand" da Gemini), contra 1 de 7 dos que o cron da
    // Vercel começava às ~11:30 — medido em 10/11/2026. Correlação, não causa
    // provada; e o topo da hora é onde todo agendador do mundo dispara.
    const [minute] = (defaults.get('CRON_SCHEDULE') as string).split(/\s+/);
    expect(minute).toMatch(/^\d+$/);
    expect(Number(minute)).not.toBe(0);
  });
});
