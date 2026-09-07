import { NextResponse } from 'next/server';
import { logServerError } from '@/lib/log-server-error';
import { API_TIMEOUT_MS } from '@/lib/timeouts';

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
      // O prazo importa aqui **mais** que nas outras rotas, e por um motivo
      // invertido: ninguém está esperando esta resposta. Sem timeout, uma API
      // dormindo prenderia a função da Vercel pelo tempo inteiro dela para
      // gravar um evento que já não interessa a ninguém — e o custo é da
      // plataforma, não da tela.
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const payload = await backendResponse.json().catch(() => null);
    return NextResponse.json(payload, { status: backendResponse.status });
  } catch (error) {
    /**
     * **Esta é a rota onde "o status existe para o log" era literalmente falso.**
     *
     * O comentário abaixo sempre esteve certo sobre o cliente — `sendBeacon` não
     * tem canal de retorno, ninguém lê este 502 —, e é justamente isso que fazia
     * deste o único dos três `catch` **sem sintoma nenhum**. O do proxy devolve
     * um erro que alguém vê na tela; o do cron deixa a Home sem briefing. Aqui a
     * ingestão podia estar quebrada por dias, e o que apareceria seria a tela de
     * métricas ficando plana — o sinal mais lento que este produto sabe emitir, e
     * o mais fácil de confundir com "ninguém acessou".
     *
     * **Sem nada do corpo na linha.** O lote é anônimo por desenho (§4 dos
     * slots) e a rota inteira existe para não acrescentar identidade; despejar o
     * corpo no log seria reabrir por trás o que a rota fecha na frente.
     */
    logServerError('bff.events', error);

    // **502 e não 500**: quem falhou foi o repasse, não esta rota. E o cliente
    // não faz nada com o código de qualquer forma — `sendBeacon` não tem
    // retorno. O status existe para o log, não para o navegador.
    return NextResponse.json({ error: 'Event ingest unavailable' }, { status: 502 });
  }
}
