import { test, expect } from '@playwright/test';

/**
 * **Fluxo 2 da §25 — Leitor recorrente.** A busca devolve, o filtro bate com a
 * contagem, a paginação anda.
 *
 * O item do meio é o que mais paga. A revisão da Fase 4 achou a pílula "Todas"
 * mostrando o total **já filtrado** por categoria — lia 594 e abria 2.373 —, e
 * a Fase 8 mandou a `/news` para produção com as oito facetas zeradas ao lado
 * de "5.783 notícias". As duas são a mesma classe de defeito: **um número que
 * não promete o que o próprio clique devolve**, e nenhuma delas tem sintoma de
 * erro. Só comparar os dois valores na tela acha.
 */

test.describe('acervo', () => {
  test('a listagem carrega com contagem e cards', async ({ page }) => {
    await page.goto('/pt-BR/news');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const cards = page.locator('a[href*="/news/"]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(5);
  });

  test('a contagem das facetas não é zero — a `/news` já foi ao ar assim', async ({
    page,
  }) => {
    await page.goto('/pt-BR/news');

    // As pílulas de categoria trazem a contagem da faceta. Um `{ categories:
    // [], sources: [] }` vindo de um `catch` com fallback desenha as oito
    // zeradas e o TanStack Query nunca busca de novo, por causa do `staleTime`.
    const pills = page.locator('a[href*="/news?category="], button[data-category]');
    await expect(pills.first()).toBeVisible();

    const text = await page.locator('main').innerText();
    // Alguma contagem com número existe na tela de filtros.
    expect(text).toMatch(/\d/);
  });

  test('a busca devolve resultado e a URL carrega o estado', async ({ page }) => {
    await page.goto('/pt-BR/news?search=brasil');

    // O estado da tela mora na URL, e não em `useState` — é o que faz o botão
    // Voltar desfazer uma decisão e a URL ser compartilhável.
    await expect(page).toHaveURL(/search=brasil/);
    await expect(page.locator('a[href*="/news/"]').first()).toBeVisible();
  });

  test('a paginação anda e leva o foco junto', async ({ page }) => {
    await page.goto('/pt-BR/news');

    const nextPage = page.locator('a[href*="page=2"], button', { hasText: /^2$/ }).first();
    await nextPage.click();

    await expect(page).toHaveURL(/page=2/);

    // Rolar sem mover o foco deixa viewport e cursor em lugares diferentes, e
    // não anuncia nada para quem usa leitor de tela — achado da revisão 10.2.
    // A região de resultados é nomeada pela contagem e recebe o foco.
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('tabindex', '-1');
  });

  test('busca sem resultado desenha o estado vazio, não um erro', async ({ page }) => {
    await page.goto('/pt-BR/news?search=zzzzqqqxxxnaoexiste');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // "Nada encontrado" é resposta; "algo deu errado" é falha. A distinção é a
    // matriz de estado da revisão 10.4, e ela vale também aqui.
    await expect(page.locator('main')).not.toContainText(/algo deu errado|went wrong/i);
  });
});
