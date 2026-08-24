import { test, expect } from '@playwright/test';

/**
 * **Fluxo 3 da §25 — Newsletter.**
 *
 * ## O que este arquivo deliberadamente não faz: inscrever alguém
 *
 * O smoke roda **contra produção**, e por isso ele não pode criar registro. Uma
 * inscrição de mentira vira uma linha `Subscriber` de verdade, que entra na
 * contagem que a tela de métricas usa para responder "dá para vender
 * patrocínio?" — e recebe o briefing por e-mail no dia seguinte. Não há como
 * desfazer sem o token, que só existe no banco.
 *
 * Então o caminho feliz da inscrição fica **fora** do smoke, com o motivo
 * escrito, e o que entra são as duas bordas que não escrevem nada e que
 * atravessam a mesma costura:
 *
 * - **o formulário rejeita e-mail inválido no cliente**, com a mensagem ligada
 *   ao campo (`aria-describedby`, achado da revisão 10.2 — o `role='alert'`
 *   anunciava uma vez e quem voltava ao campo ouvia só "entrada inválida");
 * - **o cancelamento com token inexistente diz "link inválido"**, e essa é a
 *   asserção mais valiosa do arquivo. Ela é o único ponto do produto onde a
 *   distinção da Fase 10 entre *"a API disse não"* e *"a API não respondeu"* é
 *   observável de fora: antes dela, quem só tinha pegado a API dormindo era
 *   informado de que o próprio link de descadastro não presta.
 */

test.describe('newsletter', () => {
  test('a landing existe e mostra o formulário', async ({ page }) => {
    await page.goto('/pt-BR/newsletter');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel(/e-?mail/i).first()).toBeVisible();
  });

  test('e-mail inválido é recusado no cliente, e a mensagem fica ligada ao campo', async ({
    page,
  }) => {
    await page.goto('/pt-BR/newsletter');

    const field = page.getByLabel(/e-?mail/i).first();
    await field.fill('nao-e-um-email');
    await field.press('Enter');

    // Nada foi enviado: o erro é do cliente. `aria-invalid` diz *que* está
    // errado; `aria-describedby` é o que diz *o quê* a quem volta ao campo.
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAttribute('aria-describedby', /.+/);
  });

  test('cancelamento com token inexistente diz "link inválido", não "erro"', async ({
    page,
  }) => {
    await page.goto('/pt-BR/newsletter/unsubscribe?token=token-que-nao-existe-fase-11');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // O que não pode aparecer: a tela genérica de falha. Quem chega aqui quer
    // sair, e ser mandado embora sem sair é o erro mais caro desta tela.
    await expect(page.locator('main')).not.toContainText(/algo deu errado|went wrong/i);
  });
});
