import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Repasse **anônimo** do lote de eventos para a API.
 *
 * **Existe por causa do `sendBeacon`, não por causa de autenticação.** O beacon
 * é o único transporte que o navegador promete entregar durante uma navegação,
 * e ele **não sabe fazer preflight**: um POST `application/json` para outra
 * origem (a API no Render) exigiria preflight e falharia em silêncio. Sendo
 * same-origin, não há preflight nenhum a fazer.
 *
 * Não usa `proxyToApi`: aquele exige sessão e assina JWT, e aqui **não pode
 * haver identidade** — é a §4 dos slots. Esta rota não lê sessão, não assina
 * nada e não acrescenta cabeçalho de identificação.
 *
 * `force-dynamic` porque é POST com corpo; nada aqui é cacheável.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.text();

    const backendResponse = await fetch(`${API_BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const payload = await backendResponse.json().catch(() => null);
    return NextResponse.json(payload, { status: backendResponse.status });
  } catch {
    // **502 e não 500**: quem falhou foi o repasse, não esta rota. E o cliente
    // não faz nada com o código de qualquer forma — `sendBeacon` não tem
    // retorno. O status existe para o log, não para o navegador.
    return NextResponse.json({ error: 'Event ingest unavailable' }, { status: 502 });
  }
}
