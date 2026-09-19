'use client';

import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/errors/error-state';

export default function ArticleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');

  return (
    <ErrorState
      title={t('articlesTitle')}
      description={t('articlesDesc')}
      retryLabel={tCommon('retry')}
      digestLabel={t('digestLabel')}
      error={error}
      reset={reset}
    />
  );
}
