'use client';

import { useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';
import { useAccount, useUpdateNewsletterSubscription } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * A inscrição na newsletter vista de dentro da conta.
 *
 * Ela **não é uma preferência do usuário** — é a linha de `Subscriber` que o
 * envio diário lê. Por isso mora aqui e não no formulário de preferências:
 * duas fontes de verdade para "quero receber o briefing" discordariam no dia
 * seguinte.
 *
 * Quando o e-mail inscrito não é o do login, a tela **diz qual é**. A
 * inscrição não exige conta, então esse descasamento é normal — e um estado
 * "inscrito" sem explicar por qual endereço é o tipo de coisa que faz alguém se
 * inscrever de novo.
 */
export function NewsletterSettings() {
  const t = useTranslations('account');
  const { data, isLoading, isError } = useAccount();
  const update = useUpdateNewsletterSubscription();

  if (isLoading && !data) {
    return (
      <div className='space-y-3'>
        <Skeleton className='h-4 w-56' />
        <Skeleton className='h-10 w-40' />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p role='alert' className='text-ink-secondary'>
        {t('newsletter.loadError')}
      </p>
    );
  }

  const { newsletter, user } = data;
  const otherEmail =
    newsletter.email !== null &&
    newsletter.email.toLowerCase() !== user.email.toLowerCase();

  return (
    <div className='space-y-6'>
      <div className='flex items-start gap-4 rounded-lg border border-line p-6'>
        <Mail className='mt-0.5 size-5 shrink-0 text-brand-accent' aria-hidden='true' />

        <div className='min-w-0 space-y-2'>
          <p className='font-display text-h4 font-bold text-ink'>
            {newsletter.subscribed
              ? t('newsletter.subscribedTitle')
              : t('newsletter.notSubscribedTitle')}
          </p>
          <p className='max-w-prose text-body-sm text-ink-secondary'>
            {newsletter.subscribed
              ? t('newsletter.subscribedHint', { email: newsletter.email ?? user.email })
              : t('newsletter.notSubscribedHint', { email: user.email })}
          </p>

          {otherEmail ? (
            <p className='max-w-prose text-body-sm text-ink-muted'>
              {t('newsletter.otherEmail')}
            </p>
          ) : null}
        </div>
      </div>

      <div className='flex flex-wrap items-center gap-4'>
        <Button
          variant={newsletter.subscribed ? 'outline' : 'default'}
          disabled={update.isPending}
          onClick={() => update.mutate(!newsletter.subscribed)}
        >
          {newsletter.subscribed
            ? t('newsletter.unsubscribe')
            : t('newsletter.subscribe')}
        </Button>

        {update.isError ? (
          <p role='alert' className='text-body-sm text-danger'>
            {t('newsletter.error')}
          </p>
        ) : null}
      </div>
    </div>
  );
}
