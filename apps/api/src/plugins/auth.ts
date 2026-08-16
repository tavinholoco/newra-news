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
 * Exige `Authorization: Bearer <jwt>` (JWT assinado pelo frontend com
 * AUTH_JWT_SECRET) e expõe `request.user` com o payload verificado.
 */
export async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('user', null);

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Invalid or missing token' });
    }

    try {
      const payload = await verifyAuthJwt(auth.slice(7));
      request.user = {
        sub: typeof payload.sub === 'string' ? payload.sub : undefined,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        role: typeof payload.role === 'string' ? payload.role : undefined,
        purpose: typeof payload.purpose === 'string' ? payload.purpose : undefined,
      };
    } catch {
      return reply.status(401).send({ error: 'Invalid or missing token' });
    }
  });
}

export default fp(authPlugin);
