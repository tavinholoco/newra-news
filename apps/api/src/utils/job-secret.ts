import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { env } from '../config/env';
import { UnauthorizedError } from './errors';

/**
 * Comparação de segredo em tempo constante.
 *
 * `a !== b` sai no primeiro byte diferente, o que vaza o prefixo correto para
 * quem consegue medir. Aqui o custo de fazer certo é uma linha.
 */
export function secretsMatch(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // `timingSafeEqual` exige mesmo tamanho; comparar o tamanho antes vaza só o
  // tamanho, que não é o segredo.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Exige `Authorization: Bearer <JOB_SECRET>`.
 *
 * **O `alternativeSecret` era a query string, e saiu na Fase 9.** O painel
 * `/dev/dashboard` aceitava `?secret=`, e segredo em query string entra em log
 * de acesso do proxy, em histórico do browser e no `Referer` de qualquer link
 * que a página abrisse. Continua havendo um jeito de abrir o painel no browser
 * — ver `routes/dev/dashboard.ts` —, mas ele passa por um POST e um cookie
 * `HttpOnly`, não pela URL.
 */
export function assertJobSecret(request: FastifyRequest): void {
  const auth = request.headers.authorization;
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
  if (!bearer || !secretsMatch(bearer, env.JOB_SECRET)) {
    throw new UnauthorizedError('Invalid or missing token');
  }
}

// ── Sessão do painel HTML ────────────────────────────────────────────────────

/** Quanto tempo vale a sessão do painel, em segundos. */
export const DASHBOARD_SESSION_TTL_SECONDS = 3600;

export const DASHBOARD_COOKIE_NAME = 'newra_dev_dashboard';

/**
 * Token de sessão do painel: `<expiraEm>.<hmac>`.
 *
 * **Não é o `JOB_SECRET`**, é uma assinatura dele com prazo. Guardar o próprio
 * segredo no cookie devolveria pela porta dos fundos o que tirar da query
 * string resolveu: um valor de vida infinita, copiável, num lugar que não é
 * feito para segredo de longa duração.
 */
export function issueDashboardToken(nowMs: number = Date.now()): string {
  const expiresAt = Math.floor(nowMs / 1000) + DASHBOARD_SESSION_TTL_SECONDS;
  return `${expiresAt}.${signExpiry(expiresAt)}`;
}

export function isValidDashboardToken(
  token: string | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!token) return false;

  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;

  const expiresAt = Number(token.slice(0, separator));
  if (!Number.isInteger(expiresAt) || expiresAt * 1000 <= nowMs) return false;

  return secretsMatch(token.slice(separator + 1), signExpiry(expiresAt));
}

function signExpiry(expiresAt: number): string {
  return createHmac('sha256', env.JOB_SECRET).update(String(expiresAt)).digest('hex');
}

/**
 * Lê um cookie do header, sem dependência nova.
 *
 * `@fastify/cookie` traria um parser completo para o único cookie que a API
 * usa; o header é um formato de uma linha e o teste cobre o caso com vários.
 */
export function readCookie(request: FastifyRequest, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}
