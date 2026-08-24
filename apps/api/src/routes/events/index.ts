import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ingestProductEvents } from '../../services/product-event.service';
import {
  ingestEventsBodySchema,
  ingestEventsResponseSchema,
  errorResponseSchema,
} from './schemas';

/**
 * Ingestão de eventos de produto (§6 de `docs/v2/04-analytics-e-slots.md`).
 *
 * **É pública e anônima, e é por isso que ela é chata com o corpo.** Não há
 * sessão para autenticar — a §4 proíbe justamente o identificador que serviria
 * para isso —, então o que separa evento de lixo é o schema. Tipo fora do
 * catálogo, `source` inventado, `sessionId` que não é UUID: 400, e nada é
 * gravado.
 *
 * **Sem `Cache-Control`**, pela mesma razão que as rotas de conta não têm: a
 * resposta é da requisição, não do recurso.
 */
export async function eventsRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/',
    {
      /**
       * **30/min, e para o tráfego real este balde é um só — não é por leitor.**
       *
       * O comentário anterior dizia "30/min por IP", e a frase é literalmente
       * verdadeira e enganosa: o caminho que carrega **todos** os eventos é
       * navegador → `POST /api/events` do Next → aqui, e o IP que chega é o da
       * função da Vercel, não o de quem estava lendo. O `trustProxy: 1` da Fase
       * 9 consertou o caminho navegador → API direto; este é o outro.
       *
       * Medido em produção em 24/08/2026, e as duas metades importam:
       *
       * - três requisições **diretas** consumiram o meu balde (`remaining` 29,
       *   28, 27) enquanto três **pelo BFF** não o tocaram — são baldes
       *   distintos, e o do BFF é compartilhado por todo mundo;
       * - **45 requisições pelo BFF em 12 segundos**: 10 passaram e **35
       *   voltaram 429**. Ou seja, uma máquina esgota, em doze segundos, o teto
       *   de ingestão do site inteiro.
       *
       * **O número fica em 30, e não porque esteja folgado: porque subi-lo não
       * compra proteção.** Com `PRODUCT_EVENT_BATCH_MAX = 20`, este teto já
       * permite 600 eventos por minuto — um script alcança as **200.000 linhas**
       * que disparam a dívida de agregação da `/metrics/product` em cerca de
       * cinco horas e meia. Dobrar o teto corta esse prazo pela metade e não
       * evita nada; o que limita o estrago de verdade é o lote de 20 e a
       * retenção de 90 dias. Do lado do tráfego legítimo, ~2 requisições por
       * pageview fazem deste teto uns 15 pageviews por minuto — quinze vezes o
       * pico plausível dos ~550 pageviews/dia que a outra dívida usa como marco.
       *
       * **A perda é silenciosa, e por isso o gatilho precisa ser observável:**
       * um 429 num `sendBeacon` não tem retorno que o cliente leia, então a tela
       * de métricas subcontaria sem sinal nenhum. O sinal existe e não precisa
       * de instrumentação nova — `GET /api/metrics/http` conta por rota e por
       * classe de status desde a Fase 9. **429 em `POST /api/events` ali é a
       * medida de quanto está sendo perdido.**
       */
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        summary: 'Ingest anonymous product analytics events',
        tags: ['events'],
        body: ingestEventsBodySchema,
        response: {
          201: ingestEventsResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await ingestProductEvents(request.body.events);

      // 201 e não 200: a requisição criou linhas. E o corpo diz **quantas** —
      // um `{ ok: true }` não deixaria como saber que metade do lote sumiu.
      return reply.status(201).send({ data: result });
    },
  );
}
