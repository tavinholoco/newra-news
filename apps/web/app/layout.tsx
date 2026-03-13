import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Newra News',
  description: 'Portal de notícias com artigo diário gerado por IA',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='pt-BR' className={cn('font-sans', inter.variable)}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
