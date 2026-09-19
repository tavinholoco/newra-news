import { proxyToApi } from '@/lib/api-proxy';

export const dynamic = 'force-dynamic';

/**
 * Os quatro sinais de ouro (admin) — `GET /api/metrics/http`.
 *
 * Latência, tráfego e erro existiam desde a Fase 9 **sem leitor no web**; a
 * saturação (memória, atraso do event loop e as horas do plano) entrou no 5b.
 * É o que o arco da `/admin` e o painel de sinais da `/admin/metrics` leem.
 *
 * **`saturation.plan` pode vir `null`** — é a única medida que sai do banco, e
 * a rota da API é em memória de propósito para responder quando o banco é o
 * suspeito. A tela desenha "indisponível", nunca zero.
 */
export async function GET(request: Request) {
  return proxyToApi(request, '/metrics/http', 'GET', { requireRole: 'ADMIN' });
}
