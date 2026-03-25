import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export default function NewsNotFound() {
  return (
    <div className='mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8'>
      <FileQuestion className='mb-6 h-16 w-16 text-muted-foreground/40' />
      <h1 className='font-display mb-3 text-2xl font-bold text-foreground'>
        Notícia não encontrada
      </h1>
      <p className='mb-8 text-muted-foreground'>
        Esta notícia não existe ou foi removida.
      </p>
      <Link
        href='/news'
        className='flex items-center gap-2 text-sm font-medium text-brand-600 transition-colors hover:text-brand-900'
      >
        <ArrowLeft className='h-4 w-4' />
        Ver todas as notícias
      </Link>
    </div>
  );
}
