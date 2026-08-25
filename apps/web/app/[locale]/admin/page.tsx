import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPanel } from '@/components/admin/admin-panel';
import { alternatesFor } from '@/lib/seo';

// Sessão + role ADMIN são verificados no layout do segmento (admin/layout.tsx),
// que também declara `dynamic = 'force-dynamic'` e monta a casca — contêiner e
// faixa de abas. Esta página desenha só o conteúdo da aba.
//
// **O link para as métricas saiu daqui.** Ele morava no canto superior direito
// do título, e virou aba: um caminho só para a mesma tela, no mesmo lugar em
// que a próxima vai estar.

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
    alternates: alternatesFor(locale, '/admin'),
  };
}

export default async function AdminPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');

  return (
    <>
      <h1 className='font-display text-h2 font-bold text-ink'>{t('title')}</h1>
      <p className='mt-2 text-ink-secondary'>{t('panelDescription')}</p>
      <div className='mt-8'>
        <AdminPanel />
      </div>
    </>
  );
}
