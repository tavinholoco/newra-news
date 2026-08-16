import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FavoritesList } from '@/components/favorites/favorites-list';

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

export default async function FavoritesPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('favorites');
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    // callbackUrl localizado para voltar à página correta após o sign-in
    redirect(`/api/auth/signin?callbackUrl=/${locale}/favorites`);
  }

  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      <h1 className='font-display mb-6 text-3xl font-bold text-foreground'>
        {t('title')}
      </h1>
      <FavoritesList />
    </div>
  );
}
