'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Category } from '@newranews/types';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * Linha 3 do masthead (§10): a faixa de assuntos, presente em todas as telas.
 *
 * Não confundir com o `category-nav` da Fase 4, que é o controle de **filtro**
 * do acervo dentro de `/news`, com estado selecionado e contagem. Este aqui é
 * navegação: leva para `/news?category=…`, uma URL de verdade que dá para
 * compartilhar e que o buscador enxerga.
 *
 * No mobile vira scroll horizontal — a §10 é explícita em não esconder a
 * categoria atual atrás de menu.
 */
export function EditorialNav({ className }: { className?: string }) {
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onNews = pathname === '/news';
  const current = onNews ? searchParams.get('category') : null;

  const items = [
    { key: null, label: tCommon('all'), href: '/news' },
    ...Object.values(Category).map((category) => ({
      key: category as string,
      label: t(category),
      href: `/news?category=${category}`,
    })),
  ];

  return (
    <nav
      aria-label={tCommon('categories')}
      className={cn('border-b border-line', className)}
    >
      {/* `scrollbar` visível seria ruído numa faixa de 11 itens; o overflow
          continua rolável por toque e por trackpad. */}
      <div className='container-editorial'>
        <ul className='-mx-1 flex items-stretch gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
          {items.map((item) => {
            const active = onNews && current === item.key;
            return (
              <li key={item.key ?? 'all'} className='shrink-0'>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    // A borda inferior é o indicador: sublinhado de seção, não
                    // pílula preenchida — é o que dá cara de editoria (§12).
                    'inline-flex items-center border-b-2 px-3 py-2.5 text-body-sm font-medium transition-colors duration-fast',
                    active
                      ? 'border-brand-accent text-link'
                      : 'border-transparent text-ink-secondary hover:border-line-strong hover:text-link',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
