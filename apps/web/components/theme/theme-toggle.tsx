'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Moon, Sun } from 'lucide-react';
import { applyThemePreference, readStoredTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('theme');
  // Estado inicial neutro ('light') também no primeiro render do cliente para
  // a hidratação não divergir do HTML do servidor (o tema real só existe no
  // cliente, via classe `.dark` aplicada pelo ThemeInit antes do paint).
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = readStoredTheme();
    const systemDark = document.documentElement.classList.contains('dark');
    const initial: 'light' | 'dark' =
      stored === 'dark' || (!stored && systemDark) ? 'dark' : 'light';

    setTheme(initial);
    // Idempotente: ThemeInit já aplicou a classe antes do paint.
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }, []);

  const isDark = theme === 'dark';

  function handleToggle() {
    // A escrita mora em `lib/theme.ts`, que é o mesmo caminho das preferências
    // da conta — duas cópias da mesma gravação divergiriam no primeiro ajuste.
    setTheme(applyThemePreference(isDark ? 'LIGHT' : 'DARK'));
  }

  return (
    <button
      type='button'
      onClick={handleToggle}
      className={cn(
        'inline-flex items-center justify-center rounded-lg p-2 text-foreground/70 transition-colors hover:text-link',
        className,
      )}
      aria-label={isDark ? t('enableLight') : t('enableDark')}
      aria-pressed={isDark}
      title={isDark ? t('light') : t('dark')}
    >
      {isDark ? <Sun className='h-5 w-5' /> : <Moon className='h-5 w-5' />}
    </button>
  );
}
