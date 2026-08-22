import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FavoritesList } from '@/components/favorites/favorites-list';
import { AccountNav } from '@/components/account/account-nav';

// Página protegida (lê a sessão por request) — não pode ser prerenderizada
// como SSG: o redirect() seria "assado" no HTML estático e todos seriam
// redirecionados para o sign-in, mesmo logados (bug visto em dev com cache HIT).
export const dynamic = 'force-dynamic';

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.favorites' });

  return {
    title: t('title'),
    robots: { index: false, follow: false },
    alternates: {
      languages: {
        'pt-BR': '/pt-BR/favorites',
        en: '/en/favorites',
      },
    },
  };
}

/**
 * "Salvos" é a única tela do ecossistema de conta fora do segmento
 * `/account` — a URL veio da V1, está no menu e na baseline visual, e trocá-la
 * pediria um redirect permanente para não ganhar nada. Ela repete a navegação
 * de conta para não parecer outro lugar.
 */
export default async function FavoritesPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('favorites');
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    // Página de sign-in própria (app/[locale]/signin) — o middleware do
    // next-intl adiciona o prefixo de locale e preserva o callbackUrl.
    redirect(`/signin?callbackUrl=/${locale}/favorites`);
  }

  return (
    <div className='container-editorial py-section'>
      <AccountNav />

      <div className='mt-8'>
        <h1 className='font-display text-h2 font-bold text-ink'>{t('title')}</h1>
        <p className='mt-2 max-w-prose text-body text-ink-secondary'>
          {t('description')}
        </p>

        <div className='mt-8'>
          <FavoritesList />
        </div>
      </div>
    </div>
  );
}
