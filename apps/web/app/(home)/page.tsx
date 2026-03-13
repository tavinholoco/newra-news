export const revalidate = 3600;

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold">Newra News</h1>
      <p className="mt-2 text-gray-600">
        As principais notícias do dia, resumidas por IA.
      </p>
      {/* TODO: NewsGrid component */}
    </main>
  );
}
