import { jwtVerify } from 'jose';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';

const secretKey = (): Uint8Array => {
  if (!env.AUTH_JWT_SECRET) {
    throw new UnauthorizedError('Authentication is not configured');
  }
  return new TextEncoder().encode(env.AUTH_JWT_SECRET);
};

/**
 * Verifica um JWT assinado pelo frontend (HS256, mesmo AUTH_JWT_SECRET).
 * Retorna o payload (ex.: { sub, email, role }) ou lança 401.
 */
export async function verifyAuthJwt(token: string): Promise<Record<string, unknown>> {
  const key = secretKey(); // lança 'Authentication is not configured' se não configurado
  try {
    const { payload } = await jwtVerify(token, key);
    return payload as Record<string, unknown>;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
