export const revalidate = 3600;

export default function NewsDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      <h1 className='font-display text-3xl font-bold text-foreground'>
        Notícia
      </h1>
      <p className='text-muted-foreground'>ID: {params.id}</p>
      {/* TODO: Fetch and display news detail */}
    </div>
  );
}
