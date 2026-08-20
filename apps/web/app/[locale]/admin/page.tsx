import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPanel } from '@/components/admin/admin-panel';
import { Link } from '@/i18n/navigation';
import { BarChart3 } from 'lucide-react';

// Sessão + role ADMIN são verificados no layout do segmento (admin/layout.tsx),
// que também declara `dynamic = 'force-dynamic'`.

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.admin' });

  return {
    title: t('title'),
    robots: { index: false, follow: false },
    alternates: {
      languages: {
        'pt-BR': '/pt-BR/admin',
        en: '/en/admin',
      },
    },
  };
}

export default async function AdminPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');
  const tNav = await getTranslations('nav');

  return (
    <div className='mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8'>
      <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
        <h1 className='font-display text-3xl font-bold text-foreground'>
          {t('title')}
        </h1>
        <Link
          href='/admin/metrics'
          className='inline-flex items-center gap-1.5 text-sm font-medium text-link transition-colors hover:text-link-hover'
        >
          <BarChart3 className='size-4' />
          {tNav('metrics')}
        </Link>
      </div>
      <AdminPanel />
    </div>
  );
}
