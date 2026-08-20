import { getTranslations } from 'next-intl/server';
import { SearchX, ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  const tCommon = await getTranslations('common');

  return (
    <div className='mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8'>
      <SearchX className='mb-6 h-16 w-16 text-line-strong' />
      <h1 className='font-display mb-3 text-6xl font-bold text-foreground'>
        404
      </h1>
      <p className='font-display mb-2 text-xl font-semibold text-foreground'>
        {t('title')}
      </p>
      <p className='mb-8 text-muted-foreground'>
        {t('description')}
      </p>
      <Link
        href='/'
        className='flex items-center gap-2 text-sm font-medium text-link transition-colors hover:text-link-hover'
      >
        <ArrowLeft className='h-4 w-4' />
        {tCommon('backToHome')}
      </Link>
    </div>
  );
}
