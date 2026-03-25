import type { Metadata } from 'next';
import { Inter, Bricolage_Grotesque } from 'next/font/google';
import '@/styles/globals.css';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Providers } from './providers';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='pt-BR' className={cn(inter.variable, bricolage.variable)}>
      <body className={cn('font-sans antialiased', inter.className)}>
        <Providers>
          <Header />
          <main className='min-h-[calc(100vh-4rem)]'>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
