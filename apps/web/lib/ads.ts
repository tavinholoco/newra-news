/**
 * Inventário de anúncios da V2 (docs/v2/04-analytics-e-slots.md, parte 2).
 *
 * A §22 do plano é direta: "não deixar para colocar AdSense depois". Espaço
 * de anúncio enfiado num layout pronto empurra conteúdo, muda altura de bloco
 * e destrói o CLS — que é critério de aceite da V2 (§26). Por isso as posições
 * nascem aqui na Fase 3, com altura reservada, **antes** de existir anunciante.
 */

/**
 * **O vocabulário mora em `packages/types`, e a tabela de alturas aqui.**
 * O nome da posição viaja no payload de `ad_view` e a API o valida; a altura é
 * decisão de layout e só o web a usa. Declarados nos dois lugares, um
 * `placement` novo passaria pelo build dos dois e seria recusado em runtime.
 */
export type { AdPlacement, AdFormat } from '@newranews/types';

import type { AdPlacement, AdFormat } from '@newranews/types';

/**
 * Altura reservada por formato, em pixels.
 *
 * É o número que impede o salto de layout: o slot ocupa o espaço antes de o
 * criativo carregar. `leaderboard` reserva a altura do mobile-banner (100px)
 * porque abaixo de `md` ele **vira** um mobile-banner — reservar 90 e crescer
 * para 100 no celular seria o salto que este arquivo existe para evitar.
 */
export const AD_FORMAT_HEIGHT: Record<AdFormat, number> = {
  leaderboard: 90,
  rectangle: 250,
  'in-article': 250,
  'mobile-banner': 100,
};

/**
 * O formato que cada posição assume no mobile (§9). `null` = não muda.
 *
 * Só o leaderboard troca: 728×90 não cabe em 375px de viewport.
 */
export const AD_MOBILE_FORMAT: Partial<Record<AdFormat, AdFormat>> = {
  leaderboard: 'mobile-banner',
};

/**
 * Há inventário para esta posição?
 *
 * Hoje é sempre `false`: não existe anunciante nem provedor configurado, e a
 * §8 manda **não renderizar nada** nesse caso — nem caixa vazia, nem rótulo
 * "Publicidade". O `AdSlot` chama esta função e sai pelo `return null`.
 *
 * Quando o inventário existir, é aqui que a decisão passa a morar (por
 * placement, por consentimento, por geografia) — e nenhum layout muda, porque
 * a altura já estava reservada desde a Fase 3.
 */
export function hasAdInventory(_placement: AdPlacement): boolean {
  return process.env.NEXT_PUBLIC_ADS_ENABLED === 'true';
}
