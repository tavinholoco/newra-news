import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@newranews/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@newranews/database')>();
  return {
    ...actual,
    prisma: {
      subscriber: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      article: {
        findUnique: vi.fn(),
      },
      newsletterLog: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

vi.mock('../../src/providers/newsletter/resend.provider', () => ({
  sendEmailWithResend: vi.fn(),
}));

vi.mock('../../src/config/env', () => ({
  env: {
    SITE_URL: 'http://localhost:3000',
    NEWSLETTER_FROM: 'Newra News <news@test.com>',
    RESEND_API_KEY: 'test-resend-key',
  },
}));

import { prisma } from '@newranews/database';
import {
  normalizeEmail,
  buildNewsletterHtml,
  buildNewsletterText,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  sendDailyNewsletter,
} from '../../src/services/newsletter.service';
import { sendEmailWithResend } from '../../src/providers/newsletter/resend.provider';

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const makeSubscriber = (overrides: Record<string, unknown> = {}) => ({
  id: 'subscriber-uuid-1',
  email: 'assinante@test.com',
  status: 'ACTIVE' as const,
  token: 'token-uuid-1',
  createdAt: new Date('2024-01-01T08:00:00Z'),
  updatedAt: new Date('2024-01-01T08:00:00Z'),
  ...overrides,
});

const makeArticle = (overrides: Record<string, unknown> = {}) => ({
  id: 'article-uuid-1',
  title: 'Artigo do Dia',
  summary: 'Resumo do artigo do dia.',
  content: 'Conteúdo completo.',
  date: startOfToday(),
  newsCount: 10,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('normalizeEmail', () => {
  it('should trim and lowercase the email', () => {
    expect(normalizeEmail('  Assinante@Test.com ')).toBe('assinante@test.com');
  });
});

describe('buildNewsletterHtml', () => {
  it('should include title, summary, article and unsubscribe links', () => {
    const html = buildNewsletterHtml({
      title: 'Artigo do Dia',
      summary: 'Resumo do dia.',
      articleUrl: 'http://localhost:3000/article/2024-01-01',
      unsubscribeUrl: 'http://localhost:3000/newsletter/unsubscribe?token=abc',
    });

    expect(html).toContain('Artigo do Dia');
    expect(html).toContain('Resumo do dia.');
    expect(html).toContain('http://localhost:3000/article/2024-01-01');
    expect(html).toContain('http://localhost:3000/newsletter/unsubscribe?token=abc');
  });

  it('should escape HTML in title and summary', () => {
    const html = buildNewsletterHtml({
      title: 'Notícia <b>importante</b> & co',
      summary: 'Resumo com "aspas"',
      articleUrl: 'http://localhost:3000/article/2024-01-01',
      unsubscribeUrl: 'http://localhost:3000/newsletter/unsubscribe?token=abc',
    });

    expect(html).not.toContain('<b>importante</b>');
    expect(html).toContain('Notícia &lt;b&gt;importante&lt;/b&gt;');
    expect(html).toContain('Resumo com &quot;aspas&quot;');
  });
});

describe('buildNewsletterText', () => {
  it('should include article and unsubscribe links', () => {
    const text = buildNewsletterText({
      title: 'Artigo do Dia',
      summary: 'Resumo do dia.',
      articleUrl: 'http://localhost:3000/article/2024-01-01',
      unsubscribeUrl: 'http://localhost:3000/newsletter/unsubscribe?token=abc',
    });

    expect(text).toContain('Artigo do Dia');
    expect(text).toContain('http://localhost:3000/article/2024-01-01');
    expect(text).toContain('http://localhost:3000/newsletter/unsubscribe?token=abc');
  });
});

describe('subscribeToNewsletter', () => {
  it('should create a new subscriber', async () => {
    const created = makeSubscriber();
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.subscriber.create).mockResolvedValue(created as never);

    const result = await subscribeToNewsletter('Assinante@Test.com ');

    expect(prisma.subscriber.create).toHaveBeenCalledWith({
      data: { email: 'assinante@test.com' },
    });
    expect(result).toEqual(created);
  });

  it('should return the existing active subscriber without creating', async () => {
    const existing = makeSubscriber();
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(existing as never);

    const result = await subscribeToNewsletter('assinante@test.com');

    expect(prisma.subscriber.create).not.toHaveBeenCalled();
    expect(result).toEqual(existing);
  });

  it('should reactivate an unsubscribed subscriber', async () => {
    const unsubscribed = makeSubscriber({ status: 'UNSUBSCRIBED' });
    const reactivated = makeSubscriber();
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(unsubscribed as never);
    vi.mocked(prisma.subscriber.update).mockResolvedValue(reactivated as never);

    const result = await subscribeToNewsletter('assinante@test.com');

    expect(prisma.subscriber.update).toHaveBeenCalledWith({
      where: { id: unsubscribed.id },
      data: { status: 'ACTIVE' },
    });
    expect(result).toEqual(reactivated);
  });
});

describe('unsubscribeFromNewsletter', () => {
  it('should mark an active subscriber as unsubscribed', async () => {
    const subscriber = makeSubscriber();
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(subscriber as never);
    vi.mocked(prisma.subscriber.update).mockResolvedValue(
      makeSubscriber({ status: 'UNSUBSCRIBED' }) as never,
    );

    const result = await unsubscribeFromNewsletter('token-uuid-1');

    expect(result).toBe(true);
    expect(prisma.subscriber.update).toHaveBeenCalledWith({
      where: { id: subscriber.id },
      data: { status: 'UNSUBSCRIBED' },
    });
  });

  it('should return false when the token is unknown', async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(null);

    const result = await unsubscribeFromNewsletter('token-invalido');

    expect(result).toBe(false);
    expect(prisma.subscriber.update).not.toHaveBeenCalled();
  });

  it('should return false when the subscriber is already unsubscribed', async () => {
    vi.mocked(prisma.subscriber.findUnique).mockResolvedValue(
      makeSubscriber({ status: 'UNSUBSCRIBED' }) as never,
    );

    const result = await unsubscribeFromNewsletter('token-uuid-1');

    expect(result).toBe(false);
  });
});

describe('sendDailyNewsletter', () => {
  it('should skip when a log for today already exists', async () => {
    vi.mocked(prisma.newsletterLog.findUnique).mockResolvedValue({
      id: 'log-1',
      total: 3,
      sent: 3,
      failed: 0,
    } as never);

    const result = await sendDailyNewsletter();

    expect(result).toEqual({ total: 3, sent: 3, failed: 0 });
    expect(prisma.article.findUnique).not.toHaveBeenCalled();
    expect(sendEmailWithResend).not.toHaveBeenCalled();
  });

  it('should log and return zeros when there is no article today', async () => {
    vi.mocked(prisma.newsletterLog.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.article.findUnique).mockResolvedValue(null);

    const result = await sendDailyNewsletter();

    expect(result).toEqual({ total: 0, sent: 0, failed: 0 });
    expect(prisma.newsletterLog.create).toHaveBeenCalledWith({
      data: { date: startOfToday(), total: 0, error: 'No article for today' },
    });
    expect(sendEmailWithResend).not.toHaveBeenCalled();
  });

  it('should log and return zeros when there are no active subscribers', async () => {
    vi.mocked(prisma.newsletterLog.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.article.findUnique).mockResolvedValue(makeArticle() as never);
    vi.mocked(prisma.subscriber.findMany).mockResolvedValue([]);

    const result = await sendDailyNewsletter();

    expect(result).toEqual({ total: 0, sent: 0, failed: 0 });
    expect(sendEmailWithResend).not.toHaveBeenCalled();
  });

  it('should send one email per active subscriber and record sent/failed', async () => {
    const subscribers = [
      makeSubscriber({ id: 'sub-1', email: 'a@test.com', token: 'tok-a' }),
      makeSubscriber({ id: 'sub-2', email: 'b@test.com', token: 'tok-b' }),
      makeSubscriber({ id: 'sub-3', email: 'c@test.com', token: 'tok-c' }),
    ];
    vi.mocked(prisma.newsletterLog.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.article.findUnique).mockResolvedValue(makeArticle() as never);
    vi.mocked(prisma.subscriber.findMany).mockResolvedValue(subscribers as never);
    vi.mocked(sendEmailWithResend)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Resend API error 422'))
      .mockResolvedValueOnce(undefined);
    vi.mocked(prisma.newsletterLog.create).mockImplementation(
      async ({ data }) => ({ id: 'log-1', ...data, createdAt: new Date() }) as never,
    );

    const result = await sendDailyNewsletter();

    expect(result).toEqual({ total: 3, sent: 2, failed: 1 });
    expect(sendEmailWithResend).toHaveBeenCalledTimes(3);
    expect(prisma.newsletterLog.create).toHaveBeenCalledWith({
      data: {
        date: startOfToday(),
        articleId: 'article-uuid-1',
        total: 3,
        sent: 2,
        failed: 1,
        error: 'Resend API error 422',
      },
    });
  });

  it('should build the article URL from SITE_URL with the date slug', async () => {
    vi.mocked(prisma.newsletterLog.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.article.findUnique).mockResolvedValue(makeArticle() as never);
    vi.mocked(prisma.subscriber.findMany).mockResolvedValue([
      makeSubscriber({ id: 'sub-1', email: 'a@test.com', token: 'tok-a' }),
    ] as never);
    vi.mocked(sendEmailWithResend).mockResolvedValue(undefined);
    vi.mocked(prisma.newsletterLog.create).mockImplementation(
      async ({ data }) => ({ id: 'log-1', ...data, createdAt: new Date() }) as never,
    );

    await sendDailyNewsletter();

    const [emailInput] = vi.mocked(sendEmailWithResend).mock.calls[0] as [
      { html: string; text: string },
    ];
    const dateSlug = startOfToday().toISOString().slice(0, 10);
    expect(emailInput.html).toContain(
      `http://localhost:3000/article/${dateSlug}`,
    );
    expect(emailInput.html).toContain(
      'http://localhost:3000/newsletter/unsubscribe?token=tok-a',
    );
    expect(emailInput.text).toContain(
      `http://localhost:3000/article/${dateSlug}`,
    );
  });
});
