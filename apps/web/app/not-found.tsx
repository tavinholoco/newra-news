import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-lg text-gray-500">Página não encontrada</p>
      <Link href="/" className="text-blue-600 hover:underline">
        Voltar para a Home
      </Link>
    </div>
  );
}
