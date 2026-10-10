/**
 * Quem pode dizer "não me meça" — e por que é só o navegador.
 *
 * **Não há banner, e não há decisão guardada.** A camada é *cookieless*, não
 * tem identificador entre sessões e não fala com terceiro nenhum: o tratamento
 * se apoia em legítimo interesse (LGPD art. 7º, IX), não em consentimento. Um
 * banner seria interromper a leitura de toda página sem portar decisão nenhuma.
 *
 * (A automação — `navigator.webdriver` — também cala a medição, mas por outro
 * motivo: não é alguém se opondo, é ninguém lendo. Ver `browserAutomated`.)
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

/**
 * O navegador declara que está sob automação.
 *
 * **Não é oposição — é que não há leitor.** Medido em 09/10/2026 (13.4 do
 * plano de observabilidade): o Chromium do Playwright (Smoke E2E, baseline
 * visual, `admin:capture`) expõe `navigator.webdriver === true`, e as
 * ferramentas enchiam a profundidade de leitura — a `/admin/metrics` marcava
 * 1.034 leituras completas contra zero aberturas em 01/10. A regra é do
 * WebDriver (W3C), não uma heurística sobre o user agent, que o Lighthouse
 * troca por um celular emulado.
 *
 * **O Lighthouse CI só expõe o sinal porque o `.lighthouserc.json` passa
 * `--enable-automation`.** O `HeadlessChrome/154` do runner do GitHub não o
 * declara sozinho — medido em produção em 10/10/2026: cada carga da Home pelo
 * Lighthouse virou um `homepage_view`. A medição do 13c tinha sido local.
 *
 * O robô que esconde o sinal continua contado; os nossos não escondem.
 */
function browserAutomated(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.webdriver === true;
}

/**
 * Pode medir? Não quando o navegador pediu para não medir, e não quando quem
 * está do outro lado é uma ferramenta.
 */
export function isTrackingAllowed(): boolean {
  return !browserOptedOut() && !browserAutomated();
}
