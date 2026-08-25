import type { NavItem } from '@/lib/constants';

/**
 * Resolve qual link de navegação está ativo para um caminho.
 *
 * Vence o href **mais longo** que casa. Um `startsWith` simples marcaria
 * `/admin` e `/admin/metrics` ao mesmo tempo quando os dois estão no menu — e
 * marcou, até a auditoria da Fase 1 pegar. Com o mais longo vencendo, um item
 * pai continua ativo nas rotas de detalhe (`/article/[date]`) sem competir com
 * um filho que também esteja listado.
 *
 * O caminho recebido é o do `usePathname` do next-intl, ou seja, **sem** o
 * prefixo de locale.
 */
export function resolveActiveHref(
  hrefs: readonly string[],
  pathname: string,
): string | null {
  return hrefs
    .filter((href) =>
      href === '/'
        ? pathname === '/'
        : pathname === href || pathname.startsWith(`${href}/`),
    )
    .reduce<string | null>(
      (longest, href) =>
        longest && longest.length >= href.length ? longest : href,
      null,
    );
}

/**
 * Os links que dependem de quem está logado.
 *
 * **Existe porque a V2 perdeu a aba de admin sem ninguém notar.** Na V1 havia
 * uma `Navbar` só, responsiva, e ela montava estes links a partir da sessão —
 * então eles apareciam nos dois tamanhos de tela. O masthead de três linhas
 * (§10) partiu aquela barra em `Masthead`, que lê a lista **estática** de
 * `NAV_LINKS`, e `MobileNav`, que lê a sessão. Os links de sessão foram só para
 * o segundo, e a partir daí `/admin` era inalcançável por link em qualquer tela
 * de 768 px para cima: a rota respondia, o menu não a citava.
 *
 * Uma função só, consumida pelas duas pontas, é o que impede a terceira ponta
 * de nascer com a mesma lacuna.
 *
 * **`/admin/metrics` não está aqui**, e saiu de propósito: as métricas são uma
 * aba de dentro do painel (`components/admin/admin-nav.tsx`), não um irmão dele
 * no menu do site. Antes eram as duas coisas, e o `resolveActiveHref` existia
 * em parte para desempatar os dois no mesmo menu.
 */
export function sessionNavLinks(
  status: 'loading' | 'authenticated' | 'unauthenticated',
  role: string | null | undefined,
): NavItem[] {
  if (status !== 'authenticated') return [];

  const links: NavItem[] = [
    { href: '/account', key: 'account' },
    { href: '/favorites', key: 'favorites' },
  ];

  if (role === 'ADMIN') links.push({ href: '/admin', key: 'admin' });

  return links;
}
