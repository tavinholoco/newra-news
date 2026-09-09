/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: ['./base.js'],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    /**
     * **`console.*` não é o log deste projeto, e a exceção que permitia `warn` e
     * `error` era por onde 14 chamadas contornavam o logger.**
     *
     * A inspeção de 01/09/2026 mediu: 6 chamadas ao logger do Fastify contra 14
     * `console.*` sem `reqId`, sem nível filtrável e — o que custou caro — sem
     * passar pela redação que tira segredo de `err.message`. A Fase 1 do plano
     * de observabilidade trocou as 14 por `baseLogger`.
     *
     * `error` continua permitido em **um** lugar, por `eslint-disable` com
     * motivo escrito: `apps/api/src/config/env.ts`, que roda antes de o logger
     * existir. A guarda que impede a exceção de virar duas é
     * `apps/api/tests/security/secrets-in-logs.test.ts`.
     */
    'no-console': 'error',
  },
};
