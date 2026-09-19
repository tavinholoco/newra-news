'use client';

import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/errors/error-state';

/**
 * O boundary do segmento de idioma — o que segura tudo que não tem boundary
 * mais perto. A casca é a `ErrorState` (Fase 7b do plano de observabilidade):
 * desenha o `digest` e reporta pela porta anônima da 7c. As chaves ficam
 * aqui, literais, porque é assim que o `i18n-messages` as encontra.
 */
export default function Error({
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
      title={t('genericTitle')}
      description={t('genericDesc')}
      retryLabel={tCommon('retry')}
      digestLabel={t('digestLabel')}
      error={error}
      reset={reset}
    />
  );
}
