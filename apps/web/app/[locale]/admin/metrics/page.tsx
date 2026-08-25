import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { ProductMetricsClient } from '@/components/dashboard/product-metrics-client';
import { alternatesFor } from '@/lib/seo';

// Sessão + role ADMIN são verificados no layout do segmento (admin/layout.tsx),
// que também declara `dynamic = 'force-dynamic'` e monta a casca — contêiner e
// faixa de abas. Esta página desenha só o conteúdo da aba.
//
// **A seta de voltar saiu daqui.** Ela levava para `/admin` e existia porque
// esta tela era um destino solto atrás do painel; agora as duas são abas da
// mesma casca, e uma seta de voltar para a aba vizinha seria um segundo
// caminho concorrente.

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
  const tProduct = await getTranslations('productMetrics');

  // Sem busca no servidor: as métricas agora exigem JWT com role ADMIN, e o
  // token é assinado pela rota proxy (app/api/admin/metrics). O
  // `DashboardClient` busca pelo proxy e mostra o skeleton enquanto isso —
  // a página é noindex e atrás de sessão, então não há SEO a perder.
  return (
    <>
      <h1 className='font-display text-h2 font-bold text-ink'>{t('title')}</h1>
      <p className='mb-8 mt-2 text-ink-secondary'>{t('pageDescription')}</p>

      <DashboardClient initialData={null} />

      {/* Duas medições diferentes na mesma tela, e a divisória é o que impede
          confundi-las: acima, saúde do pipeline; abaixo, comportamento de
          gente. Uma cai quando a coleta falha; a outra, quando o produto não
          engaja. */}
      <div className='mt-12 border-t border-line pt-8'>
        <h2 className='font-display text-2xl font-bold text-foreground'>
          {tProduct('title')}
        </h2>
        <p className='mb-8 mt-2 text-muted-foreground'>
          {tProduct('pageDescription')}
        </p>
        <ProductMetricsClient />
      </div>
    </>
  );
}
