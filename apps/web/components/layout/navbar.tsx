'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Menu, X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { NavLink } from '@/lib/constants';

interface NavbarProps {
  links: readonly NavLink[];
}

interface LocalizedLink {
  href: string;
  label: string;
}

export function Navbar({ links }: NavbarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const t = useTranslations('nav');
  const [mobileOpen, setMobileOpen] = useState(false);

  // Favoritos para autenticados; Admin apenas para role ADMIN
  const extraLinks: Array<{ href: string; key: string }> = [];
  if (status === 'authenticated') {
    extraLinks.push({ href: '/favorites', key: 'favorites' });
    if (session?.user?.role === 'ADMIN') {
      extraLinks.push({ href: '/admin', key: 'admin' });
    }
  }
  const visibleLinks: LocalizedLink[] = [...links, ...extraLinks].map((link) => ({
    href: link.href,
    label: t(link.key),
  }));

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Desktop nav */}
      <nav className='hidden items-center gap-1 md:flex'>
        {visibleLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive(link.href)
                ? 'text-link'
                : 'text-foreground/70 hover:text-link'
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Mobile toggle */}
      <button
        type='button'
        onClick={() => setMobileOpen(!mobileOpen)}
        className='inline-flex items-center justify-center rounded-lg p-2 text-foreground/70 transition-colors hover:text-link md:hidden'
        aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
      </button>

      {/*
        O painel se comporta como folha modal: escurece a página e prende o
        scroll. Daí `z-overlay` no scrim e `z-modal` no painel (§8).

        Hoje os dois nascem dentro do `<header>`, que tem z-index próprio e
        portanto abre um contexto de empilhamento — os valores só valem entre
        si, não contra a página. Funciona, mas a tabela de camadas só passa a
        valer de verdade quando a Fase 2 tirar a navegação mobile de dentro do
        masthead (§23).
      */}
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className='fixed inset-0 top-16 z-overlay bg-black/20 md:hidden'
          onClick={() => setMobileOpen(false)}
          aria-hidden='true'
        />
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className='fixed inset-x-0 top-16 z-modal border-b border-border bg-popover shadow-overlay md:hidden'>
          <nav className='mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4'>
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-lg px-3 py-2.5 text-base font-medium transition-colors',
                  isActive(link.href)
                    ? 'bg-accent text-link'
                    : 'text-foreground/70 hover:bg-surface-accent hover:text-link'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
