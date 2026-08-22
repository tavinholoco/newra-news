import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';
import { alternatesFor } from '@/lib/seo';

// Sessão + role ADMIN são verificados no layout do segmento (admin/layout.tsx),
// que também declara `dynamic = 'force-dynamic'`.

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.dashboard' });

  return {
    title: t('title'),
    robots: { index: false, follow: false },
    alternates: alternatesFor(locale, '/admin/metrics'),
  };
}

export default async function AdminMetricsPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('dashboard');
  const tAdmin = await getTranslations('admin');

  // Sem busca no servidor: as métricas agora exigem JWT com role ADMIN, e o
  // token é assinado pela rota proxy (app/api/admin/metrics). O
  // `DashboardClient` busca pelo proxy e mostra o skeleton enquanto isso —
  // a página é noindex e atrás de sessão, então não há SEO a perder.
  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      <div className='mb-8'>
        <Link
          href='/admin'
          className='mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground'
        >
          <ArrowLeft className='size-4' />
          {tAdmin('title')}
        </Link>
        <h1 className='font-display text-2xl font-bold text-foreground sm:text-3xl'>
          {t('title')}
        </h1>
        <p className='mt-2 text-muted-foreground'>
          {t('pageDescription')}
        </p>
      </div>
      <DashboardClient initialData={null} />
    </div>
  );
}
