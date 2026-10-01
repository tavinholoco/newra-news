import { revalidatePath } from 'next/cache';

/**
 * **O que muda quando sai um briefing — e só isso.** Chamado pelos dois crons
 * (`app/api/cron/daily-news` depois do disparo, `app/api/cron/refresh` duas
 * horas depois), e é o mecanismo que mantém as páginas frescas: o `revalidate`
 * de cada página passou a ser de um dia e virou rede de segurança.
 *
 * **Por que isto existe — as horas do Render (01/10/2026).** Toda regeneração
 * da ISR chama a API, e a API dorme com ~15 min sem tráfego no plano free.
 * Com `revalidate = 3600` nas listagens, `900` no news sitemap e o cron
 * invalidando **tudo** sob `/[locale]` a cada dia, qualquer robô que passasse
 * por uma página velha acordava a API — e o acervo tem milhares de matérias.
 * A conta de setembro fechou o caso: 753,4 h no workspace em ~449 h de relógio
 * obrigam **cada um** dos dois serviços do workspace a ter ficado de pé ≥ 68 %
 * do tempo. O conteúdo muda **uma vez por dia**, no pipeline das 11:00 UTC;
 * o resto eram despertares que não traziam nada novo.
 *
 * **Fica de fora, de propósito, a `/news/[id]`.** A matéria não muda depois de
 * coletada, e é a rota com milhares de páginas que os robôs percorrem o dia
 * todo: invalidá-la diariamente era regenerar cada uma que um robô tocasse,
 * uma chamada à API por página. Ela revalida sozinha a cada sete dias (o
 * `revalidate` do arquivo) — o preço é a lista de relacionadas e uma
 * recategorização da etapa 8.5 chegarem à página com até uma semana de atraso.
 *
 * A `/article/[date]` entra: são poucas páginas (uma por dia retido), e uma
 * data pedida antes de o briefing existir fica guardada como "não encontrada"
 * — sem a invalidação, até o `revalidate` vencer.
 *
 * O Next grava as tags com o padrão literal da rota (`_N_T_/[locale]/news/page`),
 * então o padrão cobre os dois idiomas; `'page'` não desce para as filhas.
 */
export const DAILY_REVALIDATION_PATHS: ReadonlyArray<
  readonly [path: string, type?: 'page' | 'layout']
> = [
  ['/[locale]', 'page'],
  ['/[locale]/news', 'page'],
  ['/[locale]/article', 'page'],
  ['/[locale]/article/[date]', 'page'],
  ['/sitemap.xml'],
  ['/news-sitemap.xml'],
];

export function revalidateDailyContent(): void {
  for (const [path, type] of DAILY_REVALIDATION_PATHS) {
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
  }
}
