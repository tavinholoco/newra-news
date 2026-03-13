import Link from 'next/link';

// TODO: Implement Navbar component
export function Navbar() {
  return (
    <nav className="flex gap-4 px-4 py-2">
      <Link href="/">Home</Link>
      <Link href="/news">Notícias</Link>
      <Link href="/article">Artigos</Link>
      <Link href="/about">Sobre</Link>
    </nav>
  );
}
