'use client';

import Image from 'next/image';
import { signOut } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccount } from '@/lib/queries';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatArticleDate } from '@/lib/format';
import { toDateFormatLocale } from '@/lib/i18n';

/**
 * O perfil, **de leitura**.
 *
 * Nome e imagem vêm do provedor de OAuth e são reescritos a cada sign-in
 * (`upsertUser`): um campo editável aqui seria desfeito no login seguinte, sem
 * aviso. Editar o nome pede coluna própria, e é escopo de outra entrega.
 *
 * O que a tela oferece é o que ela consegue cumprir: quem é o leitor, desde
 * quando, quanto ele salvou, e a saída.
 */
export function ProfileCard() {
  const t = useTranslations('account');
  const locale = useLocale();
  const { data, isLoading, isError } = useAccount();

  if (isLoading && !data) {
    return (
      <div className='space-y-4'>
        <Skeleton className='size-16 rounded-full' />
        <Skeleton className='h-5 w-48' />
        <Skeleton className='h-4 w-64' />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p role='alert' className='text-ink-secondary'>
        {t('loadError')}
      </p>
    );
  }

  const { user, saved } = data;

  return (
    <div className='space-y-8'>
      <div className='flex items-center gap-4'>
        {user.image ? (
          <Image
            src={user.image}
            alt=''
            width={64}
            height={64}
            className='size-16 rounded-full object-cover'
          />
        ) : (
          <span
            aria-hidden='true'
            className='flex size-16 items-center justify-center rounded-full bg-surface-accent font-display text-h3 font-bold text-link'
          >
            {(user.name ?? user.email).charAt(0).toUpperCase()}
          </span>
        )}

        <div className='min-w-0'>
          <p className='font-display text-h4 font-bold text-ink'>
            {user.name ?? user.email}
          </p>
          <p className='truncate text-body-sm text-ink-secondary'>{user.email}</p>
          <p className='mt-1 text-meta text-ink-muted'>
            {t('memberSince', {
              date: formatArticleDate(user.createdAt, toDateFormatLocale(locale)),
            })}
          </p>
        </div>
      </div>

      <dl className='grid grid-cols-2 gap-4'>
        <div className='rounded-lg border border-line p-4'>
          <dt className='text-meta uppercase text-ink-muted'>{t('savedNews')}</dt>
          <dd className='mt-1 font-display text-h3 font-bold text-ink tabular-nums'>
            {saved.news}
          </dd>
        </div>
        <div className='rounded-lg border border-line p-4'>
          <dt className='text-meta uppercase text-ink-muted'>{t('savedBriefings')}</dt>
          <dd className='mt-1 font-display text-h3 font-bold text-ink tabular-nums'>
            {saved.articles}
          </dd>
        </div>
      </dl>

      <div className='flex flex-wrap items-center gap-4'>
        <Link
          href='/favorites'
          className='font-display text-body-sm font-semibold text-link hover:text-link-hover'
        >
          {t('goToSaved')}
        </Link>
        <Button variant='outline' onClick={() => void signOut({ callbackUrl: `/${locale}` })}>
          {t('signOut')}
        </Button>
      </div>
    </div>
  );
}
