import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmailWithResend } from '../../../src/providers/newsletter/resend.provider';
import { env } from '../../../src/config/env';

vi.mock('../../../src/config/env', () => ({
  env: {
    RESEND_API_KEY: 'test-resend-key',
    NEWSLETTER_FROM: 'Newra News <news@test.com>',
  },
}));

function makeFetchOk() {
  return vi.fn().mockResolvedValue({ ok: true, status: 200 });
}

describe('sendEmailWithResend', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetchOk());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should POST to the Resend API with auth and payload', async () => {
    await sendEmailWithResend({
      to: 'assinante@test.com',
      subject: 'Newra News — Artigo do Dia',
      html: '<p>Olá</p>',
      text: 'Olá',
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-resend-key',
    );
    const body = JSON.parse(String(init.body)) as {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
    };
    expect(body.from).toBe('Newra News <news@test.com>');
    expect(body.to).toEqual(['assinante@test.com']);
    expect(body.subject).toBe('Newra News — Artigo do Dia');
    expect(body.html).toBe('<p>Olá</p>');
    expect(body.text).toBe('Olá');
  });

  it('should throw on HTTP errors with the response detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: vi.fn().mockResolvedValue('{"message":"invalid email"}'),
      }),
    );

    await expect(
      sendEmailWithResend({
        to: 'invalido@test.com',
        subject: 'x',
        html: 'x',
        text: 'x',
      }),
    ).rejects.toThrow('Resend API error 422: {"message":"invalid email"}');
  });

  it('should throw when RESEND_API_KEY is not configured', async () => {
    const originalKey = env.RESEND_API_KEY;
    env.RESEND_API_KEY = undefined;

    await expect(
      sendEmailWithResend({
        to: 'a@test.com',
        subject: 'x',
        html: 'x',
        text: 'x',
      }),
    ).rejects.toThrow('RESEND_API_KEY is not configured');

    env.RESEND_API_KEY = originalKey;
  });
});
