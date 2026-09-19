import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import {
  ERROR_EVENT_FLUSH_MS,
  flushErrorEvents,
  flushErrorEventsBeforeClose,
} from '../services/error-event.service';

/**
 * Quem tira o `ErrorEvent` da memória e o põe no banco.
 *
 * `recordError` é síncrona por contrato — ela muta um `Map` e retorna —, então
 * alguém precisa persistir depois. São dois gatilhos, e cada um cobre o que o
 * outro não cobre:
 *
 * - **o intervalo**, a cada {@link ERROR_EVENT_FLUSH_MS}, que é o caminho
 *   normal;
 * - **o `onClose`**, que é o caminho do desligamento — e este projeto tem
 *   história com ele: em 03/09/2026 o Render mandou `SIGTERM` no meio de uma
 *   etapa, e o `server.ts` chama `app.close()` antes do `process.exit`. Sem o
 *   flush aqui, tudo que estivesse no buffer morreria junto, e o que se perde
 *   num desligamento é exatamente o registro do que o causou.
 *
 * ## `unref()`, e por que ele importa aqui
 *
 * Um `setInterval` mantém o processo vivo enquanto existir. Isto é registrado
 * pelo `buildApp`, que roda em **toda suíte de rota** — sem `unref()`, cada
 * uma delas passaria a segurar o event loop por 30 s depois do último teste. O
 * `unref()` diz ao Node para não contar este timer ao decidir se ainda há o que
 * fazer; em produção o processo vive por causa do servidor HTTP, então nada
 * muda lá.
 *
 * **O plugin não é condicionado a ambiente**, e isso é de propósito: a lição do
 * `resolveLevel` do logger é que "ligado só fora de teste" faz o teste medir um
 * sistema diferente do que roda. Aqui o buffer é memória e o flush só toca o
 * banco quando há o que gravar — em teste, quase sempre não há.
 */
export const errorEventsPlugin = fp(async function errorEventsPlugin(app: FastifyInstance) {
  const timer = setInterval(() => {
    void flushErrorEvents();
  }, ERROR_EVENT_FLUSH_MS);
  timer.unref();

  app.addHook('onClose', async () => {
    clearInterval(timer);
    // Com prazo: desligamento nao espera banco sem limite. Ver
    // `ERROR_EVENT_CLOSE_TIMEOUT_MS`.
    await flushErrorEventsBeforeClose();
  });
});
