'use client';

import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface ReadingTimeProps {
  /** Minutos já calculados. Use `readingTimeFromText` quando só houver o corpo. */
  minutes: number;
  /** Esconde o ícone quando a linha de metadata já tem ícones demais. */
  showIcon?: boolean;
  className?: string;
}

/**
 * Tempo de leitura de uma matéria (§11 do plano V2).
 *
 * O campo `readingTimeMinutes` do contrato editorial (§24) ainda não vem da
 * API — ele chega na branch `feat/v2-editorial-api`. Até lá o chamador deriva
 * o valor de `readingTimeFromText`.
 */
export function ReadingTime({
  minutes,
  showIcon = true,
  className,
}: ReadingTimeProps) {
  const t = useTranslations('editorial');
  const safeMinutes = Math.max(1, Math.round(minutes));

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {showIcon ? <Clock className='size-3.5 shrink-0' aria-hidden='true' /> : null}
      {t('readingTime', { minutes: safeMinutes })}
    </span>
  );
}
