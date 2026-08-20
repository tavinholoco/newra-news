'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('locale');
  const router = useRouter();
  const pathname = usePathname();

  function switchTo(next: string) {
    if (next === locale) return;
    // Navega para a mesma página no outro idioma (o prefixo /pt-BR ou /en é
    // aplicado pela API de navegação do next-intl).
    router.replace(pathname, { locale: next });
  }

  return (
    <div
      role='group'
      aria-label={t('label')}
      className='flex items-center overflow-hidden rounded-lg border border-border'
    >
      {routing.locales.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type='button'
            onClick={() => switchTo(option)}
            aria-pressed={active}
            title={t(option === 'pt-BR' ? 'pt' : 'en')}
            className={cn(
              'px-2 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
              active
                ? 'bg-brand-solid text-on-brand'
                : 'bg-background text-foreground/60 hover:text-link',
            )}
          >
            {option === 'pt-BR' ? 'PT' : 'EN'}
          </button>
        );
      })}
    </div>
  );
}
