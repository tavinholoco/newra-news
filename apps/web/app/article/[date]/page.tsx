export const revalidate = 3600;

export default function ArticlePage({
  params,
}: {
  params: { date: string };
}) {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Artigo do Dia</h1>
      <p className="text-gray-500">Data: {params.date}</p>
      {/* TODO: ArticleView component */}
    </main>
  );
}
