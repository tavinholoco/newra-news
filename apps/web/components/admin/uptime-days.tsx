'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { UptimeSeries } from '@newranews/types';
import { formatCalendarDay } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { ROBOT_STREAK_TRIGGER, robotStreak, uptimeDays } from '@/lib/saturation';
import { SeriesBars } from '@/components/dashboard/series-bars';

/**
 * **As horas desta API por dia — o 13.9 da §23, dobrado no 13b.**
 *
 * O arco mostra a soma do mês; o gatilho do 13.9 é por dia — dois dias
 * inteiros seguidos acima de 10 h, sem deploy nem incidente, é robô em
 * `/news/[id]`, e as saídas são `robots.txt` para os rastreadores de IA e o
 * Bot Protection da Vercel. Até aqui ele só se lia com a credencial do banco
 * de produção, que é a armadilha 39 do plano: gatilho que aponta para um
 * campo que nenhuma tela serve.
 *
 * O alerta é `role='status'`, como o do painel de portões: é conteúdo da
 * página, não interrupção. E é só desta API — a parte dos outros serviços do
 * workspace não tem série por dia (vem da leitura do Billing, de vez em
 * quando).
 */
export function UptimeDays({ series }: { series: UptimeSeries }) {
  const t = useTranslations('admin');
  const locale = toDateFormatLocale(useLocale());
  const days = uptimeDays(series);
  const streak = robotStreak(days);

  return (
    <div className='mt-6 flex flex-col gap-2 border-t border-line pt-4'>
      <h3 className='text-sm font-medium text-ink'>{t('overview.uptimeDays.title')}</h3>
      <p className='max-w-prose text-xs text-muted-foreground'>
        {t('overview.uptimeDays.description')}
      </p>
      <SeriesBars
        label={t('overview.uptimeDays.title')}
        points={days.map((day) => ({
          key: day.date,
          label: formatCalendarDay(day.date, locale),
          value: Math.round(day.hours * 10) / 10,
        }))}
      />
      {streak >= ROBOT_STREAK_TRIGGER && (
        <p role='status' className='text-sm text-danger'>
          {t('overview.uptimeDays.robotAlert', { days: streak })}
        </p>
      )}
    </div>
  );
}
