export const revalidate = 3600;

export default function NewsDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Notícia</h1>
      <p className="text-gray-500">ID: {params.id}</p>
      {/* TODO: Fetch and display news detail */}
    </main>
  );
}
