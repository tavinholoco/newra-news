import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SecurityClient } from '@/components/admin/security-client';
import { alternatesFor } from '@/lib/seo';

// Sessão + role ADMIN são verificados no layout do segmento (admin/layout.tsx),
// que também declara `dynamic = 'force-dynamic'` e monta a casca — contêiner e
// faixa de abas. Esta página desenha só o conteúdo da aba.
//
// **A terceira aba do §4.1 do plano de observabilidade**, e a única página nova
// que o plano inteiro abre: "o que quebrou e quem tentou o quê?". Sem
// `loading.tsx` nem `error.tsx` de rota — cada painel desenha o próprio
// esqueleto e o próprio erro, porque os dois carregam em consultas separadas e
// uma fronteira de rota trocaria a tela inteira pelo estado do painel que
// falhou. É a linha da `/admin` na matriz de estados, pelo mesmo motivo.

interface Props {
  params: { locale: string };
}

export async function generateMetadata({
  params: { locale },
}: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'metadata.security' });

  return {
    title: t('title'),
    robots: { index: false, follow: false },
    alternates: alternatesFor(locale, '/admin/security'),
  };
}

export default async function AdminSecurityPage({ params }: Props) {
  const { locale } = params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');

  return (
    <>
      <h1 className='font-display text-h2 font-bold text-ink'>{t('security.title')}</h1>
      <p className='mt-2 text-ink-secondary'>{t('security.pageDescription')}</p>
      <div className='mt-8'>
        <SecurityClient />
      </div>
    </>
  );
}
