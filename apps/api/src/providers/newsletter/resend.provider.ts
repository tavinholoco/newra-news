import { env } from '../../config/env';

const RESEND_API_URL = 'https://api.resend.com/emails';
const REQUEST_TIMEOUT_MS = 15_000;

export interface ResendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmailWithResend({
  to,
  subject,
  html,
  text,
}: ResendEmailInput): Promise<void> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Newsletter disabled: RESEND_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.NEWSLETTER_FROM,
        to: [to],
        subject,
        html,
        text,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response
        .text()
        .catch(() => 'unable to read error body');
      throw new Error(
        `Resend API error ${response.status}: ${errorBody.slice(0, 200)}`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}
