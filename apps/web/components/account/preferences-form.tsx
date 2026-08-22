'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Category, type ThemePreference, type UserPreferences } from '@newranews/types';
import { useAccount, useUpdatePreferences } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { applyThemePreference } from '@/lib/theme';
import { cn } from '@/lib/utils';

const CATEGORIES = Object.values(Category);
const THEMES: ThemePreference[] = ['SYSTEM', 'LIGHT', 'DARK'];

// Rótulos por extenso, e não `t(`theme${valor}`)`: o teste de i18n procura o
// literal da chave no código, e chave montada em runtime pareceria órfã.
const THEME_LABEL: Record<ThemePreference, string> = {
  SYSTEM: 'preferences.themeSystem',
  LIGHT: 'preferences.themeLight',
  DARK: 'preferences.themeDark',
};

/**
 * As preferências que a interface consegue honrar (§19 do plano).
 *
 * **Só entram controles que mudam alguma coisa.** "Horário do briefing" não
 * está aqui: o pipeline roda num cron único, e um seletor que o sistema ignora
 * é a mesma promessa quebrada da pílula de contagem da Fase 4. Receber o
 * briefing por e-mail também não — isso é a inscrição da newsletter, que tem
 * tela própria, e dois controles para a mesma resposta discordariam.
 *
 * O tema é aplicado **no momento de salvar**, e não a cada carregamento: o
 * aparelho já guarda a escolha local, e sobrescrevê-la a cada visita desfaria
 * o botão que o leitor acabou de usar no cabeçalho.
 */
export function PreferencesForm() {
  const t = useTranslations('account');
  const tCategories = useTranslations('categories');
  const { data, isLoading, isError } = useAccount();
  const update = useUpdatePreferences();

  const [draft, setDraft] = useState<UserPreferences | null>(null);

  // O rascunho nasce do que veio do servidor, uma vez. Sincronizar a cada
  // render descartaria o clique que o leitor deu enquanto a resposta voltava.
  useEffect(() => {
    if (data && draft === null) setDraft(data.preferences);
  }, [data, draft]);

  if (isLoading && !data) {
    return (
      <div className='space-y-3'>
        <Skeleton className='h-4 w-40' />
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-2/3' />
      </div>
    );
  }

  if (isError || !draft) {
    return (
      <p role='alert' className='text-ink-secondary'>
        {t('preferences.loadError')}
      </p>
    );
  }

  function toggleCategory(category: Category) {
    setDraft((current) => {
      if (!current) return current;
      const selected = current.categories.includes(category)
        ? current.categories.filter((item) => item !== category)
        : [...current.categories, category];

      return { ...current, categories: selected };
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;

    // O tema é aplicado **quando o servidor confirma**, e a partir do que ele
    // devolveu: aplicar antes deixaria a tela escura com a escolha não gravada
    // se o `PUT` falhasse.
    update.mutate(draft, {
      onSuccess: (preferences) => applyThemePreference(preferences.theme),
    });
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-8'>
      <fieldset>
        <legend className='font-display text-h4 font-bold text-ink'>
          {t('preferences.categoriesTitle')}
        </legend>
        <p className='mt-1 max-w-prose text-body-sm text-ink-secondary'>
          {t('preferences.categoriesHint')}
        </p>

        <div className='mt-4 flex flex-wrap gap-2'>
          {CATEGORIES.map((category) => {
            const isSelected = draft.categories.includes(category);

            return (
              <button
                key={category}
                type='button'
                aria-pressed={isSelected}
                onClick={() => toggleCategory(category)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-body-sm transition-colors duration-base',
                  isSelected
                    ? 'border-brand-solid bg-brand-solid text-on-brand'
                    : 'border-line text-ink-secondary hover:border-line-strong hover:text-link',
                )}
              >
                {tCategories(category)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className='font-display text-h4 font-bold text-ink'>
          {t('preferences.themeTitle')}
        </legend>
        <p className='mt-1 max-w-prose text-body-sm text-ink-secondary'>
          {t('preferences.themeHint')}
        </p>

        <div className='mt-4 flex flex-wrap gap-2'>
          {THEMES.map((theme) => (
            <button
              key={theme}
              type='button'
              aria-pressed={draft.theme === theme}
              onClick={() =>
                setDraft((current) => (current ? { ...current, theme } : current))
              }
              className={cn(
                'rounded-md border px-4 py-2 text-body-sm transition-colors duration-base',
                draft.theme === theme
                  ? 'border-brand-solid bg-brand-solid text-on-brand'
                  : 'border-line text-ink-secondary hover:border-line-strong hover:text-link',
              )}
            >
              {t(THEME_LABEL[theme])}
            </button>
          ))}
        </div>
      </fieldset>

      <div className='flex flex-wrap items-center gap-4'>
        <Button type='submit' disabled={update.isPending}>
          {update.isPending ? t('preferences.saving') : t('preferences.save')}
        </Button>

        {update.isSuccess && !update.isPending ? (
          <p role='status' className='text-body-sm text-success'>
            {t('preferences.saved')}
          </p>
        ) : null}

        {update.isError ? (
          <p role='alert' className='text-body-sm text-danger'>
            {t('preferences.saveError')}
          </p>
        ) : null}
      </div>
    </form>
  );
}
