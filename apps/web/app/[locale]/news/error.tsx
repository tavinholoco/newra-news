'use client';

import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/errors/error-state';

export default function NewsError({
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
      title={t('newsTitle')}
      description={t('newsDesc')}
      retryLabel={tCommon('retry')}
      digestLabel={t('digestLabel')}
      error={error}
      reset={reset}
    />
  );
}
