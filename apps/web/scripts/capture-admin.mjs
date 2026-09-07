// Captura as telas de **admin**, que exigem sessão — e por isso nunca estiveram
// na baseline visual.
//
//   pnpm --filter @newranews/web admin:capture
//
// O `capture-visual-baseline.mjs` cobre as rotas públicas e exclui `/admin`
// com um comentário que diz o porquê: *"exige sessão + role ADMIN (§30)"*. Este
// script é a outra metade — mesma mecânica de captura (freeze de animação,
// tema por `localStorage`, `networkidle`, fullPage), com uma sessão forjada.
//
// ## A sessão é forjada, e é a mesma mecânica que o smoke E2E já usa
//
// `e2e/support/session.ts` assina o cookie do next-auth com o `NEXTAUTH_SECRET`
// — que é exatamente o que o next-auth faz **depois** do OAuth. O que se pula é
// o provedor; o resto do caminho é o de verdade: o cookie passa pelo mesmo
// `getServerSession`, o BFF assina o mesmo JWT, a API valida do mesmo jeito.
//
// ## As quatro decisões de segurança, e nenhuma delas é opcional
//
// 1. **Nada disto mora no app.** Não há `if (NODE_ENV === 'development')
//    autoLogin()`, não há rota de bypass, não há conta fixa. Apagar este arquivo
//    deixa o produto bit a bit igual. Atalho de autenticação dentro do app é a
//    categoria **M10 (Extraneous Functionality)** da OWASP e o **CWE-489
//    (Active Debug Code)** — a classe que já produziu vazamento de verdade,
//    porque depende de um `NODE_ENV` que um dia vem errado.
// 2. **Só localhost, e a recusa é a primeira coisa que o script faz.** É o que
//    impede que ele seja apontado para produção por engano ou por hábito.
// 3. **O `NEXTAUTH_SECRET` local tem de ser diferente do de produção.** Se
//    forem o mesmo, forjar sessão aqui põe a chave que assina as sessões reais
//    no caminho de qualquer ferramenta que rode neste diretório. Um comando
//    resolve, e ele está na mensagem de erro abaixo.
// 4. **O que sai daqui não é versionado.** `.admin-captures/` está no
//    `.gitignore`: são telas de uma sessão administrativa, e o próprio cookie
//    forjado tem prazo de minutos justamente para não sobreviver à execução.
//
// Variáveis: `BASE_URL`, `WIDTHS`, `THEMES`, `ROUTES`, `OUT_DIR`, `FORMAT`.

import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { encode } from 'next-auth/jwt';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT_DIR = path.resolve(
  process.env.OUT_DIR ?? path.join(import.meta.dirname, '../.admin-captures'),
);
const FORMAT = process.env.FORMAT === 'jpeg' ? 'jpeg' : 'png';

/** Onde o cookie forjado pode chegar. Fora daqui, o script não roda. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * As larguras que importam para esta área.
 *
 * O padrão são duas e não cinco: **375 é onde a linha da lista quebra e o
 * `<pre>` do contexto pode estourar a página**, e 1440 é a leitura normal. As
 * do meio não acrescentam decisão — quem quiser, passa `WIDTHS`.
 */
const ALL_VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
];
const WIDTHS = (process.env.WIDTHS ?? '375,1440').split(',').map((w) => w.trim());
const VIEWPORTS = ALL_VIEWPORTS.filter((v) => WIDTHS.includes(v.name));

/** Escuro é onde token errado aparece — a lição da revisão 10.3 da baseline. */
const THEMES = (process.env.THEMES ?? 'light,dark').split(',').map((t) => t.trim());

/**
 * As telas, e o que cada uma existe para mostrar.
 *
 * `expand` clica na primeira linha de execução antes de fotografar: o detalhe
 * do run é linha expansível, então sem o clique ele não aparece em captura
 * nenhuma — e é justamente onde moram os eventos por etapa e o `<pre>` do
 * contexto, as duas coisas que apertam no 375.
 */
const ALL_ROUTES = [
  { slug: 'admin', url: '/pt-BR/admin' },
  { slug: 'admin-expanded', url: '/pt-BR/admin', expand: true },
  { slug: 'admin-metrics', url: '/pt-BR/admin/metrics' },
  { slug: 'admin-en', url: '/en/admin', expand: true, widths: ['1440'], themes: ['light'] },
];
const ROUTES = process.env.ROUTES
  ? ALL_ROUTES.filter((r) => process.env.ROUTES.split(',').map((s) => s.trim()).includes(r.slug))
  : ALL_ROUTES;

