'use client';

import { Button } from '@/components/ui/button';

export default function ArticleError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className='mx-auto flex max-w-7xl flex-col items-center justify-center gap-4 px-4 py-32 sm:px-6 lg:px-8'>
      <h1 className='font-display text-2xl font-bold text-foreground'>
        Não foi possível carregar os artigos
      </h1>
      <p className='text-muted-foreground'>
        Ocorreu um erro ao buscar os artigos. Por favor, tente novamente.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
