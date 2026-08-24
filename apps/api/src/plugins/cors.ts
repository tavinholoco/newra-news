import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { env } from '../config/env';

/**
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
