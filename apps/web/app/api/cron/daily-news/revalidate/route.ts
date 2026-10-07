import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { DAILY_REVALIDATION_PATHS, revalidateDailyContent } from '@/lib/daily-revalidation';

export const dynamic = 'force-dynamic';

/**
 * **Invalida o conjunto do dia numa invocação própria** — 13.12 do plano de
 * observabilidade, 07/10/2026.
 *
 * Quem chama é o cron (`app/api/cron/daily-news`), depois que o run do dia fecha
 * em `SUCCESS`, e de novo para cada padrão cuja página voltou sem o run. Existe
 * porque o Next só aplica a tag anotada num route handler **quando ele
 * retorna** (`lib/daily-revalidation.ts`): anotada no próprio cron, a
 * invalidação chegaria depois das páginas que ele pede — e as invalidaria de
 * novo. Aqui ela é aplicada assim que esta resposta sai, e o cron pede as
 * páginas em seguida.
 *
 * Não é cron (o Hobby recusa um segundo — armadilha 46): é uma porta que só o
 * cron abre, com o mesmo `CRON_SECRET`. Sem `path`, invalida o conjunto inteiro;
 * com `path` (repetível), só aqueles — e só os do conjunto: a `/news/[id]` fica
 * de fora dele de propósito, e esta porta não abre um caminho até ela.
 */
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const known = DAILY_REVALIDATION_PATHS.map(([path]) => path);
  const asked = new URL(request.url).searchParams.getAll('path');
  if (asked.some((path) => !known.includes(path))) {
    return NextResponse.json({ error: 'Unknown revalidation path' }, { status: 400 });
  }

  const paths = asked.length > 0 ? known.filter((path) => asked.includes(path)) : known;
  revalidateDailyContent(paths);

  return NextResponse.json({ revalidated: paths });
}
