/**
 * Quem pode dizer "não me meça" — e por que é só o navegador.
 *
 * **Não há banner, e não há decisão guardada.** A camada é *cookieless*, não
 * tem identificador entre sessões e não fala com terceiro nenhum: o tratamento
 * se apoia em legítimo interesse (LGPD art. 7º, IX), não em consentimento. Um
 * banner seria interromper a leitura de toda página sem portar decisão nenhuma.
 *
 * Isso deixa o **direito de oposição** com um mecanismo só: o sinal do
 * navegador, que é o padrão para medição anônima de primeira parte. Um controle
 * explícito de opt-out na interface é item em aberto — e só vale a pena se
 * alguém pedir, porque hoje ele duplicaria o que o navegador já oferece.
 *
 * Houve aqui uma máquina de decisão (`granted`/`denied`/`unset`, gravada em
 * `localStorage`) para o banner que a Fase 8 previa. Ela saiu junto com os
 * anúncios em 22/08/2026: sem quem escrevesse a decisão, `readConsent` lia uma
 * chave que ninguém gravava. Histórico no item 29 do `docs/progress.md`.
 */

/**
 * O sinal do navegador de "não me rastreie".
 *
 * `doNotTrack` é o antigo e ainda é o mais difundido; `globalPrivacyControl` é
 * o que a legislação mais recente reconhece. Os dois são respeitados — é
 * justamente o que sustenta o legítimo interesse: quem pediu para não ser
 * medido, não é.
 */
function browserOptedOut(): boolean {
  if (typeof navigator === 'undefined') return false;

  const nav = navigator as Navigator & {
    globalPrivacyControl?: boolean;
    msDoNotTrack?: string;
  };
  const win = typeof window !== 'undefined'
    ? (window as Window & { doNotTrack?: string })
    : undefined;

  if (nav.globalPrivacyControl === true) return true;

  const dnt = nav.doNotTrack ?? win?.doNotTrack ?? nav.msDoNotTrack;
  return dnt === '1' || dnt === 'yes';
}

/** Pode medir? Só não quando o navegador pediu para não medir. */
export function isTrackingAllowed(): boolean {
  return !browserOptedOut();
}
