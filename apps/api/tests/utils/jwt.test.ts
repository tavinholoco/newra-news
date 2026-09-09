import { describe, it, expect, vi, afterEach } from 'vitest';
import { SignJWT } from 'jose';

vi.mock('../../src/config/env', () => ({
  env: { AUTH_JWT_SECRET: 'test-jwt-secret' },
}));

import { verifyAuthJwt } from '../../src/utils/jwt';
import { env } from '../../src/config/env';

const secret = new TextEncoder().encode('test-jwt-secret');

function sign(
  payload: Record<string, unknown>,
  options: { secret?: Uint8Array; expired?: boolean } = {},
): Promise<string> {
  const jwt = new SignJWT(payload).setProtectedHeader({ alg: 'HS256' });
  if (options.expired) {
    const past = Math.floor(Date.now() / 1000) - 7200;
    jwt.setIssuedAt(past).setExpirationTime(past - 3600);
  } else {
    jwt.setIssuedAt().setExpirationTime('1h');
  }
  return jwt.sign(options.secret ?? secret);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('verifyAuthJwt', () => {
  it('should return the payload for a valid token', async () => {
    const token = await sign({
      sub: 'user-uuid',
      email: 'user@test.com',
      purpose: 'auth-upsert',
    });

    const payload = await verifyAuthJwt(token);

    expect(payload.sub).toBe('user-uuid');
    expect(payload.email).toBe('user@test.com');
    expect(payload.purpose).toBe('auth-upsert');
  });

  it('should reject a malformed token', async () => {
    await expect(verifyAuthJwt('not-a-jwt')).rejects.toThrow(
      'Invalid or expired token',
    );
  });

  it('should reject a token signed with a different secret', async () => {
    const token = await sign(
      { sub: 'x' },
      { secret: new TextEncoder().encode('other-secret') },
    );

    await expect(verifyAuthJwt(token)).rejects.toThrow(
      'Invalid or expired token',
    );
  });

  it('should reject an expired token', async () => {
    const token = await sign({ sub: 'x' }, { expired: true });

    await expect(verifyAuthJwt(token)).rejects.toThrow(
      'Invalid or expired token',
    );
  });

  it('should reject when AUTH_JWT_SECRET is not configured', async () => {
    const original = env.AUTH_JWT_SECRET;
    env.AUTH_JWT_SECRET = undefined;

    const token = await sign({ sub: 'x' });
    await expect(verifyAuthJwt(token)).rejects.toThrow(
      'Authentication is not configured',
    );

    env.AUTH_JWT_SECRET = original;
  });
});

describe('a razao da recusa sobrevive no `cause`', () => {
  /**
   * **O `catch` descartava o motivo, e os tres casos viram a mesma frase.**
   *
   * Expirado, assinatura errada e token malformado sao diagnosticos diferentes
   * com acoes diferentes — relogio fora de sincronia, segredo divergente entre
   * BFF e API, cliente quebrado — e todos chegavam ao log como "Invalid or
   * expired token". A Fase 3 acrescentou `cause` ao `AppError` exatamente para
   * isto e nao o usou aqui; a auditoria pos-merge pegou.
   *
   * **A resposta para quem chamou nao muda**: continua a mesma frase, porque
   * dizer *por que* o token foi recusado ajuda quem esta tentando adivinhar.
   */
  it('keeps the jose reason for an expired token', async () => {
    const token = await sign({ sub: 'user-1' }, { expired: true });

    await expect(verifyAuthJwt(token)).rejects.toMatchObject({
      message: 'Invalid or expired token',
      code: 'AUTH_TOKEN_INVALID',
    });

    const error = await verifyAuthJwt(token).catch((e: unknown) => e as Error);
    expect((error.cause as Error).name).toBe('JWTExpired');
  });

  it('tells a bad signature apart from an expired token', async () => {
    const token = await sign({ sub: 'user-1' }, {
      secret: new TextEncoder().encode('outro-segredo-completamente'),
    });

    const error = await verifyAuthJwt(token).catch((e: unknown) => e as Error);

    // O nome do erro do jose e o que separa "relogio" de "segredo divergente".
    expect((error.cause as Error).name).not.toBe('JWTExpired');
    expect((error.cause as Error).name).toContain('JWS');
  });

  it('says nothing about the reason on the wire', async () => {
    const token = await sign({ sub: 'user-1' }, { expired: true });
    const error = await verifyAuthJwt(token).catch((e: unknown) => e as Error);

    expect(error.message).toBe('Invalid or expired token');
  });
});
