import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { authPlugin } from '../../plugins/auth';
import { checkAllProviders } from '../../services/health.service';
import { assertJobSecret } from '../../utils/job-secret';
import { errorResponseSchema } from '../../utils/schemas';
import {
  healthAuthResponseSchema,
  healthResponseSchema,
  providersHealthResponseSchema,
} from './schemas';

export async function healthRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/',
    {
      schema: {
        response: {
          200: healthResponseSchema,
        },
      },
    },
    async () => ({
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
  );

  app.withTypeProvider<ZodTypeProvider>().get(
    '/providers',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        response: {
          200: providersHealthResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request) => {
      // Era uma quarta cópia da conferência do `JOB_SECRET`, com `!==` — a
      // comparação que sai no primeiro byte diferente e vaza o prefixo correto
      // para quem consegue medir. `assertJobSecret` é o único lugar que compara
      // este segredo, compara em tempo constante, e agora carrega o
      // `JOB_SECRET_INVALID` da taxonomia.
      assertJobSecret(request);
      return checkAllProviders();
    },
  );

  /**
   * **A sonda do par de JWT entre a Vercel e a API** — 13.7 do plano de
   * observabilidade, 09/10/2026.
   *
   * Os fluxos com login do Smoke ficam desligados por decisão: o
   * `NEXTAUTH_SECRET` de produção no CI daria a qualquer dependência
   * comprometida uma sessão de admin (o papel vem do token). O defeito que eles
   * pegariam é o par `AUTH_JWT_SECRET` divergente entre as duas plataformas —
   * todo leitor logado em 401 com o site anônimo perfeito, e isso já aconteceu.
   * Aqui ele é perguntado sem segredo fora delas: a Vercel assina um token de
   * escopo próprio e chama esta rota, que **só** o aceita (e que nenhum outro
   * token abre — o `authPlugin` com `purpose` é simétrico).
   *
   * Não toca o banco: a pergunta é sobre a assinatura, e só sobre ela.
   */
  await app.register(async (probe) => {
    await probe.register(authPlugin, { purpose: 'health-probe' });
    probe.withTypeProvider<ZodTypeProvider>().get(
      '/auth',
      {
        schema: {
          response: {
            200: healthAuthResponseSchema,
            401: errorResponseSchema,
          },
        },
      },
      async () => ({ data: { accepted: true as const } }),
    );
  });
}
