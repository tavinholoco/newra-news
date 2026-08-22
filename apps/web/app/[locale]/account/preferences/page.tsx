import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PreferencesForm } from '@/components/account/preferences-form';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.preferences' });

  return {
    title: t('title'),
    robots: { index: false, follow: false },
    alternates: {
      languages: {
        'pt-BR': '/pt-BR/account/preferences',
        en: '/en/account/preferences',
      },
    },
  };
}

export default async function PreferencesPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  const t = await getTranslations('account');

  return (
    <>
      <h1 className='font-display text-h2 font-bold text-ink'>
        {t('preferences.title')}
      </h1>
      <p className='mt-2 max-w-prose text-body text-ink-secondary'>
        {t('preferences.description')}
      </p>

      <div className='mt-8'>
        <PreferencesForm />
      </div>
    </>
  );
}
