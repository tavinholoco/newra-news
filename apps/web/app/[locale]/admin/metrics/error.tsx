'use client';

import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/errors/error-state';

/**
 * `layout='inset'`: este boundary renderiza dentro da casca do
 * `admin/layout.tsx`, que já dá o `container-editorial` — o único dos
 * quatro em que um contêiner próprio seria a duplicação da armadilha 11.
 */
export default function DashboardError({
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
      layout='inset'
      title={t('dashboardTitle')}
      description={t('dashboardDesc')}
      retryLabel={tCommon('retry')}
      digestLabel={t('digestLabel')}
      error={error}
      reset={reset}
    />
  );
}
