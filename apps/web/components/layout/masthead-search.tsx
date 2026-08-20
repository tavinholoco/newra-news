'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

/**
 * Busca do masthead. Não filtra in loco: submete para `/news?search=…`, que é
 * a tela que sabe paginar e mostrar estado vazio.
 *
 * É `<form>` de verdade, com `role="search"` — assim o Enter funciona sem
 * JavaScript de tecla e o leitor de tela encontra a região de busca.
 */
export function MastheadSearch({ className }: { className?: string }) {
  const t = useTranslations('common');
  const router = useRouter();
  const [value, setValue] = useState('');
  // O componente aparece duas vezes no shell: no masthead e dentro do menu
  // mobile. Um `id` fixo daria dois elementos com o mesmo id e dois `<label>`
  // apontando para ele — HTML inválido e associação ambígua.
  const inputId = useId();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = value.trim();
    router.push(term ? `/news?search=${encodeURIComponent(term)}` : '/news');
  }

  return (
    <form
      role='search'
      onSubmit={handleSubmit}
      className={cn('relative', className)}
    >
      <label htmlFor={inputId} className='sr-only'>
        {t('searchPlaceholder')}
      </label>
      <Search
        aria-hidden='true'
        className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted'
      />
      <input
        id={inputId}
        type='search'
        name='search'
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('searchPlaceholder')}
        className='h-9 w-full rounded-md border border-line-strong bg-transparent pl-9 pr-3 text-body-sm text-ink outline-none transition-colors duration-fast placeholder:text-ink-muted focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus/40'
      />
    </form>
  );
}
