import { describe, it, expect } from 'vitest';
import { envSchema } from '../../src/config/env';

describe('Env config — CORS_ORIGIN', () => {
  it('should strip a trailing slash from CORS_ORIGIN', () => {
    const parsed = envSchema.partial().parse({
      CORS_ORIGIN: 'https://newra-news-web.vercel.app/',
    });
    expect(parsed.CORS_ORIGIN).toBe('https://newra-news-web.vercel.app');
  });

  it('should strip multiple trailing slashes from CORS_ORIGIN', () => {
    const parsed = envSchema.partial().parse({
      CORS_ORIGIN: 'https://newra-news-web.vercel.app///',
    });
    expect(parsed.CORS_ORIGIN).toBe('https://newra-news-web.vercel.app');
  });

  it('should keep CORS_ORIGIN without a trailing slash unchanged', () => {
    const parsed = envSchema.partial().parse({
      CORS_ORIGIN: 'http://localhost:3000',
    });
    expect(parsed.CORS_ORIGIN).toBe('http://localhost:3000');
  });
});
