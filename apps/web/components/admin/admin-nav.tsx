'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

// As chaves vão escritas por extenso porque o teste de i18n procura o literal
// no código — chave montada em runtime pareceria órfã e a suíte a apagaria.
const ITEMS = [
  { href: '/admin', key: 'nav.panel' },
  { href: '/admin/metrics', key: 'nav.metrics' },
] as const;

/**
 * A navegação do painel de admin.
 *
 * **As métricas sempre estiveram atrás do guard de admin** — desde
 * `feat(web): move the metrics page behind the admin guard`, a rota é
 * `/admin/metrics` e o `admin/layout.tsx` exige sessão com role ADMIN. O que
 * elas não eram é **parte do painel**: a `/admin` tinha um link no canto
 * superior direito, a `/admin/metrics` tinha uma seta de voltar, e as duas
 * telas se citavam sem nunca formarem uma. Com a faixa aqui, a área tem uma
 * casca só e uma tela nova entra como aba em vez de nascer com o seu próprio
 * link no canto.
 *
 * Mesmo padrão do `AccountNav`, incluindo `inline-flex` e `shrink-0`, e pela
 * mesma razão: `inline-block` está sombreado pelo token `--spacing-block` e
 * colapsa a aba para 33 px. Ver a guarda em `tests/lib/design-tokens.test.ts`.
 *
 * O item ativo é comparado por caminho **exato**, não por prefixo: com prefixo,
 * `/admin` ficaria aceso também dentro de `/admin/metrics`.
 */
export function AdminNav() {
  const t = useTranslations('admin');
  const pathname = usePathname();

  return (
    <nav aria-label={t('nav.label')} className='border-b border-line'>
      <ul className='-mb-px flex gap-1 overflow-x-auto'>
        {ITEMS.map((item) => {
          const isActive = pathname === item.href;

          return (
            <li key={item.href} className='shrink-0'>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center whitespace-nowrap border-b-2 px-3 py-2 font-display text-body-sm font-semibold transition-colors duration-base',
                  isActive
                    ? 'border-brand-accent text-link'
                    : 'border-transparent text-ink-secondary hover:text-link',
                )}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
