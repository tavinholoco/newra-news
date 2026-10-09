import { NextResponse } from 'next/server';
import { signAuthJwt } from '@/lib/jwt';
import { logServerError } from '@/lib/log-server-error';
import { API_RENDER_TIMEOUT_MS } from '@/lib/timeouts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Um dia, como toda página guardada: **um robô não acorda a API com esta
 * rota.** Quem a regenera é o cron diário, que a invalida e a pede depois do
 * run, com a API acordada (`dailyPages` em `lib/daily-revalidation.ts`).
 */
export const revalidate = 86400;

type ProbeReason = 'accepted' | 'rejected' | 'unexpected' | 'unreachable' | 'not-configured';

interface ProbeResult {
  ok: boolean;
  reason: ProbeReason;
  /** O status da API; `null` quando ela não foi perguntada ou não respondeu. */
  status: number | null;
  checkedAt: string;
}

/**
 * **A sonda do par de JWT entre a Vercel e a API** — 13.7 do plano de
 * observabilidade, 09/10/2026.
 *
 * Os fluxos com login do Smoke ficam desligados por decisão do dono: pôr o
 * `NEXTAUTH_SECRET` de produção no CI daria a qualquer dependência
 * comprometida do job uma sessão de **admin** — o papel vem do token, nunca do
 * banco. O defeito que eles pegariam é o par `AUTH_JWT_SECRET` divergente
 * entre as duas plataformas: todo leitor logado em 401 com o site anônimo
 * perfeito, e isso já aconteceu uma vez em produção.
 *
 * Aqui ele é perguntado **sem segredo fora das duas plataformas**: esta rota
 * assina, com o segredo que já mora na Vercel, um token com
 * `purpose: 'health-probe'` — sem papel, sem sessão — que a API aceita **só**
 * no `GET /api/health/auth`. Nenhuma outra porta o aceita, e o token de sessão
 * não abre esta. O batimento (`apps/api/scripts/heartbeat.ts`) lê o resultado
 * desta rota, do cache da Vercel.
 *
 * **Responde 200 mesmo quando a sonda falha, de propósito.** Pela regra da
 * Vercel, 5xx numa regeneração mantém o documento anterior e 200 o substitui —
 * a armadilha 43 ao contrário: aqui o "ok" de ontem **tem** de sair do ar
 * quando a sonda de hoje recusa.
 */
export async function GET() {
  const result = (reason: ProbeReason, status: number | null): NextResponse =>
    NextResponse.json({
      ok: reason === 'accepted',
      reason,
      status,
      checkedAt: new Date().toISOString(),
    } satisfies ProbeResult);

  let token: string;
  try {
    token = await signAuthJwt({
      sub: 'health-probe',
      email: 'health-probe@newranews.invalid',
      purpose: 'health-probe',
    });
  } catch (error) {
    // Sem `AUTH_JWT_SECRET` na Vercel, todo login está quebrado — e é isso
    // que a sonda diz, sem chamar a API.
    logServerError('bff.health.auth', error, { status: null });
    return result('not-configured', null);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/health/auth`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
      // O prazo da renderização no servidor: cobre a acordada do Render (~52 s)
      // quando a regeneração não vem do cron.
      signal: AbortSignal.timeout(API_RENDER_TIMEOUT_MS),
      // **Nunca `cache: 'no-store'`**: no Next 14 ele é uso dinâmico, o build
      // marca a rota `ƒ` e o `revalidate` acima deixa de valer — cada pedido
      // chamava o Render (medido em produção em 09/10/2026, armadilha 48). O
      // mesmo período do arquivo; a resposta não é reaproveitada de uma
      // regeneração para outra porque o token novo (`iat`) muda a chave do
      // cache de dados, e a invalidação do cron alcança a rota.
      next: { revalidate: 86400 },
    });
    if (response.status === 200) return result('accepted', 200);
    if (response.status === 401) return result('rejected', 401);
    return result('unexpected', response.status);
  } catch (error) {
    logServerError('bff.health.auth', error, { status: null });
    return result('unreachable', null);
  }
}
