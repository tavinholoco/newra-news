import type { Metadata } from 'next';
import { getDashboardMetrics } from '@/lib/api';
import { DashboardClient } from '@/components/dashboard/dashboard-client';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Métricas',
  description:
    'Acompanhe o desempenho do pipeline de notícias e dos artigos gerados por IA.',
  openGraph: {
    title: 'Métricas',
    description:
      'Acompanhe o desempenho do pipeline de notícias e dos artigos gerados por IA.',
  },
  twitter: {
    title: 'Métricas',
    description:
      'Acompanhe o desempenho do pipeline de notícias e dos artigos gerados por IA.',
  },
};

export default async function DashboardPage() {
  const initialData = await getDashboardMetrics().catch(() => null);

  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      <div className='mb-8'>
        <h1 className='font-display text-2xl font-bold text-foreground sm:text-3xl'>
          Dashboard de Métricas
        </h1>
        <p className='mt-2 text-muted-foreground'>
          Desempenho do pipeline diário de notícias e dos artigos gerados por IA.
        </p>
      </div>
      <DashboardClient initialData={initialData} />
    </div>
  );
}
