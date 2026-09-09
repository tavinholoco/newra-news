import { describe, it, expect } from 'vitest';
import { pipelineContext, pipelineLogMixin } from '../../src/utils/logger';

/**
 * **A correlação, medida como fato e não como intenção.**
 *
 * A promessa da Fase 1 é que toda linha escrita durante um run do pipeline
 * carregue o `pipelineLogId` **sem que nenhuma função mude de assinatura** — os
 * avisos que interessam são escritos três camadas abaixo de `runPipeline`, no
 * `news-fetcher`, nos dois providers de notícia e no retry do `ai-utils`.
 *
 * A alternativa seria passar um logger por essas camadas, e é aí que a
 * correlação vira intenção: basta uma camada esquecer o parâmetro para o rastro
 * sumir, sem nada acusar. O que esta suíte afirma é a propriedade que substitui
 * essa disciplina — o contexto atravessa profundidade **e** fronteira de
 * `await`, que é onde um `try/finally` com variável de módulo se perderia.
 */
describe('pipelineLogMixin', () => {
  it('adds nothing outside a pipeline run', () => {
    // Toda requisição HTTP passa por aqui. Um campo indefinido em cada linha do
    // log seria ruído em 100% do tráfego para servir a um run por dia.
    expect(pipelineLogMixin()).toEqual({});
  });

  it('carries the run id inside the run', () => {
    const inside = pipelineContext.run({ pipelineLogId: 'log-1' }, () =>
      pipelineLogMixin(),
    );

    expect(inside).toEqual({ pipelineLogId: 'log-1' });
  });

  it('survives depth and awaits — which is the whole reason it is an ALS', async () => {
    async function terceiraCamada(): Promise<Record<string, unknown>> {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return pipelineLogMixin();
    }
    const segundaCamada = () => terceiraCamada();

    const inside = await pipelineContext.run({ pipelineLogId: 'log-2' }, () =>
      segundaCamada(),
    );

    expect(inside).toEqual({ pipelineLogId: 'log-2' });
  });

  it('does not leak out of the run that set it', async () => {
    await pipelineContext.run({ pipelineLogId: 'log-3' }, async () => {
      await Promise.resolve();
    });

    // Dois runs no mesmo processo é o caso do `triggerPipeline` disparado duas
    // vezes no dia; o segundo não pode herdar o id do primeiro.
    expect(pipelineLogMixin()).toEqual({});
  });
});
