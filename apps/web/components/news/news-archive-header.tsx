'use client';

import { useTranslations } from 'next-intl';
import type { Category } from '@newranews/types';

interface NewsArchiveHeaderProps {
  /** `null` é o acervo inteiro — o título e a descrição genéricos. */
  category: Category | null;
}

/**
 * Título e descrição curta da tela (§7: "Título da categoria / Descrição
 * curta").
 *
 * **É o mesmo componente no conteúdo e no fallback do Suspense**, com
 * `category` nulo nos dois casos até a URL ser lida. Isso importa porque a
 * `/news` é estática: o HTML pré-renderizado precisa sair com um `h1` de
 * verdade — "Acervo" — e não com um retângulo cinza, que é o que o buscador
 * indexaria. A troca para "Esportes" acontece na hidratação, quando
 * `?category=` fica legível.
 *
 * Os textos por categoria não são SEO decorativo: sem eles a tela abre com oito
 * pílulas e uma lista, e nada diz ao leitor o que aquela editoria cobre.
 */
export function NewsArchiveHeader({ category }: NewsArchiveHeaderProps) {
  const t = useTranslations('news');
  const tCategories = useTranslations('categories');
  const tDescriptions = useTranslations('categoryDescriptions');

  return (
    <header className='border-b border-line-strong pb-6'>
      <h1 className='font-display text-h1 font-bold text-ink'>
        {category ? tCategories(category) : t('archiveTitle')}
      </h1>
      <p className='mt-2 max-w-prose text-body-lg text-ink-secondary'>
        {category ? tDescriptions(category) : t('archiveDescription')}
      </p>
    </header>
  );
}
