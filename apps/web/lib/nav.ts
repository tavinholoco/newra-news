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
