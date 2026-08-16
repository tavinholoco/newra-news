'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  // Estado inicial neutro ('light') também no primeiro render do cliente para
  // a hidratação não divergir do HTML do servidor (o tema real só existe no
  // cliente, via classe `.dark` aplicada pelo ThemeInit antes do paint).
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = (() => {
      try {
        return localStorage.getItem('theme');
      } catch {
        return null;
      }
    })();
    const systemDark = document.documentElement.classList.contains('dark');
    const initial: 'light' | 'dark' =
      stored === 'dark' || (!stored && systemDark) ? 'dark' : 'light';

    setTheme(initial);
    // Idempotente: ThemeInit já aplicou a classe antes do paint.
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  const isDark = theme === 'dark';

  function handleToggle() {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem('theme', next);
    } catch {
      // localStorage indisponível (ex.: testes) — ignora
    }
  }

  return (
    <button
      type='button'
      onClick={handleToggle}
      className={cn(
        'inline-flex items-center justify-center rounded-lg p-2 text-foreground/70 transition-colors hover:text-brand-600',
        className,
      )}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      aria-pressed={isDark}
      title={isDark ? 'Modo claro' : 'Modo escuro'}
    >
      {isDark ? <Sun className='h-5 w-5' /> : <Moon className='h-5 w-5' />}
    </button>
  );
}
