import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { unsubscribeFromNewsletter } from '@/lib/api';

interface Props {
  params: { locale: string };
  searchParams: { token?: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({
    locale,
    namespace: 'metadata.newsletterUnsubscribe',
  });

  return {
    title: t('title'),
    description: t('description'),
    robots: { index: false, follow: false },
    alternates: {
      languages: {
        'pt-BR': '/pt-BR/newsletter/unsubscribe',
        en: '/en/newsletter/unsubscribe',
      },
    },
  };
}

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('newsletter');
  const tCommon = await getTranslations('common');
  const token = searchParams.token;

  const unsubscribed = token
    ? await unsubscribeFromNewsletter(token).catch(() => ({ unsubscribed: false }))
    : { unsubscribed: false };

  return (
    <div className='mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8'>
      {unsubscribed.unsubscribed ? (
        <>
          <CheckCircle2 className='mb-6 h-16 w-16 text-green-600' />
          <h1 className='font-display mb-3 text-2xl font-bold text-foreground'>
            {t('unsubscribedTitle')}
          </h1>
          <p className='mb-8 text-muted-foreground'>
            {t('unsubscribedDesc')}
          </p>
        </>
      ) : (
        <>
          <XCircle className='mb-6 h-16 w-16 text-destructive/70' />
          <h1 className='font-display mb-3 text-2xl font-bold text-foreground'>
            {t('invalidTitle')}
          </h1>
          <p className='mb-8 text-muted-foreground'>
            {t('invalidDesc')}
          </p>
        </>
      )}
      <Link
        href='/'
        className='flex items-center gap-2 text-sm font-medium text-brand-600 transition-colors hover:text-brand-400'
      >
        <ArrowLeft className='h-4 w-4' />
        {tCommon('backToHome')}
      </Link>
    </div>
  );
}
