import Link from 'next/link';

export default function NotFound() {
  return (
    <div className='mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 px-4 py-32 sm:px-6 lg:px-8'>
      <h1 className='font-display text-6xl font-bold text-foreground'>404</h1>
      <p className='text-lg text-muted-foreground'>Página não encontrada</p>
      <Link
        href='/'
        className='text-sm font-medium text-primary hover:text-primary/80'
      >
        Voltar para a Home
      </Link>
    </div>
  );
}
