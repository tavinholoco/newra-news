import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const jobUrl = process.env.BACKEND_JOB_URL;
  if (!jobUrl) {
    return NextResponse.json(
      { success: false, error: 'BACKEND_JOB_URL not configured' },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(jobUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.BACKEND_JOB_SECRET}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `Backend returned ${response.status}`, detail: errorText },
        { status: 502 },
      );
    }

    const data = await response.json();

    // Pipeline concluído: invalida o cache estático para que o HTML (SSG + ISR)
    // seja regenerado já na próxima visita, sem esperar o revalidate de 3600s.
    // Importante: o cache do Next grava as tags com o padrão literal da rota
    // (ex.: "_N_T_/[locale]/layout") — por isso revalidamos o padrão /[locale],
    // que cobre todas as páginas dos dois idiomas (/, /news, /article,
    // /dashboard...). O sitemap também é revalidado para refletir as novas
    // notícias/artigos imediatamente.
    revalidatePath('/[locale]', 'layout');
    revalidatePath('/sitemap.xml');

    return NextResponse.json({ success: true, data, revalidated: true });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Pipeline trigger failed' },
      { status: 500 },
    );
  }
}
