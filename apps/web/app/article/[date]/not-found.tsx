import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';

export default function ArticleNotFound() {
  return (
    <div className='mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8'>
      <FileQuestion className='mb-6 h-16 w-16 text-muted-foreground/40' />
      <h1 className='font-display mb-3 text-2xl font-bold text-foreground'>
        Artigo não encontrado
      </h1>
      <p className='mb-8 text-muted-foreground'>
        Este artigo não existe ou ainda não foi publicado.
      </p>
      <Link
        href='/article'
        className='flex items-center gap-2 text-sm font-medium text-brand-600 transition-colors hover:text-brand-400'
      >
        <ArrowLeft className='h-4 w-4' />
        Ver todos os artigos
      </Link>
    </div>
  );
}
