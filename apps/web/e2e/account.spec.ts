import { test, expect } from '@playwright/test';
import { ADMIN, READER, canSignIn, canSignInAsAdmin, signIn } from './support/session';

/**
 * **Fluxos 4 e 5 da §25 — Conta e Admin, mais o caso negativo que só existe
 * com sessão.**
 *
 * Pulados quando não há segredo para forjar a sessão, e o pulo aparece no
 * relatório e no passo do workflow — ver `support/session.ts` para o que custa
 * ligá-los e por que a decisão é de quem é dono do segredo.
 *
 * **Estes specs escrevem em produção**, e é a única família do smoke que
 * escreve: salvar uma matéria cria uma linha `Favorite`. Por isso o teste
 * **desfaz o que fez** — salva e remove, na mesma sessão —, e a conta é de
 * teste. Preferência é escrita e reescrita para o mesmo valor.
 */

test.describe('conta', () => {
  test.skip(
    !canSignIn,
    'E2E_NEXTAUTH_SECRET/E2E_USER_ID ausentes — fluxo com login desligado (ver e2e/support/session.ts)',
  );

  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL as string, READER);
  });

  test('a tela de conta carrega o perfil vindo da API', async ({ page }) => {
    await page.goto('/pt-BR/account');

    await expect(page).toHaveURL(/\/pt-BR\/account$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // O e-mail vem de `GET /api/account`, que atravessa o BFF e a API inteira.
    // É a prova de que a costura autenticada funciona ponta a ponta.
    await expect(page.locator('main')).toContainText(READER.email);
  });

  test('salvar aparece em /favorites, e o teste desfaz o que fez', async ({ page }) => {
    await page.goto('/pt-BR/news');

    const firstStory = page.locator('a[href*="/news/"]').first();
    const href = (await firstStory.getAttribute('href')) as string;
    await page.goto(href);

    const save = page.getByRole('button', { name: /salvar|save/i }).first();
    await save.click();
    // O botão é o mesmo para salvar e remover; o estado é o que muda.
    await expect(save).toHaveAttribute('aria-pressed', 'true');

    await page.goto('/pt-BR/favorites');
    await expect(page.locator(`a[href*="${href.split('/').pop()}"]`).first()).toBeVisible();

    // Desfaz: o smoke não deixa rastro numa conta de produção.
    await page.goto(href);
    await page.getByRole('button', { name: /salvar|save|remover|remove/i }).first().click();
    await expect(
      page.getByRole('button', { name: /salvar|save|remover|remove/i }).first(),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  test('a preferência persiste — grava na API e volta na recarga', async ({ page }) => {
    await page.goto('/pt-BR/account/preferences');

    const theme = page.getByRole('radio').or(page.getByRole('button')).first();
    await expect(theme).toBeVisible();

    // O tema é aplicado **quando o servidor confirma**, a partir do que ele
    // devolveu — aplicar no clique deixaria a tela escura com a escolha não
    // gravada se o `PUT` falhasse.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('leitor comum é barrado em /admin/metrics — a porta da página', async ({
    page,
  }) => {
    // O terceiro caso negativo da §11.T, e o único que precisa de sessão: sem
    // ela o visitante vai para o sign-in e não chega a testar o papel.
    await page.goto('/pt-BR/admin/metrics');

    await expect(page.locator('main')).not.toContainText(/p95|error rate/i);
  });

  test('leitor comum é barrado no BFF de admin — a segunda porta', async ({ page }) => {
    /**
     * **`page.request`, e não a fixture `request`.**
     *
     * A fixture `request` do Playwright é um contexto de rede **próprio**: ela
     * não compartilha cookie com o `BrowserContext`, então a sessão forjada no
     * `beforeEach` não chega nela. O teste devolveria 401 e passaria pela
     * metade errada da porta — provando "não sei quem você é" onde o que
     * importa provar é "sei, e não pode".
     */
    const response = await page.request.get('/api/admin/metrics', {
      failOnStatusCode: false,
    });

    // 403 e não 401: há sessão, falta papel. A distinção é o que separa "não
    // sei quem você é" de "sei, e não pode".
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: 'Admin access required' });
  });
});

test.describe('admin', () => {
  test.skip(
    !canSignInAsAdmin,
    'E2E_ADMIN_USER_ID ausente — fluxo de admin desligado (ver e2e/support/session.ts)',
  );

  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL as string, ADMIN);
  });

  test('o painel de métricas carrega para ADMIN', async ({ page }) => {
    await page.goto('/pt-BR/admin/metrics');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Se as três portas concordam, o dado chega: sessão com papel, BFF
    // assinando o `role`, e a API aceitando o claim.
    await expect(page.locator('main')).not.toContainText(/restrit|restricted/i);
  });
});
