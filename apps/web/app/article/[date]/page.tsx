export const revalidate = 3600;

export default function ArticlePage({
  params,
}: {
  params: { date: string };
}) {
  return (
    <div className='mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'>
      <h1 className='font-display text-3xl font-bold text-foreground'>
        Artigo do Dia
      </h1>
      <p className='text-muted-foreground'>Data: {params.date}</p>
      {/* TODO: ArticleView component */}
    </div>
  );
}
