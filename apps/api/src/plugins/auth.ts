import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifyAuthJwt } from '../utils/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      sub?: string;
      email?: string;
      role?: string;
      purpose?: string;
    };
  }
}

/**
 * Para que serve o token — e é a claim que **esta** montagem aceita.
 *
 * `'session'` é o token que o BFF do Next assina a cada requisição de leitor
 * logado, e ele **não carrega `purpose` nenhum**. `'auth-upsert'` é o token de
 * uso único que cria o usuário no primeiro sign-in.
 */
export type AuthPurpose = 'session' | 'auth-upsert';

export interface AuthPluginOptions {
  /** Padrão: `'session'` — recusa qualquer token que traga `purpose`. */
  purpose?: AuthPurpose;
}

/**
 * Exige `Authorization: Bearer <jwt>` (JWT assinado pelo frontend com
 * AUTH_JWT_SECRET) e expõe `request.user` com o payload verificado.
 *
 * ## Escopo que só uma rota honra não é escopo
 *
 * Até a revisão da Fase 9 o `purpose` era conferido **dentro do handler** do
 * `/api/auth/upsert` e ignorado em todas as outras: o token de `auth-upsert`
 * — que existe para uma chamada só, no primeiro sign-in — passava no
 * `/api/favorites` e no `/api/account` exatamente como um token de sessão. Não
 * havia exploração, porque quem assina os dois é o mesmo servidor de confiança;
 * mas a claim existe justamente para escopar, e escopo conferido num lugar só
 * é convenção, não guarda.
 *
 * A conferência subiu para cá e virou **simétrica**: o padrão (`'session'`)
 * recusa token que traga `purpose`, e a montagem que quer o token de upsert
 * pede `{ purpose: 'auth-upsert' }` e recusa o de sessão. Nenhuma das duas
 * pontas do frontend mudou — o BFF já assinava a sessão sem `purpose`.
 */
export async function authPlugin(app: FastifyInstance, opts: AuthPluginOptions = {}) {
  const expected: AuthPurpose = opts.purpose ?? 'session';

  app.decorateRequest('user', null);

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Invalid or missing token' });
    }

    let payload: Record<string, unknown>;
    try {
      payload = await verifyAuthJwt(auth.slice(7));
    } catch {
      return reply.status(401).send({ error: 'Invalid or missing token' });
    }

    const purpose = typeof payload.purpose === 'string' ? payload.purpose : undefined;
    // `'session'` é a ausência da claim; qualquer outro valor é um token de
    // outro escopo e não serve aqui.
    const actual: string = purpose ?? 'session';
    if (actual !== expected) {
      return reply.status(401).send({ error: 'Invalid or missing token' });
    }

    request.user = {
      sub: typeof payload.sub === 'string' ? payload.sub : undefined,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      role: typeof payload.role === 'string' ? payload.role : undefined,
      purpose,
    };
  });
}

export default fp(authPlugin);
