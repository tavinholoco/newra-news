import { getTranslations } from 'next-intl/server';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Link } from '@/i18n/navigation';

export default async function ArticleNotFound() {
  const t = await getTranslations('article');

  return (
    <div className='mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8'>
      <FileQuestion className='mb-6 h-16 w-16 text-line-strong' />
      <h1 className='font-display mb-3 text-2xl font-bold text-foreground'>
        {t('notFoundTitle')}
      </h1>
      <p className='mb-8 text-muted-foreground'>
        {t('notFoundDesc')}
      </p>
      <Link
        href='/article'
        className='flex items-center gap-2 text-sm font-medium text-link transition-colors hover:text-link-hover'
      >
        <ArrowLeft className='h-4 w-4' />
        {t('viewAll')}
      </Link>
    </div>
  );
}
