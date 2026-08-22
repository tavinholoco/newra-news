import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProfileCard } from '@/components/account/profile-card';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.account' });

  return {
    title: t('title'),
    robots: { index: false, follow: false },
    alternates: {
      languages: {
        'pt-BR': '/pt-BR/account',
        en: '/en/account',
      },
    },
  };
}

export default async function AccountPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  const t = await getTranslations('account');

  return (
    <>
      <h1 className='font-display text-h2 font-bold text-ink'>{t('title')}</h1>
      <p className='mt-2 max-w-prose text-body text-ink-secondary'>
        {t('subtitle')}
      </p>

      <div className='mt-8'>
        <ProfileCard />
      </div>
    </>
  );
}
