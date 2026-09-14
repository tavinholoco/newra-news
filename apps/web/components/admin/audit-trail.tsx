'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuditTrail } from '@/lib/queries';
import { formatCount, formatDateTime } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';
import { WindowSelector } from '@/components/dashboard/window-selector';
import { Skeleton } from '@/components/ui/skeleton';

/** As janelas oferecidas. 365 é a retenção do `AuditEvent` — pedir mais é vazio. */
const WINDOWS = [7, 30, 90, 365] as const;

/**
 * O rótulo de cada `action`, com as chaves por extenso: o teste de i18n
 * procura o literal no código, e chave montada em runtime pareceria órfã. O
 * conjunto fechado mora na API (`AUDIT_ACTIONS`, com guarda); uma ação que
 * a tela ainda não conhece sai como veio, em vez de sumir.
 */
const ACTION_KEY: Record<string, string> = {
  'pipeline.triggered': 'security.audit.actionPipelineTriggered',
  'news.deleted': 'security.audit.actionNewsDeleted',
};

/**
 * A trilha de ação de admin (§9 do plano de observabilidade): quem disparou o
 * pipeline, quem apagou o quê — mais recente primeiro.
 *
 * **Só o `actorId` chega, e é o que se mostra.** A tabela não guarda e-mail de
 * propósito (5a); juntar o nome aqui pediria uma segunda consulta por linha
 * para uma tela que um admin abre — e o id, selecionável, é o que se leva ao
 * banco quando a pergunta é feita meses depois.
 *
 * `outcome` separa "clicou" de "aconteceu": o disparo que devolveu
 * `already-succeeded-today` é linha com alvo nulo, e a tela diz isso em vez
 * de fingir que rodou.
 */
export function AuditTrail() {
  const t = useTranslations('admin');
  const locale = toDateFormatLocale(useLocale());
  const [days, setDays] = useState<number>(30);
  const { data, isFetching, isError } = useAuditTrail(days);

  return (
    <section aria-busy={isFetching}>
      <h2 className='font-display mb-1 text-lg font-semibold text-foreground'>
        {t('security.audit.title')}
      </h2>
      <p className='mb-4 text-sm text-muted-foreground'>{t('security.audit.description')}</p>

      <div className='mb-4'>
        <WindowSelector
          options={WINDOWS}
          value={days}
          onChange={setDays}
          optionLabel={(option) => t('security.windowDays', { days: option })}
          label={t('security.audit.windowLabel')}
        />
      </div>

      {isError ? (
        <p role='alert' className='text-sm text-danger'>
          {t('security.audit.loadError')}
        </p>
      ) : !data ? (
        <div className='space-y-3'>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className='h-12 w-full' />
          ))}
        </div>
      ) : data.events.length === 0 ? (
        <p className='text-sm text-muted-foreground'>{t('security.audit.empty')}</p>
      ) : (
        <>
          <ul className='divide-y divide-border overflow-hidden rounded-lg border border-border bg-card'>
            {data.events.map((event) => {
              const actionKey = ACTION_KEY[event.action];
              return (
                <li key={event.id} className='flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3'>
                  <span className='whitespace-nowrap text-sm tabular-nums text-foreground'>
                    {formatDateTime(event.createdAt, locale)}
                  </span>
                  <span className='text-sm font-medium text-ink'>
                    {actionKey ? t(actionKey) : event.action}
                  </span>
                  {event.outcome && (
                    <span className='inline-flex items-center rounded-full border border-line px-2 py-0.5 text-xs uppercase tracking-wider text-ink-secondary'>
                      {event.outcome}
                    </span>
                  )}
                  <span className='basis-full text-xs text-ink-muted sm:basis-auto sm:ml-auto'>
                    {t('security.audit.actor')}{' '}
                    <code className='select-all font-mono text-ink-secondary'>{event.actorId}</code>
                    {event.targetId && (
                      <>
                        {' · '}
                        {t('security.audit.target')}{' '}
                        <code className='select-all font-mono text-ink-secondary'>{event.targetId}</code>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className='mt-2 text-xs text-muted-foreground'>
            {t('security.audit.shown', {
              shown: formatCount(data.events.length, locale),
              total: formatCount(data.total, locale),
            })}
          </p>
        </>
      )}
    </section>
  );
}
