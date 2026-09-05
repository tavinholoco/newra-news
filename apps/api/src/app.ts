import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { corsPlugin } from './plugins/cors';
import { observabilityPlugin } from './plugins/observability';
import { helmetPlugin } from './plugins/helmet';
import { rateLimitPlugin } from './plugins/rate-limit';
import { swaggerPlugin } from './plugins/swagger';
import { healthRoutes } from './routes/health';
import { newsRoutes } from './routes/news';
import { newsFacetsRoutes } from './routes/news/facets';
import { newsDetailRoutes } from './routes/news/[id]';
import { newsAdminRoutes } from './routes/news/admin';
import { newsRelatedRoutes } from './routes/news/related';
import { homeRoutes } from './routes/editorial/home';
import { trendingRoutes } from './routes/editorial/trending';
import { articlesRoutes } from './routes/articles';
import { articleDateRoutes } from './routes/articles/[date]';
import { jobsRoutes } from './routes/jobs';
import { jobStatusRoutes } from './routes/jobs/[id]';
import { renormalizeJobRoutes } from './routes/jobs/renormalize';
import { metricsRoutes } from './routes/metrics';
import { metricsAdminRoutes } from './routes/metrics/admin';
import { metricsHttpRoutes } from './routes/metrics/http';
import { newsletterRoutes } from './routes/newsletter';
import { eventsRoutes } from './routes/events';
import { authRoutes } from './routes/auth';
import { favoritesRoutes } from './routes/favorites';
import { accountRoutes } from './routes/account';
import { devLogsRoutes } from './routes/dev/logs';
import { devDashboardRoutes } from './routes/dev/dashboard';
import { AppError } from './utils/errors';
import { baseLogger } from './utils/logger';

