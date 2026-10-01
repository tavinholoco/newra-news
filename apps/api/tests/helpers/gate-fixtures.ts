import type { OutputGuardVerdict } from '../../src/providers/ai/output-guard';
import type { EntryGateInput, EntryGateVerdict } from '../../src/services/pipeline-gates.service';

/**
 * Os vereditos "passou" dos dois portões da Fase 9, para as suítes do
 * **pipeline** — que medem a fiação, não o portão.
 *
 * As fixtures do `pipeline.test.ts` e do `pipeline-degraded.test.ts` têm
 * datas fixas de 2024 e de agosto de 2026 e duas fontes: o portão de frescor e
 * o de diversidade bloqueariam todo cenário, e cada asserção sobre a etapa 7
 * passaria a medir a etapa 5.5. O padrão é o do `runInvariants` (Fase 6): a
 * suíte do portão (`pipeline-gates.test.ts`, `output-guard.test.ts`) mede o
 * portão; a do pipeline mede o que ele faz com o veredito — e é aqui que
 * `evaluateEntryGate` ganha o `mockImplementation` que deixa a seleção passar.
 */

export function passingEntryGate(input: EntryGateInput): EntryGateVerdict {
  return {
    block: null,
    warnings: [],
    selected: input.selected,
    baseline: 'insufficient',
    measures: {
      volume: input.deduplicated.length,
      baselineDays: 0,
      median: null,
      volumeRatio: null,
      sources: new Set(input.selected.map((item) => item.source)).size,
      widened: false,
      freshestAgeHours: 1,
      duplicateRate: 0,
      categoryDrift: null,
    },
  };
}

export function passingOutputGuard(overrides: Partial<OutputGuardVerdict> = {}): OutputGuardVerdict {
  return {
    blocks: [],
    warnings: [],
    measures: { chars: 640, words: 100, ptRatio: 0.42, urls: 0 },
    ...overrides,
  };
}
