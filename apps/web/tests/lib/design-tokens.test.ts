import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Guardas da Fase 1 da V2 (docs/v2/01-design-tokens.md).
 *
 * A suíte de componentes não faz asserção sobre classe de cor, então nada
 * impediria a camada 1 de voltar a vazar para os componentes ou um
 * modificador de opacidade sobre `--text-muted` de reaparecer. Estes
 * testes são esse impedimento.
 */

const WEB_ROOT = process.cwd();
const SOURCE_DIRS = ['app', 'components'].map((dir) => path.resolve(WEB_ROOT, dir));

function collectSources(): Array<{ file: string; source: string }> {
  const files: Array<{ file: string; source: string }> = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.tsx?$/.test(entry)) {
        files.push({
          file: path.relative(WEB_ROOT, full),
          source: readFileSync(full, 'utf8'),
        });
      }
    }
  }

  for (const dir of SOURCE_DIRS) walk(dir);
  return files;
}

/** Lido uma vez: sao ~90 arquivos e sete testes varrem os mesmos. */
const SOURCES = collectSources();

function findMatches(pattern: RegExp): string[] {
  return SOURCES.flatMap(({ file, source }) =>
    [...source.matchAll(pattern)].map((match) => `${file}: ${match[0]}`),
  );
}

describe('camada semântica dos tokens', () => {
  it('nenhum componente consome a camada 1 da paleta direto', () => {
    // `brand-600`, `ink-950`, `night-800`... não entram no `@theme`, então uma
    // classe dessas não gera CSS nenhum — falha silenciosa. Ver §1.
    const palette =
      /\b(?:bg|text|border|border-[lrtxyb]|ring|from|to|via|fill|stroke|outline|decoration|divide|shadow|accent|caret|placeholder)-(?:brand-(?:50|100|500|600|700|800|950)|ink-(?:500|700|950)|night-(?:500|700|800|900)|mist-(?:100|300|400)|ember-(?:400|500)|paper|line-(?:100|500))\b/g;

    expect(findMatches(palette)).toEqual([]);
  });

  it('nenhum componente dilui --text-muted com opacidade', () => {
    // O nível mais claro que já passa AA sólido não tem margem para diluir:
    // /70 dá 2,70:1, /50 dá 1,96:1 e /40 dá 1,69:1 sobre `paper`. Ver §4.
    expect(findMatches(/\btext-muted-foreground\/\d+/g)).toEqual([]);
  });

  it('nenhum componente usa cor crua do Tailwind para estado', () => {
    // Sucesso, erro e alerta têm par nomeado e medido nos dois temas (§2).
    const raw =
      /\b(?:bg|text|border|ring)-(?:green|emerald|red|rose|amber|yellow|lime|teal|sky|blue|indigo|violet|purple|pink|orange)-\d{2,3}\b/g;

    expect(findMatches(raw)).toEqual([]);
  });

  it('nenhuma cor fixa de tema, fora dos quatro véus declarados', () => {
    /**
     * **O buraco que a revisão 10.3 achou na própria guarda.** A varredura de
     * cor crua acima exige sufixo numérico (`-\d{2,3}`), então
     * `bg-white`, `text-black` e os cinzas neutros (`gray`, `slate`, `zinc`,
     * `neutral`, `stone`) passavam batido — e são justamente as classes que
     * **somem no claro e ficam ilegíveis no escuro**. Foi esse o bug da Fase 5
     * da V1, e a baseline não pegava porque nove das doze rotas não tinham
     * captura escura nenhuma.
     *
     * As quatro ocorrências que existem hoje são **véu sobre conteúdo**, não
     * superfície: preto translúcido por cima de uma foto ou por cima da página.
     * Véu não inverte com o tema — a foto é a mesma nos dois —, e por isso são
     * exceção declarada em vez de exceção esquecida.
     */
    const VEUS_PERMITIDOS: Record<string, string> = {
      'components/editorial/save-button.tsx':
        'véu sobre a foto do card: `bg-black/40` + `text-white` precisam ser fixos porque a imagem é a mesma nos dois temas',
      'components/layout/mobile-nav.tsx':
        'véu do menu mobile sobre a página: `bg-black/30`',
    };

    const FIXAS =
      /\b(?:bg|text|border|ring|from|to|via|divide|decoration|outline)-(?:white|black)(?:\/\d+)?\b/;
    const NEUTRAS =
      /\b(?:bg|text|border|ring|from|to|via|divide)-(?:gray|slate|zinc|neutral|stone)-\d{2,3}\b/g;

    // Cinza neutro do Tailwind nao tem desculpa: a escala semantica tem
    // superficie, linha e tres niveis de texto, todos redeclarados no `.dark`.
    expect(findMatches(NEUTRAS)).toEqual([]);

    // Sem a flag `g` no teste por arquivo: `RegExp.test` com `g` guarda
    // `lastIndex` entre chamadas e pula arquivo sim, arquivo nao.
    const arquivosComFixa = SOURCES.filter(({ source }) => FIXAS.test(source))
      .map(({ file }) => file.split(String.fromCharCode(92)).join('/'))
      .sort();

    expect(arquivosComFixa).toEqual(Object.keys(VEUS_PERMITIDOS).sort());
  });

  it('o radius fica nos 5 níveis da escala', () => {
    // `rounded-xl`/`2xl`/`3xl`/`4xl` continuam existindo como utility do
    // Tailwind, com valores fora da escala. Manter dois nomes para o mesmo
    // 12px foi o que abriu essa brecha na primeira versão da Fase 1. Ver §8.
    expect(
      findMatches(/\brounded(?:-(?:t|b|l|r|tl|tr|bl|br))?-(?:xl|2xl|3xl|4xl)\b/g),
    ).toEqual([]);
  });

  it('nenhuma duração de transição fora da escala de motion', () => {
    // `duration-300` passa por cima de `--duration-slow` (240ms) do mesmo jeito
    // que uma cor crua passa por cima da paleta. Ver §8, "Motion".
    expect(findMatches(/\bduration-\d+/g)).toEqual([]);
  });

  it('conteúdo editorial não usa sombra fora dos tokens de overlay', () => {
    // Separação vem de borda, superfície e espaço (§8). Só `shadow-overlay` e
    // `shadow-modal` são legítimos, e ambos são de camada flutuante.
    expect(
      findMatches(/\bshadow-(?!overlay\b|modal\b|none\b)[a-z0-9-]+/g),
    ).toEqual([]);
  });
});

