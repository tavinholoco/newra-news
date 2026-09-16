/**
 * Devolve o event loop ao Node.
 *
 * `setImmediate` roda na fase *check*, **depois** da fase de poll — então o
 * I/O que estava esperando (a conexão do health check, entre outras) é atendido
 * antes de a varredura continuar. `await Promise.resolve()` não serve: a
 * microtask volta para o mesmo tick e nada de I/O acontece no meio.
 *
 * Nasceu no `news-renormalizer.service.ts` depois de 03/09/2026 — a varredura
 * do acervo segurou a CPU por 45 s numa instância de 0.1 vCPU, os health
 * checks de 5 s pararam de ser respondidos e o Render matou o processo no
 * meio da etapa. **Mora aqui desde a Fase 6** porque a suíte de invariantes
 * respira pelo mesmo helper entre uma checagem e outra (§10 do plano manda
 * reusar, não copiar), e ela não pode importar o renormalizador: as suítes do
 * pipeline o substituem por uma fábrica que só tem `renormalizeStoredNews`, e
 * um import de valor de lá chegaria `undefined` à etapa 9.5.
 *
 * O teste que trava o comportamento não confere `take`: pergunta **em que
 * ponto** do laço o event loop girou (um `setImmediate` agendado antes, um
 * contador lido dentro). É assim nos dois consumidores.
 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}
