'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function NewsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');

  return (
    <div className='mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 px-4 py-32 sm:px-6 lg:px-8'>
      <h1 className='font-display text-2xl font-bold text-foreground'>
        {t('newsTitle')}
      </h1>
      <p className='text-muted-foreground'>
        {t('newsDesc')}
      </p>
      <Button onClick={reset}>{tCommon('retry')}</Button>
    </div>
  );
}
