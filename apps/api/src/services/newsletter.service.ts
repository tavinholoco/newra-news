import { prisma } from '@newranews/database';
import { env } from '../config/env';
import { sendEmailWithResend } from '../providers/newsletter/resend.provider';

export interface NewsletterSendResult {
  total: number;
  sent: number;
  failed: number;
}

interface NewsletterEmailContent {
  title: string;
  summary: string;
  articleUrl: string;
  unsubscribeUrl: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildNewsletterHtml({
  title,
  summary,
  articleUrl,
  unsubscribeUrl,
}: NewsletterEmailContent): string {
  const safeTitle = escapeHtml(title);
  const safeSummary = escapeHtml(summary);

  return [
    '<!DOCTYPE html>',
    '<html lang="pt-BR">',
    '<body style="margin:0;padding:0;background-color:#f6f5f4;font-family:Arial,Helvetica,sans-serif;">',
    '<div style="max-width:600px;margin:0 auto;padding:32px 24px;">',
    '<p style="font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#ec6426;margin:0 0 8px;">Newra News — Artigo do Dia</p>',
    `<h1 style="font-size:24px;line-height:1.3;color:#1a1a1a;margin:0 0 16px;">${safeTitle}</h1>`,
    `<p style="font-size:16px;line-height:1.6;color:#4a4a4a;margin:0 0 24px;">${safeSummary}</p>`,
    `<a href="${articleUrl}" style="display:inline-block;background-color:#ec6426;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;">Ler artigo completo</a>`,
    '<hr style="border:none;border-top:1px solid #e5e4e3;margin:32px 0 16px;" />',
    '<p style="font-size:12px;color:#8a8a8a;margin:0 0 8px;">Você está recebendo este e-mail porque se inscreveu no Newra News.</p>',
    `<a href="${unsubscribeUrl}" style="font-size:12px;color:#8a8a8a;">Cancelar inscrição</a>`,
    '</div>',
    '</body>',
    '</html>',
  ].join('\n');
}

export function buildNewsletterText({
  title,
  summary,
  articleUrl,
  unsubscribeUrl,
}: NewsletterEmailContent): string {
  return [
    'NEWRA NEWS — ARTIGO DO DIA',
    '',
    title,
    '',
    summary,
    '',
    `Ler artigo completo: ${articleUrl}`,
    '',
    'Cancelar inscrição:',
    unsubscribeUrl,
  ].join('\n');
}

export async function subscribeToNewsletter(email: string) {
  const normalized = normalizeEmail(email);

  const existing = await prisma.subscriber.findUnique({
    where: { email: normalized },
  });

  if (existing) {
    if (existing.status === 'ACTIVE') {
      return existing; // idempotente — já inscrito
    }
    // Reativa assinante que havia cancelado
    return prisma.subscriber.update({
      where: { id: existing.id },
      data: { status: 'ACTIVE' },
    });
  }

  return prisma.subscriber.create({ data: { email: normalized } });
}

/**
 * A inscrição deste usuário, se houver.
 *
 * Procura por `userId` e, só então, pelo e-mail da conta — e **amarra** o
 * `userId` quando acha por e-mail. É o que faz a tela de conta parar de
 * depender de os dois e-mails coincidirem: a partir da primeira visita, a
 * inscrição feita antes de existir conta passa a ter dono.
 */
export async function findSubscriberForUser(userId: string, email: string) {
  const byUser = await prisma.subscriber.findFirst({ where: { userId } });
  if (byUser) return byUser;

  const byEmail = await prisma.subscriber.findUnique({
    where: { email: normalizeEmail(email) },
  });
  if (!byEmail) return null;
  if (byEmail.userId) return byEmail;

  return prisma.subscriber.update({
    where: { id: byEmail.id },
    data: { userId },
  });
}

/** Inscreve (ou reativa) a conta, já com o vínculo. */
export async function subscribeUser(userId: string, email: string) {
  const existing = await findSubscriberForUser(userId, email);

  if (existing) {
    if (existing.status === 'ACTIVE' && existing.userId === userId) return existing;
    return prisma.subscriber.update({
      where: { id: existing.id },
      data: { status: 'ACTIVE', userId },
    });
  }

  return prisma.subscriber.create({
    data: { email: normalizeEmail(email), userId },
  });
}

/**
 * Cancela a inscrição pela sessão, sem token.
 *
 * O cancelamento por token continua existindo e é o do e-mail — quem clica
 * naquele link não tem sessão nenhuma. Este é o outro caminho, o da tela de
 * conta.
 */
export async function unsubscribeUser(userId: string, email: string): Promise<boolean> {
  const existing = await findSubscriberForUser(userId, email);
  if (!existing || existing.status !== 'ACTIVE') return false;

  await prisma.subscriber.update({
    where: { id: existing.id },
    data: { status: 'UNSUBSCRIBED' },
  });
  return true;
}

export async function unsubscribeFromNewsletter(token: string): Promise<boolean> {
  const subscriber = await prisma.subscriber.findUnique({ where: { token } });

  if (!subscriber || subscriber.status !== 'ACTIVE') {
    return false;
  }

  await prisma.subscriber.update({
    where: { id: subscriber.id },
    data: { status: 'UNSUBSCRIBED' },
  });

  return true;
}

/**
 * Envia o artigo do dia para todos os assinantes ativos.
 * Idempotente: um envio por dia (NewsletterLog.date unique).
 * Não lança erro por falha individual de e-mail — conta em sent/failed.
 */
export async function sendDailyNewsletter(): Promise<NewsletterSendResult> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const existingLog = await prisma.newsletterLog.findUnique({
    where: { date: today },
  });
  if (existingLog) {
    return { total: existingLog.total, sent: existingLog.sent, failed: existingLog.failed };
  }

  const article = await prisma.article.findUnique({ where: { date: today } });
  const subscribers = await prisma.subscriber.findMany({
    where: { status: 'ACTIVE' },
  });

  if (!article) {
    await prisma.newsletterLog.create({
      data: { date: today, total: 0, error: 'No article for today' },
    });
    return { total: 0, sent: 0, failed: 0 };
  }

  if (subscribers.length === 0) {
    await prisma.newsletterLog.create({ data: { date: today, total: 0 } });
    return { total: 0, sent: 0, failed: 0 };
  }

  const dateSlug = article.date.toISOString().slice(0, 10);
  const articleUrl = `${env.SITE_URL}/article/${dateSlug}`;

  let sent = 0;
  let failed = 0;
  let firstError: string | null = null;

  for (const subscriber of subscribers) {
    const unsubscribeUrl = `${env.SITE_URL}/newsletter/unsubscribe?token=${subscriber.token}`;
    const html = buildNewsletterHtml({
      title: article.title,
      summary: article.summary,
      articleUrl,
      unsubscribeUrl,
    });
    const text = buildNewsletterText({
      title: article.title,
      summary: article.summary,
      articleUrl,
      unsubscribeUrl,
    });

    try {
      await sendEmailWithResend({
        to: subscriber.email,
        subject: `Newra News — ${article.title}`,
        html,
        text,
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      firstError = firstError ?? (err instanceof Error ? err.message : String(err));
    }
  }

  const log = await prisma.newsletterLog.create({
    data: {
      date: today,
      articleId: article.id,
      total: subscribers.length,
      sent,
      failed,
      error: firstError,
    },
  });

  return { total: log.total, sent: log.sent, failed: log.failed };
}
