import { NextResponse } from 'next/server';
import { logServerError } from '@/lib/log-server-error';
import { API_TIMEOUT_MS } from '@/lib/timeouts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Repasse **anônimo** do relato de um error boundary para a API — o caminho
 * de ingestão da §11.3 do plano de observabilidade (Fase 7c). Quem o chama é
 * o reporter dos boundaries (Fase 7b), com `fetch` e `keepalive: true`.
 *
 * **Same-origin pelo mesmo motivo do `/api/events`:** o relato sai de dentro
 * de um boundary, muitas vezes durante uma navegação que acabou de falhar, e
 * um POST `application/json` direto para a API (outra origem) exigiria
 * preflight. Aqui não há preflight nenhum a fazer.
 *
 * Não usa `proxyToApi`: aquele exige sessão e assina JWT, e aqui **não pode
 * haver identidade** — o `ErrorEvent` não tem dado pessoal em coluna nenhuma,
 * e um relato com dono mudaria a natureza da tabela. Esta rota não lê sessão,
 * não assina nada e não acrescenta cabeçalho de identificação: só o corpo e o
 * content type atravessam. **O IP do leitor também não** — é por isso que o
 * balde de 10/min da API é um só para o site inteiro, e está decidido lá.
 *
 * **O status da API atravessa intacto**, inclusive o 429: é o único código
 * que o reporter tem motivo para ver, e o gatilho numérico da fase é
 * observável na própria API (`GET /api/metrics/http`).
 *
 * `force-dynamic` porque é POST com corpo; nada aqui é cacheável.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.text();

    const backendResponse = await fetch(`${API_BASE_URL}/errors/client`, {
      method: 'POST',
      // Ninguém espera esta resposta — o reporter é fire-and-forget. O prazo
      // existe para a função da Vercel não ficar presa a uma API dormindo
      // por causa de um relato que ninguém vai ler na hora.
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const payload = await backendResponse.json().catch(() => null);
    return NextResponse.json(payload, { status: backendResponse.status });
  } catch (error) {
    /**
     * A linha que a Fase 7a ensinou este BFF a escrever. Sem ela, a ingestão
     * do erro podia estar quebrada por dias e o único sintoma seria a aba de
     * segurança sem nenhuma linha de `origin: WEB` — indistinguível de "o
     * site não quebrou". **Sem nada do corpo na linha**: é texto do
     * navegador, e a rota existe para não acrescentar identidade.
     */
    logServerError('bff.errors.client', error);

    // 502 e não 500: quem falhou foi o repasse. O reporter não lê o código.
    return NextResponse.json({ error: 'Error report unavailable' }, { status: 502 });
  }
}
