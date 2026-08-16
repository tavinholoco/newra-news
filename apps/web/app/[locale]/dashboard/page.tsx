import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getDashboardMetrics } from '@/lib/api';
import { DashboardClient } from '@/components/dashboard/dashboard-client';

export const revalidate = 3600;

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.dashboard' });

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      languages: {
        'pt-BR': '/pt-BR/dashboard',
        en: '/en/dashboard',
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
    },
    twitter: {
      title: t('title'),
      description: t('description'),
    },
  };
}

export default async function DashboardPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('dashboard');
  const initialData = await getDashboardMetrics().catch(() => null);

  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      <div className='mb-8'>
        <h1 className='font-display text-2xl font-bold text-foreground sm:text-3xl'>
          {t('title')}
        </h1>
        <p className='mt-2 text-muted-foreground'>
          {t('pageDescription')}
        </p>
      </div>
      <DashboardClient initialData={initialData} />
    </div>
  );
}
