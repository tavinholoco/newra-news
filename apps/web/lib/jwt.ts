import { SignJWT } from 'jose';

const secretKey = (): Uint8Array => {
  if (!process.env.AUTH_JWT_SECRET) {
    throw new Error('AUTH_JWT_SECRET is not configured');
  }
  return new TextEncoder().encode(process.env.AUTH_JWT_SECRET);
};

export interface AuthJwtPayload {
  sub: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role?: 'USER' | 'ADMIN';
  /**
   * `'auth-upsert'`: o token de uso único do primeiro sign-in.
   * `'health-probe'`: o da sonda diária do par de JWT (13.7), sem sessão de
   * ninguém — a API o aceita só no `GET /api/health/auth`.
   */
  purpose?: 'auth-upsert' | 'health-probe';
}

/**
 * Assina um JWT HS256 com o mesmo AUTH_JWT_SECRET compartilhado com a API.
 * A API valida este token no plugin de auth (apps/api/src/plugins/auth.ts).
 */
export async function signAuthJwt(payload: AuthJwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretKey());
}
