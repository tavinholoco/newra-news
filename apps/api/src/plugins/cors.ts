import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from '../config/env';

/**
 * ## O mapa de confiança entre as duas metades (§11.S)
 *
 * A pergunta da fase de integração é qual é a suposição de confiança entre o
 * site e a API, e se ela está escrita em algum lugar. Estava espalhada em
 * comentários; reunida, é esta — e ela vive aqui porque **o CORS é a fronteira
 * que a torna verdadeira ou falsa**:
 *
 * | Quem chama | Como se autentica | O que esta API supõe |
 * |---|---|---|
 * | navegador → Next (BFF) | cookie de sessão do next-auth | nada: a API não vê esse cookie |
 * | Next (BFF) → API | JWT HS256 com `AUTH_JWT_SECRET` | quem assinou é servidor de confiança |
 * | navegador → API (direto) | nada — só rotas públicas | **mutação nunca vem por aqui** |
 * | cron da Vercel → API | `JOB_SECRET` | quem tem o segredo pode disparar o pipeline |
 *
 * **A terceira linha é a suposição que não estava declarada em lugar nenhum**, e
 * é dela que a lista de métodos abaixo depende. Do lado do web ela é verificada
 * estaticamente — `tests/lib/trust-boundary.test.ts` exige que toda chamada do
 * navegador direto à API use método público, e que PUT e DELETE só existam
 * atravessando o BFF. Uma suposição que só é verdadeira por hábito é a que
 * quebra quando alguém acrescenta a primeira chamada direta do cliente, e o
 * sintoma seria um preflight falhando em produção — exatamente como o bug da
 * barra final no `CORS_ORIGIN`, em 16/08.
 *
 * **Rotação do segredo compartilhado:** `AUTH_JWT_SECRET` é o mesmo nos dois
 * serviços, e os dois deploys não terminam juntos — há uma janela em que toda
 * rota de conta devolve 401. O procedimento está em `docs/setup.md`.
 *
 * ---
 *
 * Os métodos declarados são **os métodos que existem**.
 *
 * Até a revisão da Fase 9 a lista era `['GET', 'POST']`, e o roteador registra
 * 2 PUT (`/api/account/preferences`, `/api/account/newsletter`) e 2 DELETE
 * (`/api/news/:id`, `/api/favorites/:itemType/:itemId`). Funcionava porque toda
 * mutação passa pelo BFF do Next, server-side, onde CORS não se aplica — ou
 * seja, era uma **dependência não declarada** entre as duas metades: no dia em
 * que uma dessas rotas fosse chamada do browser, o preflight reprovaria e o
 * sintoma (um DELETE que "não faz nada") não se pareceria com a causa.
 *
 * Declarar o que existe não abre superfície: a origem continua sendo só
 * `CORS_ORIGIN`, e as rotas de mutação continuam exigindo JWT.
 */
export const CORS_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] as const;

export const corsPlugin = fp(async function corsPlugin(app: FastifyInstance) {
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    methods: [...CORS_METHODS],
  });
});
