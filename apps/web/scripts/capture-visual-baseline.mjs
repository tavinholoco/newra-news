// Captura a baseline visual das rotas públicas (plano V2 §30).
//
// A V2.0 troca os design tokens globalmente na Fase 1, então a aparência atual
// deixa de existir assim que a foundation entra. Este script fotografa o estado
// de referência e continua sendo o mecanismo de captura das fases seguintes:
// rode-o de novo depois de cada etapa relevante e compare os diretórios.
//
// Pré-requisitos: a API em NEXT_PUBLIC_API_URL e o site em BASE_URL no ar.
//
//   pnpm --filter @newranews/web visual:baseline
//   BASE_URL=http://localhost:3000 OUT_DIR=../../docs/v2/baseline-v2 node scripts/capture-visual-baseline.mjs
//
// As rotas de detalhe (`/news/[id]` e `/article/[date]`) são resolvidas em tempo
// de execução pela API — ids de notícia são removidos pelo cleanup do pipeline
// e a data do artigo muda todo dia, então fixá-las no código quebraria o script.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const OUT_DIR = path.resolve(
  process.env.OUT_DIR ?? path.join(import.meta.dirname, '../../../docs/v2/baseline-v1'),
);

// As 5 larguras da §30. O nome entra no arquivo, então mantenha-o ordenável.
const ALL_VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
];

// WIDTHS=375,768,1440 restringe a captura. Útil para o conjunto versionado, que
// não precisa das 5 larguras (ver docs/v2/baseline-v1/README.md).
const WIDTHS = process.env.WIDTHS?.split(',').map((w) => w.trim());
const VIEWPORTS = WIDTHS
  ? ALL_VIEWPORTS.filter((v) => WIDTHS.includes(v.name))
  : ALL_VIEWPORTS;

// PNG é o padrão: a comparação entre etapas da V2 quer pixels exatos. JPEG só
// para o conjunto que vai para o git, onde o peso importa mais que o pixel.
const FORMAT = process.env.FORMAT === 'jpeg' ? 'jpeg' : 'png';
const QUALITY = Number(process.env.QUALITY ?? 82);

// Rotas com captura em dark mode além do claro. O dark é uma opção real de
// leitura na V2 (§4.2), mas capturar as 11 rotas nos 2 temas dobraria o peso do
// diretório sem acrescentar informação nova nas páginas de formulário.
const DARK_ROUTES = new Set(['home', 'news', 'article-detail']);
const DARK_VIEWPORTS = new Set(['375', '1440']);

/** Desliga animação/transição/caret para o screenshot ser determinístico. */
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
`;

async function resolveRoutes() {
  const routes = [
    { slug: 'home', url: '/pt-BR' },
    { slug: 'news', url: '/pt-BR/news' },
    { slug: 'article-history', url: '/pt-BR/article' },
    { slug: 'about', url: '/pt-BR/about' },
    { slug: 'newsletter', url: '/pt-BR/newsletter' },
    // /pt-BR/admin/metrics fica de fora: exige sessão + role ADMIN (§30).
    // Era /pt-BR/dashboard, pública, até 20/08/2026.
    { slug: 'signin', url: '/pt-BR/signin' },
    // Anônimo: o next-intl redireciona para /signin. A baseline registra o que
    // um visitante deslogado vê — o estado autenticado não está coberto.
    { slug: 'favorites-anon', url: '/pt-BR/favorites' },
    { slug: 'newsletter-unsubscribe', url: '/pt-BR/newsletter/unsubscribe' },
    { slug: 'not-found', url: '/pt-BR/rota-que-nao-existe' },
    { slug: 'home-en', url: '/en' },
  ];

  const [newsId, articleDate] = await Promise.all([
    fetch(`${API_URL}/news?limit=1`)
      .then((r) => r.json())
      .then((r) => r.data?.[0]?.id)
      .catch(() => null),
    fetch(`${API_URL}/articles/latest`)
      .then((r) => r.json())
      .then((r) => r.data?.date?.slice(0, 10))
      .catch(() => null),
  ]);

  if (newsId) {
    routes.splice(2, 0, { slug: 'news-detail', url: `/pt-BR/news/${newsId}` });
  } else {
    console.warn('! sem notícia na API — /news/[id] fica fora da baseline');
  }

  if (articleDate) {
    routes.push({ slug: 'article-detail', url: `/pt-BR/article/${articleDate}` });
  } else {
    console.warn('! sem artigo na API — /article/[date] fica fora da baseline');
  }

  return routes;
}

async function capture(browser, route, viewport, theme) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: theme,
    reducedMotion: 'reduce',
  });

  // O tema é aplicado antes do paint pelo script inline do layout, que lê a
  // chave `theme` do localStorage (components/theme/theme-init.tsx).
  await context.addInitScript((value) => {
    try {
      window.localStorage.setItem('theme', value);
    } catch {
      /* localStorage indisponível — o colorScheme do contexto ainda vale */
    }
  }, theme);

  const page = await context.newPage();
  const suffix = theme === 'dark' ? '-dark' : '';
  const ext = FORMAT === 'jpeg' ? 'jpg' : 'png';
  const file = path.join(OUT_DIR, `${route.slug}--${viewport.name}${suffix}.${ext}`);

  try {
    const response = await page.goto(`${BASE_URL}${route.url}`, {
      waitUntil: 'networkidle',
      timeout: 45_000,
    });
    await page.addStyleTag({ content: FREEZE_CSS });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: file,
      fullPage: true,
      animations: 'disabled',
      type: FORMAT,
      ...(FORMAT === 'jpeg' ? { quality: QUALITY } : {}),
    });

    const status = response?.status() ?? 0;
    console.log(`  ${path.basename(file)} (HTTP ${status})`);
    return { file: path.basename(file), route: route.url, status, ok: true };
  } catch (error) {
    console.error(`  FALHOU ${path.basename(file)}: ${error.message}`);
    return { file: path.basename(file), route: route.url, ok: false };
  } finally {
    await context.close();
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const routes = await resolveRoutes();
  // Em ambientes que já trazem o Chromium instalado (containers de CI, sandbox
  // remoto), aponte CHROMIUM_PATH para o binário em vez de baixar outro.
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  const results = [];

  try {
    for (const route of routes) {
      console.log(`\n${route.slug} — ${route.url}`);
      for (const viewport of VIEWPORTS) {
        results.push(await capture(browser, route, viewport, 'light'));
        if (DARK_ROUTES.has(route.slug) && DARK_VIEWPORTS.has(viewport.name)) {
          results.push(await capture(browser, route, viewport, 'dark'));
        }
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  await writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        format: FORMAT,
        viewports: VIEWPORTS.map((v) => v.width),
        shots: results,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`\n${results.length - failed.length}/${results.length} capturas em ${OUT_DIR}`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main();
