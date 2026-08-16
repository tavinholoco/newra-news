// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { jwtVerify } from 'jose';

const SECRET = 'test-shared-jwt-secret';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('signAuthJwt', () => {
  it('should produce a JWT verifiable with the shared secret', async () => {
    vi.stubEnv('AUTH_JWT_SECRET', SECRET);
    const { signAuthJwt } = await import('@/lib/jwt');

    const token = await signAuthJwt({
      sub: 'user-uuid',
      email: 'user@test.com',
      name: 'Test User',
      purpose: 'auth-upsert',
    });

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(SECRET),
    );
    expect(payload.sub).toBe('user-uuid');
    expect(payload.email).toBe('user@test.com');
    expect(payload.name).toBe('Test User');
    expect(payload.purpose).toBe('auth-upsert');
    expect(payload.exp).toBeDefined();
  });

  it('should throw when AUTH_JWT_SECRET is not configured', async () => {
    vi.stubEnv('AUTH_JWT_SECRET', '');
    const { signAuthJwt } = await import('@/lib/jwt');

    await expect(
      signAuthJwt({ sub: 'x', email: 'x@test.com', purpose: 'auth-upsert' }),
    ).rejects.toThrow('AUTH_JWT_SECRET is not configured');
  });
});
