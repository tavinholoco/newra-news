import type { Metadata } from 'next';
import { Inter, Bricolage_Grotesque } from 'next/font/google';
import '@/styles/globals.css';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
});

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
    <html lang='pt-BR' className={cn(inter.variable, bricolage.variable)}>
      <body className={cn('font-sans antialiased', inter.className)}>
        <Header />
        <main className='min-h-[calc(100vh-4rem)]'>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