export async function buildApp() {
  const app = Fastify({
    /**
     * **A instancia, e nao um booleano.**
     *
     * `logger: env.NODE_ENV !== 'test'` dava um pino default: sem `level`, sem
     * `redact`, sem `serializers`. Era esse default que mandava a DSN com senha
     * para o stdout do Render pelo `request.log.error({ err })` do handler
     * abaixo — o vazamento que a §1 do plano de observabilidade mediu. O
     * `utils/logger.ts` e quem configura as tres coisas, e passar a instancia e
     * o que faz o `request.log` de toda rota herdar a mesma redacao.
     *
     * Em teste ele resolve para `level: 'silent'` — o logger continua no lugar,
     * calado, em vez de virar o logger abstrato do Fastify.
     */
    logger: baseLogger,
    /**
     * **Duas linhas por requisicao viram uma.**
     *
     * O log padrao do Fastify escreve `incoming request` e `request completed`
     * em **toda** requisicao, inclusive em cada sonda do `/api/health` — ruido
     * que torna a linha que importa inencontravel. O `plugins/observability.ts`
     * ja tem o hook `onResponse` e ja calcula rota, status e `elapsedTime`;
     * agora ele escreve a linha, uma so, com o nivel casado ao status.
     */
    disableRequestLogging: true,
    /**
     * **Um hop de proxy, e exatamente um.**
     *
     * Sem isto, `request.ip` e o peer do socket — atras do proxy do Render, o
     * proprio proxy. Medido em producao em 23/08/2026: tres requisicoes com
     * `X-Forwarded-For` diferentes na mesma janela consumiram o **mesmo** balde
     * de rate limit (`x-ratelimit-remaining` 98, 97, 96). Ou seja, o limite era
     * global, e o teto de 30/min da `/api/events` seria teto global de ingestao
     * — a tela de metricas da Fase 8 subcontando sem sinal nenhum.
     *
     * `1` e nao `true` de proposito: `true` confia na ponta **esquerda** do
     * `X-Forwarded-For`, que e escrita pelo cliente e portanto forjavel — quem
     * quisesse escapar do limite mandaria um IP novo por requisicao. Com `1`,
     * so o ultimo hop (o proxy do Render, que reescreve a ponta direita) e
     * confiavel, e o valor forjado pelo cliente e ignorado.
     */
    trustProxy: 1,
    /**
     * Correlacao de requisicao (§9.5). Respeita o `x-request-id` de quem chama
     * — e o que permite seguir uma requisicao do BFF do Next ate aqui — e gera
     * um quando nao vem.
     */
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 200
        ? incoming
        : randomUUID();
    },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Observabilidade primeiro: o `onResponse` tem de ver inclusive a resposta
  // que o rate limit recusou — 429 e resposta, e e justamente a que interessa.
  await app.register(observabilityPlugin);
  // Rate-limit depois: usa onRoute hook que precisa estar ativo antes das rotas serem registradas
  await app.register(rateLimitPlugin);
  // Swagger depois: suas rotas herdam o rate-limit
  await app.register(swaggerPlugin);
  await app.register(corsPlugin);
  await app.register(helmetPlugin);

  /**
   * `content-type` com caractere de controle nao entra.
   *
   * GHSA de **high** na `fastify@4`: um `Content-Type: application/json` com
   * TAB no fim nao casa com o parser registrado, a requisicao segue por outro
   * caminho e o corpo **escapa da validacao de schema**. A correcao upstream
   * so existe na `fastify@5.7.2`, e subir de major aqui seria mexer na
   * fundacao no meio da revisao que certifica o que esta em cima dela — a
   * major esta registrada como divida da Fase 12, com a suite inteira de rede.
   *
   * O que da para fazer hoje, e o que esta feito: recusar na porta. O defeito
   * e o parser **nao reconhecer** o tipo; recusar antes de escolher parser nao
   * depende de saber qual caminho e o furado. `415` e o codigo certo — o
   * servidor entendeu a requisicao e nao aceita aquele tipo de midia.
   *
   * Guarda em `tests/security/content-type-bypass.test.ts`.
   */
  app.addHook('onRequest', async (request, reply) => {
    const contentType = request.headers['content-type'];
    // eslint-disable-next-line no-control-regex
    if (typeof contentType === 'string' && /[\u0000-\u001f]/.test(contentType)) {
      return reply.status(415).send({ error: 'Unsupported Media Type' });
    }
  });

  /**
   * O que o cliente le num 500, e o que o log guarda.
   *
   * Antes da revisao da Fase 9 este handler devolvia `error.message` **qualquer
   * que fosse o erro**. Erro de Prisma carrega nome de tabela, nome de coluna,
   * trecho de SQL e, em falha de conexao, a string de conexao — tudo isso ia
   * para quem chamou, numa rota publica, sem nada no log dizendo o que havia
   * acontecido.
   *
   * A regra agora: **erro que o servidor escolheu devolver (`AppError`) fala; o
   * resto nao.** O 4xx do Fastify (validacao de schema, 429 do rate limit)
   * tambem fala, porque a mensagem dele descreve a requisicao de quem chamou, e
   * nao o interior do servidor. Para o 5xx sobra uma frase fixa e o
   * `x-request-id`, que e como o relato de fora encontra a linha do log.
   */
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode < 500) {
      return reply.status(statusCode).send({ error: error.message });
    }

    request.log.error(
      { err: error, reqId: request.id, url: request.url },
      'unhandled error',
    );
    return reply
      .status(500)
      .send({ error: 'Internal server error', requestId: request.id });
  });

  await app.register(healthRoutes, { prefix: '/api/health' });

  await app.register(newsRoutes, { prefix: '/api/news' });
  await app.register(newsFacetsRoutes, { prefix: '/api/news' });
  await app.register(newsDetailRoutes, { prefix: '/api/news' });
  await app.register(newsAdminRoutes, { prefix: '/api/news' });
  await app.register(newsRelatedRoutes, { prefix: '/api/news' });

  // Editorial (contratos da Fase 0, §3 e §4) — consumidos pela Home da V2.
  await app.register(homeRoutes, { prefix: '/api/home' });
  await app.register(trendingRoutes, { prefix: '/api/trending' });

  await app.register(articlesRoutes, { prefix: '/api/articles' });
  await app.register(articleDateRoutes, { prefix: '/api/articles' });

  await app.register(jobsRoutes, { prefix: '/api/jobs' });
  await app.register(jobStatusRoutes, { prefix: '/api/jobs' });
  await app.register(renormalizeJobRoutes, { prefix: '/api/jobs' });

  await app.register(metricsRoutes, { prefix: '/api/metrics' });
  await app.register(metricsAdminRoutes, { prefix: '/api/metrics' });
  await app.register(metricsHttpRoutes, { prefix: '/api/metrics' });

  await app.register(newsletterRoutes, { prefix: '/api/newsletter' });

  // Eventos de produto (docs/v2/04 §6). Publica e anonima: o que separa
  // evento de lixo e o schema, nao a sessao.
  await app.register(eventsRoutes, { prefix: '/api/events' });

  await app.register(authRoutes, { prefix: '/api/auth' });

  await app.register(favoritesRoutes, { prefix: '/api/favorites' });
  await app.register(accountRoutes, { prefix: '/api/account' });

  // Observabilidade (dev-only) — protegida por JOB_SECRET, sem exposição pública
  await app.register(devLogsRoutes, { prefix: '/api/dev' });
  await app.register(devDashboardRoutes, { prefix: '/dev' });

  return app;
}
