import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Nomes da escala tipográfica da V2 (§8 dos tokens), declarados para o
 * `tailwind-merge`.
 *
 * Sem isto, `cn('text-meta', 'text-ink-muted')` devolve **só** `text-meta`.
 * O `tailwind-merge` resolve `text-<valor>` por heurística: `text-sm` ele
 * conhece como tamanho, `text-red-500` como cor, e qualquer outra coisa cai
 * num grupo só — então um tamanho nomeado e uma cor nomeada viram "conflito"
 * e a última classe apaga a primeira.
 *
 * O efeito não aparece em build, lint nem teste de tipo: a classe some do HTML
 * e o elemento herda a cor do pai. Foi assim que a linha de metadata dos cards
 * (`ArticleMeta`) ficou desde a Fase 1 renderizando em `--ink` cheio em vez de
 * `--ink-muted` — passava no contraste (17:1) e por isso o Lighthouse nunca
 * reclamou; o que se perdia era a hierarquia, que é justamente o problema que
 * a §2.2 aponta na V1.
 *
 * Declarando a escala como `font-size`, `text-h3` e `text-ink` passam a viver
 * em grupos diferentes e sobrevivem juntos.
 */
const TYPOGRAPHY_SCALE = [
  'display',
  'h1',
  'h2',
  'h3',
  'h4',
  'body-lg',
  'body',
  'body-sm',
  'meta',
  'overline',
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...TYPOGRAPHY_SCALE] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
