'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavLink {
  readonly href: string;
  readonly label: string;
}

interface NavbarProps {
  links: readonly NavLink[];
}

export function Navbar({ links }: NavbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive(link.href)
                ? 'text-brand-600'
                : 'text-foreground/70 hover:text-brand-600'
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
        className='inline-flex items-center justify-center rounded-lg p-2 text-foreground/70 transition-colors hover:text-brand-600 md:hidden'
        aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className='h-5 w-5' /> : <Menu className='h-5 w-5' />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className='fixed inset-0 top-16 z-40 bg-black/20 md:hidden'
          onClick={() => setMobileOpen(false)}
          aria-hidden='true'
        />
      )}

      {/* Mobile menu */}
      <div
        className={cn(
          'fixed inset-x-0 top-16 z-50 border-b border-border bg-white shadow-lg transition-transform duration-200 ease-in-out md:hidden',
          mobileOpen ? 'translate-y-0' : '-translate-y-full pointer-events-none'
        )}
      >
        <nav className='mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4'>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-lg px-3 py-2.5 text-base font-medium transition-colors',
                isActive(link.href)
                  ? 'bg-brand-100 text-brand-600'
                  : 'text-foreground/70 hover:bg-brand-100/50 hover:text-brand-600'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
