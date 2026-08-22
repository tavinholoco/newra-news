import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NewsletterSettings } from '@/components/account/newsletter-settings';
import { alternatesFor } from '@/lib/seo';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({
    locale,
    namespace: 'metadata.newsletterSettings',
  });

  return {
    title: t('title'),
    robots: { index: false, follow: false },
    alternates: alternatesFor(locale, '/account/newsletter'),
  };
}

export default async function NewsletterSettingsPage({
  params: { locale },
}: Props) {
  setRequestLocale(locale);
  const t = await getTranslations('account');

  return (
    <>
      <h1 className='font-display text-h2 font-bold text-ink'>
        {t('newsletter.title')}
      </h1>
      <p className='mt-2 max-w-prose text-body text-ink-secondary'>
        {t('newsletter.description')}
      </p>

      <div className='mt-8'>
        <NewsletterSettings />
      </div>
    </>
  );
}
