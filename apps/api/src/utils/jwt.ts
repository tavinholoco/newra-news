import { jwtVerify } from 'jose';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';

/**
 * **O 401 que nao e recusa: e defeito nosso.**
 *
 * Sem `AUTH_JWT_SECRET` **todo** token e recusado, com a mesma frase de um
 * token expirado — conta e admin caem juntos e nada distingue as duas causas.
 * Por isso a categoria e `internal` e nao `authorization`: e ela que faz
 * `logLevelFor` escrever isto como `error`, e nao no `debug` para onde a regra
 * de status mandaria um 401. Esta variavel ja falhou em silencio em producao
 * uma vez.
 */
const secretKey = (): Uint8Array => {
  if (!env.AUTH_JWT_SECRET) {
    throw new UnauthorizedError('Authentication is not configured', {
      code: 'AUTH_NOT_CONFIGURED',
      category: 'internal',
    });
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
  } catch (error) {
    /**
     * **A frase para quem chamou e uma so; a razao fica no `cause`.**
     *
     * O jose distingue expirado (`JWTExpired`), assinatura errada
     * (`JWSSignatureVerificationFailed`) e token malformado (`JWSInvalid`) — e
     * os tres pedem acoes diferentes: relogio fora de sincronia, segredo
     * divergente entre BFF e API, cliente quebrado. Este `catch` descartava os
     * tres. Dizer qual foi **na resposta** ajudaria quem esta adivinhando, por
     * isso a mensagem nao muda.
     */
    throw new UnauthorizedError('Invalid or expired token', { cause: error });
  }
}