/** O mesmo congelamento da baseline: sem cursor, sem animação, sem transição. */
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
`;

/**
 * O segredo, do ambiente ou do `.env.local` — e **nunca impresso**.
 *
 * Ler o arquivo aqui é o que mantém o valor dentro do processo: ele não passa
 * por linha de comando, não entra no histórico do shell e não aparece em log.
 */
async function readSecret() {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;

  const envFile = path.join(import.meta.dirname, '../.env.local');
  let content;
  try {
    content = await readFile(envFile, 'utf8');
  } catch {
    return null;
  }

  const match = content.match(/^NEXTAUTH_SECRET=(.*)$/m);
  return match?.[1]?.trim().replace(/^["']|["']$/g, '') || null;
}

function refuseNonLocal() {
  const { hostname } = new URL(BASE_URL);
  if (LOCAL_HOSTS.has(hostname)) return;

  console.error(
    `\nRecusado: BASE_URL aponta para "${hostname}".\n\n` +
      'Este script forja um cookie de sessão de administrador. Ele só roda\n' +
      'contra localhost — apontá-lo para um ambiente publicado seria criar uma\n' +
      'sessão administrativa real a partir de um segredo em disco.\n',
  );
  process.exit(2);
}

/** Um id sintético: as rotas de admin decidem por `role`, nunca por quem é. */
const USER_ID =
  process.env.ADMIN_CAPTURE_USER_ID ?? '00000000-0000-4000-8000-000000000000';

async function sessionCookie(secret) {
  const token = await encode({
    secret,
    // Minutos, não os 30 dias do helper do E2E: este cookie existe pelo tempo
    // de uma captura e não deve sobreviver a ela.
    maxAge: 5 * 60,
    token: {
      // Com `id` presente, o callback `jwt` não dispara o upsert — é o
      // comportamento de uma sessão já confirmada (ver lib/auth.ts).
      id: USER_ID,
      sub: USER_ID,
      email: 'capture@localhost',
      name: 'Captura',
      role: 'ADMIN',
    },
  });

  const url = new URL(BASE_URL);
  return {
    // O prefixo `__Secure-` só existe sobre HTTPS, e o navegador recusa o
    // cookie com esse nome sem `secure`. Errar aqui não dá erro: dá uma sessão
    // que simplesmente não existe.
    name:
      url.protocol === 'https:'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
    value: token,
    domain: url.hostname,
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'Lax',
  };
}

async function capture(browser, cookie, route, viewport, theme) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: route.url.startsWith('/en') ? 'en-US' : 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: theme,
    reducedMotion: 'reduce',
  });
  await context.addCookies([cookie]);
  await context.addInitScript((value) => {
    try {
      window.localStorage.setItem('theme', value);
    } catch {
      /* o colorScheme do contexto ainda vale */
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

    const status = response?.status() ?? 0;
    // Sessão que não pegou manda para o sign-in, e a captura sairia da tela
    // errada sem nada dizer. É o modo de falha silencioso deste script.
    if (page.url().includes('/signin')) {
      console.error(`  FALHOU ${path.basename(file)}: caiu no sign-in`);
      return { file: path.basename(file), ok: false, reason: 'sessão recusada' };
    }

    if (route.expand) {
      const toggle = page.locator('[aria-expanded]').first();
      if (await toggle.count()) {
        await toggle.click();
        await page.waitForTimeout(400);
        // O `<details>` do contexto é o que apertaria no 375, então ele abre.
        const details = page.locator('details').first();
        if (await details.count()) await details.evaluate((el) => el.setAttribute('open', ''));
      }
    }

    await page.addStyleTag({ content: FREEZE_CSS });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled', type: FORMAT });

    console.log(`  ${path.basename(file)} (HTTP ${status})`);
    return { file: path.basename(file), ok: true };
  } catch (error) {
    console.error(`  FALHOU ${path.basename(file)}: ${error.message}`);
    return { file: path.basename(file), ok: false, reason: error.message };
  } finally {
    await context.close();
  }
}

async function main() {
  refuseNonLocal();

  const secret = await readSecret();
  if (!secret) {
    console.error(
      '\nSem `NEXTAUTH_SECRET` — nem no ambiente, nem em apps/web/.env.local.\n\n' +
        'Ele precisa existir e **precisa ser diferente do segredo de produção**:\n' +
        'com o mesmo valor dos dois lados, forjar sessão aqui é ter em disco a\n' +
        'chave que assina as sessões reais. Para gerar um local:\n\n' +
        '  openssl rand -base64 32\n',
    );
    process.exit(2);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const cookie = await sessionCookie(secret);

  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });

  console.log(`Capturando ${BASE_URL} → ${OUT_DIR}`);
  const results = [];
  try {
    for (const route of ROUTES) {
      console.log(`\n${route.slug} (${route.url})`);
      const viewports = route.widths
        ? ALL_VIEWPORTS.filter((v) => route.widths.includes(v.name))
        : VIEWPORTS;
      const themes = route.themes ?? THEMES;

      for (const viewport of viewports) {
        for (const theme of themes) {
          results.push(await capture(browser, cookie, route, viewport, theme));
        }
      }
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} capturas.`);
  if (failed.length > 0) {
    for (const f of failed) console.error(`  ${f.file}: ${f.reason}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
