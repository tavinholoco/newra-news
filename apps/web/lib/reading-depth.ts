import type { ProductMetrics } from '@newranews/types';

/**
 * A leitura completa, como a tela a mostra.
 *
 * - `unavailable` — a API no ar não manda `viewed`/`completed`. O preview da
 *   `dev` lê a API de produção, que só ganha os dois campos na promoção
 *   (armadilha 37 do plano de observabilidade). Dividir pelo campo ausente
 *   daria `NaN`; dividir pelos cliques voltaria à métrica que contava as
 *   ferramentas.
 * - `no-sample` — nenhuma tela de leitura vista na janela. Zero sobre zero não
 *   é 0 %, é falta de amostra (armadilha 24).
 * - `measured` — `completed / viewed`, que nunca passa de 1: os dois são
 *   contados sobre o mesmo par (sessão, conteúdo).
 */
export type ReadThrough =
  | { state: 'unavailable' }
  | { state: 'no-sample'; viewed: 0 }
  | { state: 'measured'; viewed: number; rate: number };

export function readThroughOf(depth: ProductMetrics['readingDepth']): ReadThrough {
  const { viewed, completed } = depth as Partial<ProductMetrics['readingDepth']>;
  if (typeof viewed !== 'number' || typeof completed !== 'number') {
    return { state: 'unavailable' };
  }
  if (viewed === 0) return { state: 'no-sample', viewed: 0 };
  return { state: 'measured', viewed, rate: completed / viewed };
}
