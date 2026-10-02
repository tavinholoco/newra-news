/**
 * **Tenta acordar a API do Render antes do `next build` publicar, e diz no log
 * quem recusou** (01/10/2026).
 *
 * O prerender da Home, das listagens e dos dois sitemaps chama a API, e na
 * Vercel a falha relança — o deploy anterior fica no ar (`nullUnlessPublishing`,
 * `prefetch`).
 *
 * **O que foi medido em 01/10, e por que este script não resolve sozinho:** a
 * borda do Render (Cloudflare) devolve `429` a tráfego vindo da Vercel em 0,1
 * s, de forma intermitente — a máquina de build e até uma função da Vercel,
 * com a instância **acordada** (a API nunca registrou um 429; às 23:39 ela
 * respondia 200 a uma função e 429 ao build no mesmo minuto). A hipótese mais
 * provável é um limite por IP de origem, com os IPs de saída da Vercel
 * partilhados por muitos clientes. Acordar pelo site em produção foi tentado
 * e também levou 429. Quando a borda libera, a sonda passa e o build também
 * (22:38 e 22:52 de 01/10); quando não, o build cai e a Vercel mantém o
 * deploy anterior — **o remédio é o botão "Redeploy" mais tarde**.
 *
 * O script espera até 120 s pela borda liberar e imprime os cabeçalhos que
 * dizem de quem é o 429 (`x-ratelimit-*` é a nossa API; sem eles, é a borda).
 * Só onde o build publica (`VERCEL`), e **nunca reprova**.
 */
const PROBE_TIMEOUT_MS = 10_000;
const WAIT_BUDGET_MS = 120_000;
const PAUSE_MS = 10_000;

const seconds = (started) => ((Date.now() - started) / 1000).toFixed(1);

async function probe(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    const who = res.headers.get('x-ratelimit-limit') ? 'a API' : 'a borda';
    const extra = res.ok
      ? ''
      : ` — quem respondeu: ${who} (server=${res.headers.get('server') ?? '?'}, retry-after=${res.headers.get('retry-after') ?? '-'})`;
    return { ok: res.ok, label: `${res.status} em ${seconds(started)} s${extra}` };
  } catch (error) {
    return { ok: false, label: `${error?.name ?? 'erro'} em ${seconds(started)} s` };
  }
}

async function main() {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!process.env.VERCEL || !base) return;

  const health = `${base.replace(/\/$/, '')}/health`;
  const deadline = Date.now() + WAIT_BUDGET_MS;
  for (;;) {
    const result = await probe(health);
    console.log(`[warm-api] sonda: ${result.label}`);
    if (result.ok) return;
    if (Date.now() + PAUSE_MS >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }
  console.log('[warm-api] a borda não liberou; o build segue — se cair, use "Redeploy" na Vercel mais tarde');
}

main().catch(() => {});
