// Confere o contraste dos pares de token da V2 (docs/v2/01-design-tokens.md §4).
//
// A Fase 0 mediu os pares no papel; este script mede o que o código realmente
// compõe — incluindo os modificadores de opacidade, que são o caso em que um
// token aprovado sólido reprova depois de diluído. Reexecute a cada fase que
// introduzir combinação nova de cor.
//
//   node apps/web/scripts/check-contrast.mjs
//
// Sai com código 1 se algum par obrigatório reprovar.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const TOKENS_FILE = path.join(import.meta.dirname, '../styles/tokens.css');

/** Lê a camada 1 do tokens.css — é a única com valores literais. */
function readPalette() {
  const css = readFileSync(TOKENS_FILE, 'utf8');
  const palette = {};
  for (const [, name, value] of css.matchAll(
    /^\s*--([a-z0-9-]+):\s*(#[0-9a-f]{6})\s*;/gim,
  )) {
    palette[name] = value;
  }
  return palette;
}

const P = readPalette();

function toRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Luminância relativa da WCAG 2.2. */
function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/** Cor com opacidade sobre um fundo opaco → cor sólida equivalente. */
function composite(fg, bg, alpha) {
  const [fr, fg_, fb] = toRgb(fg);
  const [br, bg_, bb] = toRgb(bg);
  const mix = (f, b) => Math.round(f * alpha + b * (1 - alpha));
  const hex = (n) => n.toString(16).padStart(2, '0');
  return `#${hex(mix(fr, br))}${hex(mix(fg_, bg_))}${hex(mix(fb, bb))}`;
}

// `normal` = 4,5:1 (texto corrido) · `large` = 3:1 (texto ≥ 24px e componentes
// de interface, incluindo bordas de controle — WCAG 1.4.11).
const CASES = [
  // --- §4, "O que passa": os pares que o documento afirma ---
  ['ink-950 sobre paper', P['ink-950'], P.paper, 'normal'],
  ['ink-700 sobre paper', P['ink-700'], P.paper, 'normal'],
  ['ink-500 sobre paper', P['ink-500'], P.paper, 'normal'],
  ['brand-700 sobre paper', P['brand-700'], P.paper, 'normal'],
  ['brand-700 sobre brand-50', P['brand-700'], P['brand-50'], 'normal'],
  ['brand-700 sobre brand-100', P['brand-700'], P['brand-100'], 'normal'],
  ['white sobre brand-700', P.white, P['brand-700'], 'normal'],
  ['white sobre brand-950', P.white, P['brand-950'], 'normal'],
  ['mist-100 sobre night-900', P['mist-100'], P['night-900'], 'normal'],
  ['mist-300 sobre night-700', P['mist-300'], P['night-700'], 'normal'],
  ['mist-400 sobre night-700', P['mist-400'], P['night-700'], 'normal'],
  ['ember-500 sobre night-900', P['ember-500'], P['night-900'], 'normal'],

  // --- estado, os dois temas ---
  ['success-600 sobre paper', P['success-600'], P.paper, 'normal'],
  ['success-400 sobre night-900', P['success-400'], P['night-900'], 'normal'],
  ['danger-600 sobre paper', P['danger-600'], P.paper, 'normal'],
  ['danger-400 sobre night-900', P['danger-400'], P['night-900'], 'normal'],
  ['danger-600 sobre surface (white)', P['danger-600'], P.white, 'normal'],

  // --- bordas de controle: 3:1 pela 1.4.11 ---
  ['line-500 sobre paper', P['line-500'], P.paper, 'large'],
  ['line-500 sobre white', P['line-500'], P.white, 'large'],
  ['night-500 sobre night-900', P['night-500'], P['night-900'], 'large'],
  ['night-500 sobre night-800', P['night-500'], P['night-800'], 'large'],
  ['night-500 sobre night-700', P['night-500'], P['night-700'], 'large'],

  // --- ícone e borda em brand: componentes de interface ---
  ['brand-600 sobre brand-50 (ícone)', P['brand-600'], P['brand-50'], 'large'],
  ['ember-500 sobre night-800 (ícone)', P['ember-500'], P['night-800'], 'large'],
  ['brand-600 sobre paper (ícone)', P['brand-600'], P.paper, 'large'],

  // --- o "404": ornamento, não texto. Só precisa existir. ---
  ['line-500 sobre paper (ornamento)', P['line-500'], P.paper, 'large'],
  ['night-500 sobre night-900 (ornamento)', P['night-500'], P['night-900'], 'large'],

  // --- composições de opacidade que o código realmente usa ---
  ['text-foreground/80 sobre paper', composite(P['ink-950'], P.paper, 0.8), P.paper, 'normal'],
  ['text-foreground/70 sobre paper', composite(P['ink-950'], P.paper, 0.7), P.paper, 'normal'],
  ['text-foreground/60 sobre paper', composite(P['ink-950'], P.paper, 0.6), P.paper, 'normal'],
  ['text-foreground/80 sobre night-900', composite(P['mist-100'], P['night-900'], 0.8), P['night-900'], 'normal'],
  ['text-foreground/70 sobre night-900', composite(P['mist-100'], P['night-900'], 0.7), P['night-900'], 'normal'],
  ['text-foreground/60 sobre night-900', composite(P['mist-100'], P['night-900'], 0.6), P['night-900'], 'normal'],

  // --- rodapé: superfície de marca escura nos dois temas ---
  ['text-on-brand/70 sobre brand-950', composite(P.white, P['brand-950'], 0.7), P['brand-950'], 'normal'],
  ['text-on-brand/70 sobre night-900', composite(P.white, P['night-900'], 0.7), P['night-900'], 'normal'],
  ['text-on-brand/80 sobre brand-600 (placeholder)', composite(P.white, P['brand-600'], 0.8), P['brand-600'], 'large'],
  ['border-on-brand/50 sobre brand-950 (input)', composite(P.white, P['brand-950'], 0.5), P['brand-950'], 'large'],
  ['border-on-brand/50 sobre night-900 (input)', composite(P.white, P['night-900'], 0.5), P['night-900'], 'large'],
  ['placeholder on-brand/70 sobre brand-950', composite(P.white, P['brand-950'], 0.7), P['brand-950'], 'normal'],
  ['success-400 sobre brand-950 (rodapé)', P['success-400'], P['brand-950'], 'normal'],
  ['danger-300 sobre brand-950 (rodapé)', P['danger-300'], P['brand-950'], 'normal'],
  ['danger-300 sobre night-900 (rodapé)', P['danger-300'], P['night-900'], 'normal'],
  ['success-400 sobre night-900 (rodapé)', P['success-400'], P['night-900'], 'normal'],

  // --- rampa do gráfico: barra é componente de interface ---
  ...['#a83e1c', '#c97a1e', '#5e7a4a', '#3d6b7d', '#6b5b8a'].map((color, i) => [
    `chart-${i + 1} sobre brand-50 (trilho claro)`,
    color,
    P['brand-50'],
    'large',
  ]),
  ...['#f07a45', '#f0b45e', '#9dc183', '#7fb4c9', '#b0a0d0'].map((color, i) => [
    `chart-${i + 1} sobre night-700 (trilho escuro)`,
    color,
    P['night-700'],
    'large',
  ]),
];

const THRESHOLD = { normal: 4.5, large: 3 };

let failed = 0;
console.log('par'.padEnd(46), 'ratio'.padStart(7), ' alvo  veredito');
console.log('-'.repeat(78));

for (const [label, fg, bg, level] of CASES) {
  const value = ratio(fg, bg);
  const target = THRESHOLD[level];
  const ok = value >= target;
  if (!ok) failed += 1;
  console.log(
    label.padEnd(46),
    `${value.toFixed(2)}:1`.padStart(7),
    ` ${target.toFixed(1)}   ${ok ? 'passa' : 'REPROVA'}`,
  );
}

console.log('-'.repeat(78));
console.log(`${CASES.length} pares · ${failed} reprovando`);
process.exit(failed === 0 ? 0 : 1);
