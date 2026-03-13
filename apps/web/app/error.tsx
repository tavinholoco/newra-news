'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Algo deu errado</h1>
      <p className="text-gray-500">{error.message}</p>
      <button
        onClick={reset}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Tentar novamente
      </button>
    </div>
  );
}
