'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import {
  clearSearchHistory,
  pushSearchTerm,
  readSearchHistory,
  removeSearchTerm,
} from '@/lib/search-history';
import { cn } from '@/lib/utils';

interface NewsSearchProps {
  /** O termo que está na URL. É ele quem manda quando muda por fora. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Pausa de digitação antes de escrever a URL e disparar a consulta. */
const DEBOUNCE_MS = 400;

/**
 * A busca do acervo (§7): termo na URL, histórico local e limpeza explícita.
 *
 * **O campo é controlado por dentro e ressincronizado por fora.** Ele precisa
 * responder a cada tecla sem esperar a viagem até a URL, mas também tem de
 * seguir a URL quando ela muda sozinha — voltar no navegador, clicar num termo
 * do histórico, ou usar a busca do masthead estando já em `/news`. Sem a
 * ressincronização o campo mostra um termo e a lista mostra outra coisa.
 *
 * O histórico só grava quando o termo **vira consulta**, e não a cada tecla:
 * do contrário "copa" deixaria "c", "co" e "cop" para trás.
 */
export function NewsSearch({ value, onChange, className }: NewsSearchProps) {
  const t = useTranslations('common');
  const tNews = useTranslations('news');
  const inputId = useId();

  const [local, setLocal] = useState(value);
  const [history, setHistory] = useState<string[]>([]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // `localStorage` não existe no servidor: ler no efeito mantém o HTML de SSG
  // igual ao da primeira renderização do cliente.
  useEffect(() => setHistory(readSearchHistory()), []);

  // A URL manda. Só reescreve o campo quando ela diverge do que está digitado,
  // senão o próprio debounce devolveria o valor e cancelaria a digitação.
  useEffect(() => {
    setLocal((current) => (current === value ? current : value));
  }, [value]);

  useEffect(() => {
    if (local === value) return;

    const timer = setTimeout(() => {
      onChangeRef.current(local);
      if (local.trim()) setHistory(pushSearchTerm(local));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [local, value]);

  function submit(term: string) {
    setLocal(term);
    onChangeRef.current(term);
    if (term.trim()) setHistory(pushSearchTerm(term));
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <form
        role='search'
        onSubmit={(event) => {
          event.preventDefault();
          submit(local);
        }}
        className='relative'
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
          value={local}
          onChange={(event) => setLocal(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className='h-11 w-full rounded-md border border-line-strong bg-surface pl-9 pr-10 text-body text-ink outline-none transition-colors duration-fast placeholder:text-ink-muted focus-visible:border-focus focus-visible:ring-3 focus-visible:ring-focus/40'
        />
        {local ? (
          <button
            type='button'
            onClick={() => submit('')}
            aria-label={t('clearSearch')}
            className='absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted transition-colors duration-fast hover:text-link'
          >
            <X className='size-4' aria-hidden='true' />
          </button>
        ) : null}
      </form>

      {/* O histórico é atalho, não estado da tela: só aparece quando o campo
          está vazio e há algo a oferecer. Com termo digitado ele competiria
          com o resultado que a pessoa está lendo. */}
      {!local && history.length > 0 ? (
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-meta uppercase tracking-wide text-ink-muted'>
            {tNews('searchHistory')}
          </span>
          {history.map((term) => (
            <span
              key={term}
              className='inline-flex items-center rounded-full border border-line text-body-sm text-ink-secondary'
            >
              <button
                type='button'
                onClick={() => submit(term)}
                className='py-1 pl-3 pr-1.5 transition-colors duration-fast hover:text-link'
              >
                {term}
              </button>
              <button
                type='button'
                onClick={() => setHistory(removeSearchTerm(term))}
                aria-label={tNews('searchHistoryRemove', { term })}
                className='py-1 pl-0.5 pr-2 text-ink-muted transition-colors duration-fast hover:text-link'
              >
                <X className='size-3' aria-hidden='true' />
              </button>
            </span>
          ))}
          <button
            type='button'
            onClick={() => setHistory(clearSearchHistory())}
            className='text-meta font-medium text-link transition-colors duration-fast hover:text-link-hover'
          >
            {tNews('searchHistoryClear')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
