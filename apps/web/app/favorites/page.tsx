import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { FavoritesList } from '@/components/favorites/favorites-list';

export const metadata: Metadata = {
  title: 'Favoritos',
  robots: { index: false, follow: false },
};

export default async function FavoritesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/api/auth/signin?callbackUrl=/favorites');
  }

  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      <h1 className='font-display mb-6 text-3xl font-bold text-foreground'>
        Favoritos
      </h1>
      <FavoritesList />
    </div>
  );
}
