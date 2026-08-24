import { defineConfig, devices } from '@playwright/test';

/**
 * **O smoke roda contra o que está no ar, e essa é a decisão principal.**
 *
 * `@playwright/test` estava no `devDependencies` desde alguma fase, **sem
 * config e sem uma única spec** — dependência instalada que não executa nada,
 * que é a armadilha do código que ninguém roda sem nem o benefício de já ter
 * sido escrito. A §11.T é onde ela deixa de ser isso.
 *
 * ## Por que produção, e não um build local no CI
 *
 * A cultura deste projeto é medir contra produção, e a razão é histórica: dos
 * quatro defeitos mais caros, **três já estavam no ar** quando foram achados. E
 * há uma classe que só existe lá: **os deploys da Vercel e do Render disparam
 * juntos e não terminam juntos**. Foi assim que a `/news` foi ao ar com as oito
 * categorias zeradas — o build do web correu antes de a API subir a rota nova,
 * o prefetch falhou e a página estática nasceu sem o dado. Um E2E contra build
 * local jamais veria isso; um smoke **depois dos dois deploys** vê.
 *
 * O preço está aceito e escrito: o smoke não cria registro nenhum em produção.
 * Não há inscrição de newsletter de mentira, não há conta criada. Onde o
 * caminho feliz exigiria escrever, o teste exercita a borda que não escreve —
 * ver `newsletter.spec.ts`.
 *
 * ## Um navegador só
 *
 * O smoke prova que **o deploy subiu inteiro**, não que o CSS funciona no
 * Safari. Compatibilidade entre navegadores é trabalho de outra natureza e sem
 * sintoma histórico neste projeto; três navegadores aqui seriam três vezes o
 * tempo para a mesma resposta.
 */
const BASE_URL =
  process.env.SMOKE_BASE_URL ?? 'https://newra-news-web.vercel.app';

export default defineConfig({
  testDir: './e2e',
  /**
   * Serial, e não paralelo, de propósito. O alvo é uma API no plano free do
   * Render com teto de 100 req/min e um balde de 30/min na ingestão de
   * eventos: quatro workers batendo juntos mediriam o rate limit em vez do
   * produto — e o 429 apareceria como falha intermitente de tela.
   */
  workers: 1,
  fullyParallel: false,
  /**
   * Duas tentativas no CI. Não é para esconder teste instável: é que a
   * primeira requisição depois de ~15 min sem tráfego **acorda a API**, e
   * medido na auditoria da Fase 8 isso custa 4,9 s contra 0,22 s de uma
   * quente. Sem retentativa, o smoke reprovaria por hibernação e não por
   * defeito — que é exatamente o erro que o gate do Lighthouse cometeu.
   */
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  timeout: 45_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Acima do prazo de 8 s que o servidor do Next dá à API, para que uma
    // espera de cold start apareça como lentidão e não como navegação abortada.
    navigationTimeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
