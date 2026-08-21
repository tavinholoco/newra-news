import type { FastifyRequest } from 'fastify';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';

/**
 * Exige `Authorization: Bearer <JOB_SECRET>` (ou um secret alternativo, ex.:
 * query param da página HTML do dashboard).
 *
 * Vive em `utils/` e não em `routes/dev/` porque deixou de ser exclusivo da
 * observabilidade: o job de renormalização usa o mesmo segredo, e um helper de
 * auth importado de `routes/dev/` por uma rota de `routes/jobs/` seria uma
 * dependência entre irmãos que não diz nada.
 */
export function assertJobSecret(
  request: FastifyRequest,
  alternativeSecret?: string,
): void {
  const auth = request.headers.authorization;
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
  const secret = bearer ?? alternativeSecret;
  if (!secret || secret !== env.JOB_SECRET) {
    throw new UnauthorizedError('Invalid or missing token');
  }
}
