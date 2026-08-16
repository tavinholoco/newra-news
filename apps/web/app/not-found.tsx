import Link from 'next/link';
import { SearchX, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className='mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 lg:px-8'>
      <SearchX className='mb-6 h-16 w-16 text-muted-foreground/40' />
      <h1 className='font-display mb-3 text-6xl font-bold text-foreground'>
        404
      </h1>
      <p className='font-display mb-2 text-xl font-semibold text-foreground'>
        Página não encontrada
      </p>
      <p className='mb-8 text-muted-foreground'>
        O endereço que você acessou não existe ou foi movido.
      </p>
      <Link
        href='/'
        className='flex items-center gap-2 text-sm font-medium text-brand-600 transition-colors hover:text-brand-400'
      >
        <ArrowLeft className='h-4 w-4' />
        Voltar para a Home
      </Link>
    </div>
  );
}
