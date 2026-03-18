export default function Loading() {
  return (
    <div className='mx-auto flex max-w-7xl flex-col items-center justify-center gap-3 px-4 py-32 sm:px-6 lg:px-8'>
      <div className='h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary' />
      <p className='text-sm text-muted-foreground'>Carregando...</p>
    </div>
  );
}
