'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { AuthButton } from '@/components/auth/auth-button';
import { toDateFormatLocale } from '@/lib/i18n';

/**
 * Linha 1 do header (§10): data, edição, newsletter, idioma, entrar.
 *
 * Separa **informação de sistema** da navegação editorial — é o que faz o
 * masthead parecer publicação e não barra de app. Some no mobile, onde a §10
 * pede header compacto; o que ela carrega de essencial (idioma, tema, sessão)
 * reaparece dentro do menu.
 */
export function TopBar() {
  const t = useTranslations('shell');
  const locale = useLocale();

  // A data vem do cliente, depois da hidratação. Renderizá-la no servidor
  // produziria o dia do **servidor**, que pode não ser o do leitor, e o
  // mismatch quebraria a hidratação — o mesmo motivo pelo qual o ThemeToggle
  // começa neutro.
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString(toDateFormatLocale(locale), {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
    );
  }, [locale]);

  return (
    <div className='hidden border-b border-line md:block'>
      <div className='container-editorial flex h-9 items-center justify-between gap-4'>
        <div className='flex items-center gap-3 text-meta text-ink-muted'>
          {/* `min-w` reserva o espaço da data antes de ela existir, para a
              linha não pular ao hidratar (CLS). */}
          <span className='min-w-52 first-letter:uppercase'>{today ?? ''}</span>
          <span aria-hidden='true' className='text-line-strong'>
            ·
          </span>
          <span className='uppercase tracking-wider'>{t('edition')}</span>
        </div>

        <div className='flex items-center gap-1'>
          <Link
            href='/newsletter'
            className='inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-meta font-medium text-ink-secondary transition-colors duration-fast hover:text-link'
          >
            <Mail className='size-3.5' aria-hidden='true' />
            {t('newsletter')}
          </Link>
          <LocaleSwitcher />
          <ThemeToggle />
          <AuthButton />
        </div>
      </div>
    </div>
  );
}
