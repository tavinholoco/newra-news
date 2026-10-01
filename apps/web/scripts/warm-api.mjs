/**
 * **Acorda a API do Render antes do `next build` publicar** (01/10/2026).
 *
 * O prerender da Home, das listagens e dos dois sitemaps chama a API, e na
 * Vercel a falha relança — o deploy anterior fica no ar (`nullUnlessPublishing`,
 * `prefetch`). Com a API dormindo de propósito (as horas do Render), todo
 * deploy a pega fria.
 *
 * **Medido em 01/10, em dois passos:** a rajada de ~20 requisições do
 * prerender voltou `429` por 2,5 min; e uma requisição **isolada** desta
 * máquina de build também voltou `429` — em 0,1 s, quatro vezes seguidas. O
 * Render recusa acordar a instância free para o IP de build da Vercel, e
 * responde de fora da aplicação (a API dormia; o nosso limitador nem viu).
 * Já a **função** da Vercel a acorda — é o que o cron das 11:00 faz todo dia
 * com o `warmApi` —, e com a API acordada o build passa (22:38 e 22:52 de
 * 01/10).
 *
 * Por isso, quando a sonda direta não dá 200, a acordada vai **pelo site em
 * produção**: um `POST /api/events` com lote vazio entra numa função da
 * Vercel, que repassa à API — a API recusa o lote (400), mas acordou. A
 * partir daí a sonda direta espera ela responder.
 *
 * Só onde o build publica (`VERCEL`), e **nunca reprova**: se não acordar, o
 * prerender tenta do mesmo jeito, e a repetição de `fetchApi` cobre o resto.
 */
const PROBE_TIMEOUT_MS = 10_000;
const WAKE_TIMEOUT_MS = 30_000;
/** A acordada medida em 01/10 foi de ~52 s; folga para o dobro. */
const WAIT_BUDGET_MS = 120_000;
const PAUSE_MS = 5_000;
/** Reenvia a acordada por função a cada N sondas, caso a primeira se perca. */
const WAKE_EVERY = 6;

/** A URL pública do site, na mesma ordem de `lib/seo.ts`. */
function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return 'https://newra-news-web.vercel.app';
}

const seconds = (started) => ((Date.now() - started) / 1000).toFixed(1);

async function probe(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return { ok: res.ok, label: `${res.status} em ${seconds(started)} s` };
  } catch (error) {
    return { ok: false, label: `${error?.name ?? 'erro'} em ${seconds(started)} s` };
  }
}

async function wakeThroughSite() {
  const url = `${siteUrl().replace(/\/$/, '')}/api/events`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] }),
      signal: AbortSignal.timeout(WAKE_TIMEOUT_MS),
    });
    console.log(`[warm-api] acordada pelo site (${url}): ${res.status} em ${seconds(started)} s`);
  } catch (error) {
    console.log(`[warm-api] acordada pelo site (${url}): ${error?.name ?? 'erro'} em ${seconds(started)} s`);
  }
}

async function main() {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!process.env.VERCEL || !base) return;

  const health = `${base.replace(/\/$/, '')}/health`;
  const first = await probe(health);
  console.log(`[warm-api] sonda direta: ${first.label}`);
  if (first.ok) return;

  const deadline = Date.now() + WAIT_BUDGET_MS;
  for (let attempt = 0; Date.now() < deadline; attempt++) {
    if (attempt % WAKE_EVERY === 0) await wakeThroughSite();
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    const next = await probe(health);
    console.log(`[warm-api] sonda direta: ${next.label}`);
    if (next.ok) return;
  }
  console.log('[warm-api] a API não acordou; o build segue e o prerender tenta do mesmo jeito');
}

main().catch(() => {});