describe('tokens.css', () => {
  const tokens = readFileSync(path.resolve(WEB_ROOT, 'styles/tokens.css'), 'utf8');

  function declaredIn(block: string): Set<string> {
    const names = new Set<string>();
    for (const match of block.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)) {
      if (match[1]) names.add(match[1]);
    }
    return names;
  }

  const rootBlock = tokens.slice(tokens.indexOf(':root {'), tokens.indexOf('.dark {'));
  const themeBlock = tokens.slice(tokens.indexOf('@theme inline {'));

  it('toda utility de cor aponta para uma variável declarada em :root', () => {
    // Um `var(--typo)` não declarado não é erro de build: a utility simplesmente
    // deixa de pintar. Este teste transforma isso em falha de suíte.
    const declared = declaredIn(rootBlock);
    const referenced = [
      ...themeBlock.matchAll(/^\s*--color-[a-z0-9-]+:\s*var\((--[a-z0-9-]+)\)/gm),
    ].flatMap((match) => (match[1] ? [match[1]] : []));
    const dangling = referenced.filter((name) => !declared.has(name));

    expect(dangling).toEqual([]);
  });

  it('o .dark redeclara só a camada semântica, nunca a paleta', () => {
    const darkBlock = tokens.slice(tokens.indexOf('.dark {'), tokens.indexOf('@theme inline {'));
    const paletteNames =
      /^--(?:brand-\d+|ink-\d+|night-\d+|mist-\d+|ember-\d+|paper|white|yellow|line-\d+|danger-\d+|success-\d+)$/;

    const leaked = [...declaredIn(darkBlock)].filter((name) =>
      paletteNames.test(name),
    );

    expect(leaked).toEqual([]);
  });

  it('as 8 variáveis --sidebar-* do boilerplate do shadcn não existem mais', () => {
    // Declaração, não menção: o cabeçalho do arquivo cita o nome ao explicar
    // por que elas saíram.
    const declared = [...declaredIn(tokens)].filter((name) =>
      name.startsWith('--sidebar'),
    );

    expect(declared).toEqual([]);
  });
});
