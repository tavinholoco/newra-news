/**
 * A decisão de consentimento, e quem pode falar por ela.
 *
 * **O banner só chega no PR3, e a camada já nasce lendo a resposta.** Foi
 * decisão tomada com o desenho fechado: a camada é *cookieless*, não tem
 * identificador entre sessões e não fala com terceiro nenhum, então o
 * tratamento se apoia em legítimo interesse (LGPD art. 7º, IX) — não em
 * consentimento. Um banner hoje interromperia a leitura em toda página sem
 * portar decisão nenhuma, que é a mesma armadilha do `AdSlot` renderizar caixa
 * vazia sem inventário.
 *
 * O que muda isso é **anúncio personalizado**, que entra no PR3 — e é lá que o
 * banner nasce. Quando nascer, ele só precisa gravar `granted` ou `denied`
 * aqui: `track()` já obedece.
 */
export type ConsentDecision = 'granted' | 'denied' | 'unset';

export const CONSENT_STORAGE_KEY = 'newra:analytics-consent';

/**
 * Lê a decisão gravada. **Toda leitura é defensiva** — `localStorage` lança em
 * modo privativo e o conteúdo é editável à mão, como o histórico de busca já
 * aprendeu. Valor estranho vira `unset`, nunca exceção.
 */
export function readConsent(): ConsentDecision {
  if (typeof window === 'undefined') return 'unset';

  try {
    const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : 'unset';
  } catch {
    return 'unset';
  }
}

/** Grava a decisão. Quem chama, a partir do PR3, é o banner. */
export function writeConsent(decision: Exclude<ConsentDecision, 'unset'>): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, decision);
  } catch {
    // Modo privativo: a decisão não persiste, e a sessão segue sob o default.
  }
}

/**
 * O sinal do navegador de "não me rastreie".
 *
 * `doNotTrack` é o antigo e ainda é o mais difundido; `globalPrivacyControl` é
 * o que a legislação mais recente reconhece. **Os dois são respeitados mesmo
 * sem banner** — é justamente o que sustenta o legítimo interesse: quem pediu
 * para não ser medido, não é.
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
 * Pode medir?
 *
 * | Estado | Resultado | Por quê |
 * |---|---|---|
 * | `denied` | **não** | a pessoa decidiu, e a decisão vale mesmo antes do banner existir |
 * | DNT / GPC ligado | **não** | pedido explícito do navegador |
 * | `granted` | sim | — |
 * | `unset` | sim | evento anônimo sob legítimo interesse; muda no PR3, com o anúncio |
 *
 * **`unset` permitir é a decisão desta fase, não um descuido.** Ela vale
 * enquanto o único tratamento for este: sem cookie, sem identificador
 * persistente, sem terceiro. Ao ligar anúncio personalizado, `unset` passa a
 * negar — e é uma linha aqui.
 */
export function isTrackingAllowed(): boolean {
  if (browserOptedOut()) return false;
  return readConsent() !== 'denied';
}

/**
 * Pode carregar script de terceiro (rede de anúncio)?
 *
 * **Aqui `unset` nega**, ao contrário de `isTrackingAllowed`. É a diferença
 * entre os dois tratamentos: medição anônima de primeira parte se apoia em
 * legítimo interesse; carregar script que grava cookie e cruza comportamento
 * entre sites exige **consentimento prévio e expresso**. Sem decisão, o script
 * não carrega.
 *
 * Quem chama é o `AdSlot`, e o banner é quem grava a decisão.
 */
export function isThirdPartyAllowed(): boolean {
  if (browserOptedOut()) return false;
  return readConsent() === 'granted';
}
