import { test, expect } from '@playwright/test';

/**
 * **Os casos negativos — e são eles que protegem a autorização.**
 *
 * O `role` ADMIN é conferido em três lugares: a página esconde a tela (sessão
 * do next-auth), a rota de BFF recusa antes de assinar, e a API recusa o token.
 * Três portas para a mesma decisão é o desenho certo, e também três lugares
 * para discordarem. **Vistas de fora, num navegador de verdade, é o único lugar
 * de onde dá para ver as três concordando.**
 *
 * Duas destas asserções não precisam de sessão nenhuma e por isso rodam sempre.
 * A terceira — usuário comum barrado em `/admin/metrics` — precisa de uma
 * sessão de leitor e está em `account.spec.ts`, atrás do segredo.
 */

test.describe('anônimo', () => {
  for (const path of ['/pt-BR/favorites', '/pt-BR/account', '/pt-BR/admin']) {
    test(`é mandado ao sign-in em ${path}`, async ({ page }) => {
      const response = await page.goto(path);

      await expect(page).toHaveURL(/\/pt-BR\/signin/);
      // O `callbackUrl` é o que faz a pessoa voltar para onde tentou ir.
      expect(new URL(page.url()).searchParams.get('callbackUrl')).toContain(path);

      /**
       * **307, e antes disto era 200.** O `redirect()` do guard de página é
       * resolvido depois de a resposta começar a ser transmitida — o
       * `loading.tsx` do segmento de idioma despacha a casca na hora — e o
       * Next caía num `<meta http-equiv="refresh" content="1;…">`: um segundo
       * de espera, status errado, e um salto a mais para acrescentar o idioma.
       * Achado ao escrever este arquivo, corrigido no `middleware.ts`.
       */
      expect(response?.request().redirectedFrom()).not.toBeNull();
    });
  }

  test('não vê conteúdo de conta antes de ser redirecionado', async ({ page }) => {
    await page.goto('/pt-BR/favorites');

    // Se a casca da tela de salvos aparecesse antes do redirecionamento, o
    // guard estaria acontecendo tarde demais — que era exatamente o sintoma.
    await expect(page.locator('main')).not.toContainText(/salvos|saved items/i);
  });
});

test.describe('BFF sem sessão', () => {
  for (const route of [
    '/api/account',
    '/api/account/preferences',
    '/api/favorites',
    '/api/favorites/ids',
    '/api/admin/metrics',
    '/api/admin/product-metrics',
  ]) {
    test(`${route} responde 401 com o corpo de erro do produto`, async ({ request }) => {
      const response = await request.get(route);

      expect(response.status()).toBe(401);
      // O formato é um só em todas as rotas — `ApiError` de `packages/types`.
      // Um corpo `null` aqui seria o que o proxy devolvia em resposta não-JSON:
      // status certo e nada que uma tela soubesse dizer.
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
    });
  }

  test('a rota de eventos continua anônima — ela não pode exigir sessão', async ({
    request,
  }) => {
    // O oposto das de cima, e é decisão de produto: a medição é *cookieless*
    // por desenho (§4 dos slots). Um 401 aqui significaria que alguém pôs
    // identidade numa tabela que juridicamente não a tem.
    const response = await request.post('/api/events', {
      data: { events: [] },
      failOnStatusCode: false,
    });

    /**
     * A asserção é sobre **autorização**, e só sobre isso.
     *
     * Os outros códigos que esta rota pode devolver dizem coisas legítimas e
     * variam com o ambiente: **400** é o schema recusando o lote vazio — o
     * certo, e é o schema que separa evento de lixo justamente por não haver
     * sessão para autenticar; **429** é o balde compartilhado da ingestão;
     * **502** é a API não ter respondido, que acontece rodando contra um build
     * local sem backend. Nenhum dos três é uma porta se fechando para quem não
     * se identificou, e é isso que este teste protege.
     */
    expect([401, 403]).not.toContain(response.status());
  });
});
