import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { recordClientError } from '../../services/client-error.service';
import { clientErrorAcceptedSchema, clientErrorReportSchema, errorResponseSchema } from './schemas';

/**
 * O caminho de ingestão do erro do cliente — §11.3 do plano de observabilidade
 * (Fase 7c).
 *
 * **Endpoint dedicado, e não um 15º tipo de evento de produto.** O
 * `/api/events` é medição anônima com catálogo guardado e um balde já
 * documentado como insuficiente; pôr relato de erro ali faria falha competir
 * com pageview pelo mesmo limite, e o `track()` é fire-and-forget sem canal
 * de retorno — certo para analytics, errado para erro, onde se quer ver o
 * 429.
 *
 * **É pública e anônima como o `/api/events`, e pelo mesmo motivo é chata
 * com o corpo:** não há sessão para autenticar, e o que separa relato de lixo
 * é o schema. **Sem `Cache-Control`**: a resposta é da requisição.
 */
export async function clientErrorRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    '/client',
    {
      /**
       * **10/min, e é um balde só para o site inteiro — decidido, não
       * esquecido.**
       *
       * O caminho real é navegador → `POST /api/errors/client` do Next → aqui,
       * e o BFF é anônimo de propósito: não repassa o IP do leitor, então o
       * IP que chega é o da função da Vercel. É a mesma dívida medida do
       * `/api/events` ("o teto de ingestão é um balde só para todos os
       * leitores"). A alternativa — o BFF escrever `x-forwarded-for` —
       * mudaria a semântica do `trustProxy: 1` (hoje confia **um** salto, o do
       * Render; o IP escrito pelo BFF seria o segundo) e foi recusada.
       *
       * **Aceitar custa pouco, e está escrito o quanto:** o décimo primeiro
       * leitor a tropeçar na mesma tela quebrada no mesmo minuto recebe 429 e
       * o relato dele não entra. Mas o coalescimento por fingerprint já faz o
       * `count` ser aproximado, e um erro que dez leitores viram num minuto
       * **já está na tabela** — o que se perde é o número exato, não o fato.
       *
       * **A armadilha, sinalizada alto (§11.3):** endpoint de reportar erro
       * que um cliente hostil pode chamar é amplificador de escrita. Três
       * defesas, todas já padrão aqui: o coalescimento da Fase 4 (10.000
       * relatos numa hora são **uma** linha), este balde, e o schema estrito.
       * **Gatilho numérico, observável sem instrumentação nova:** 429 em
       * `POST /api/errors/client` dentro de `GET /api/metrics/http`.
       */
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        summary: 'Ingest a client-side render error reported by an error boundary',
        tags: ['errors'],
        body: clientErrorReportSchema,
        response: {
          202: clientErrorAcceptedSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // Síncrona e sem `await` de propósito: o relato entra no buffer do
      // `ErrorEvent`, e quem vai ao banco é o flush de 30 s. O `request.id`
      // é o desta ingestão — é o que liga a linha à linha de acesso do POST.
      recordClientError(request.body, request.id);

      // 202 e não 201: nada foi criado ainda. Ver `clientErrorAcceptedSchema`.
      return reply.status(202).send({ data: { accepted: true } });
    },
  );
}
