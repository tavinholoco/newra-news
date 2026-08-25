'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

// As chaves vão escritas por extenso porque o teste de i18n procura o literal
// no código — chave montada em runtime pareceria órfã e a suíte a apagaria.
const ITEMS = [
  { href: '/account', key: 'nav.profile' },
  { href: '/account/preferences', key: 'nav.preferences' },
  { href: '/account/newsletter', key: 'nav.newsletter' },
  { href: '/favorites', key: 'nav.saved' },
] as const;

/**
 * A navegação do ecossistema de conta.
 *
 * "Salvos" fica aqui junto com o resto, mas continua em `/favorites`: a URL
 * está no menu, na baseline visual e em links que já existem por aí. Mudá-la
 * pediria um redirect permanente para ganhar nada.
 *
 * O item ativo é comparado por caminho **exato**, não por prefixo: com prefixo,
 * `/account` ficaria aceso em todas as telas do segmento.
 *
 * **`inline-flex`, e não `inline-block` — a classe de display existe e não
 * funciona neste projeto.** Ver a guarda em `tests/lib/design-tokens.test.ts`:
 * o token `--spacing-block` do `@theme` faz o Tailwind v4 emitir um segundo
 * `.inline-block`, com `inline-size`, que vence a regra de display por ordem
 * no CSS. Os quatro itens mediam 33 px cada, o texto vazava da caixa e as
 * abas apareciam sobrepostas.
 *
 * `shrink-0` no `<li>` pelo mesmo motivo que o `editorial-nav` já tinha:
 * numa faixa rolável, item que encolhe é item que se dobra sobre o vizinho
 * antes de a barra de rolagem aparecer.
 */
export function AccountNav() {
  const t = useTranslations('account');
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
