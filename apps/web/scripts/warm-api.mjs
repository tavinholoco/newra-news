/**
 * **Acorda a API do Render antes do `next build` publicar** (01/10/2026).
 *
 * O prerender da Home, das listagens e dos dois sitemaps chama a API, e na
 * Vercel a falha relança — o deploy anterior fica no ar (`nullUnlessPublishing`,
 * `prefetch`). Com a API dormindo de propósito (as horas do Render), o build do
 * #255 caiu três vezes com `429 Too Many Requests` em toda página, por 2,5 min
 * seguidos: as ~20 requisições simultâneas do prerender contra a instância
 * hibernada foram recusadas pelo Render **sem acordá-la** — um `curl` isolado,
 * logo depois, a acordou em ~14 s. Aqui vai **uma** requisição por vez, como o
 * `warmApi` do cron.
 *
 * Só onde o build publica (`VERCEL`), e **nunca reprova**: se não acordar, o
 * prerender tenta do mesmo jeito, e a repetição de `fetchApi` cobre o resto.
 */
const ATTEMPTS = 4;
const TIMEOUT_MS = 30_000;
const PAUSE_MS = 5_000;

async function main() {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!process.env.VERCEL || !base) return;

  const url = `${base.replace(/\/$/, '')}/health`;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const started = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`[warm-api] tentativa ${attempt}: ${res.status} em ${seconds} s`);
      if (res.ok) return;
    } catch (error) {
      const seconds = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`[warm-api] tentativa ${attempt}: ${error?.name ?? 'erro'} em ${seconds} s`);
    }
    if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }
  console.log('[warm-api] a API não acordou; o build segue e o prerender tenta do mesmo jeito');
}

main().catch(() => {});
