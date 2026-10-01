import { timingSafeEqual } from 'node:crypto';

/**
 * **A porta do cron da Vercel** (`app/api/cron/daily-news`, e o botão do painel
 * que reentra por ele): a Vercel manda `Authorization: Bearer <CRON_SECRET>`.
 *
 * A comparação antiga era `header !== \`Bearer ${process.env.CRON_SECRET}\``, e
 * com a variável ausente o template vira `Bearer undefined` — um valor que
 * qualquer um sabe escrever. Variável ausente aqui fecha a porta, nunca a abre.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const received = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
