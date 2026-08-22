'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Menu, X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { resolveActiveHref } from '@/lib/nav';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { MastheadSearch } from '@/components/layout/masthead-search';
import { NAV_LINKS, type NavItem } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Menu do header compacto do mobile (§10).
 *
 * Carrega o que a top-bar mostra só no desktop — idioma, tema, sessão — mais a
 * navegação secundária. As **categorias não entram aqui**: elas ficam na faixa
 * horizontal, que a §10 manda não esconder atrás de menu.
 *
 * O painel é `absolute top-full` dentro do header, e o scrim é irmão dele com
 * a mesma âncora. Nenhum dos dois sabe a altura do header — e é de propósito:
 * o masthead da V2 tem altura diferente do de 64 px da V1, e um `top-16` à mão
 * voltaria a quebrar no próximo ajuste.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);

  const links: NavItem[] = [...NAV_LINKS];
  if (status === 'authenticated') {
    links.push({ href: '/account', key: 'account' });
    links.push({ href: '/favorites', key: 'favorites' });
    if (session?.user?.role === 'ADMIN') {
      links.push({ href: '/admin', key: 'admin' });
      links.push({ href: '/admin/metrics', key: 'metrics' });
    }
  }

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Fecha no Esc: um painel que prende o scroll precisa de saída pelo teclado.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const activeHref = resolveActiveHref(
    links.map((link) => link.href),
    pathname,
  );

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? t('closeMenu') : t('openMenu')}
        aria-expanded={open}
        className='inline-flex items-center justify-center rounded-md p-2 text-ink-secondary transition-colors duration-fast hover:text-link md:hidden'
      >
        {open ? <X className='size-5' /> : <Menu className='size-5' />}
      </button>

      {open ? (
        <>
          <div
            className='absolute inset-x-0 top-full z-overlay h-screen bg-black/30 md:hidden'
            onClick={() => setOpen(false)}
            aria-hidden='true'
          />
          <div className='absolute inset-x-0 top-full z-modal border-b border-line bg-popover shadow-overlay md:hidden'>
            <div className='container-editorial flex flex-col gap-block py-4'>
              <MastheadSearch />

              <nav aria-label={t('secondary')} className='flex flex-col gap-0.5'>
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={link.href === activeHref ? 'page' : undefined}
                    className={cn(
                      'rounded-md px-3 py-2.5 text-body font-medium transition-colors duration-fast',
                      link.href === activeHref
                        ? 'bg-accent text-link'
                        : 'text-ink-secondary hover:bg-surface-accent hover:text-link',
                    )}
                  >
                    {t(link.key)}
                  </Link>
                ))}
              </nav>

              {/* Só idioma e tema: a sessão já está no masthead compacto, ao
                  lado do botão que abriu este menu. */}
              <div className='flex items-center justify-between border-t border-line pt-4'>
                <LocaleSwitcher />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </>
      ) : null}

    </>
  );
}
