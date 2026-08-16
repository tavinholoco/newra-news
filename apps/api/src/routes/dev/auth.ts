import type { FastifyRequest } from 'fastify';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../utils/errors';

/**
 * Exige `Authorization: Bearer <JOB_SECRET>` (ou um secret alternativo, ex.:
 * query param da página HTML do dashboard). Dev-only — nunca expor ao público.
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
