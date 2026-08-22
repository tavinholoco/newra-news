import {
  PRODUCT_EVENT_BATCH_MAX,
  type ProductEvent,
  type ProductEventPayload,
  type ProductEventType,
} from '@newranews/types';
import { isTrackingAllowed } from './consent';
import { getSessionId } from './session';

export { isTrackingAllowed, readConsent, writeConsent } from './consent';
export type { ConsentDecision } from './consent';
export { sanitizeSearchQuery } from './sanitize';

/** O payload de um tipo, sem o próprio `type` — o que o componente escreve. */
type PayloadArgs<T extends ProductEventType> = Omit<
  Extract<ProductEventPayload, { type: T }>,
  'type'
>;

/**
 * Eventos sem campo próprio (`homepage_view`) não recebem segundo argumento;
 * os demais o exigem. É a diferença entre uma assinatura que documenta o
 * catálogo e uma que aceita `{}` em qualquer lugar.
 */
type TrackArgs<T extends ProductEventType> =
  keyof PayloadArgs<T> extends never ? [] : [payload: PayloadArgs<T>];

/** Onde o lote é despachado: rota do próprio Next, que repassa para a API. */
const ENDPOINT = '/api/events';

/** Espera antes de despachar um lote parcial. */
const FLUSH_DELAY_MS = 5_000;

let queue: ProductEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;

function clearTimer(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/**
 * Despacha o que está na fila.
 *
 * **`sendBeacon` primeiro, `fetch(keepalive)` depois.** O beacon é o único
 * transporte que o navegador promete entregar durante uma navegação — que é
 * exatamente quando os eventos mais interessantes acontecem (o clique que leva
 * a pessoa para outra página). Ele não tem retorno: não dá para saber se
 * chegou, e é um preço aceitável para medição.
 *
 * A fila é esvaziada **antes** do envio. Se o transporte falhar, os eventos se
 * perdem em vez de acumularem: fila que cresce em página com problema vira
 * memória presa e um lote gigante no fim.
 */
function flush(): void {
  clearTimer();
  if (queue.length === 0) return;

  const batch = queue;
  queue = [];

  try {
    const body = JSON.stringify({ events: batch });

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // `application/json` cross-origin exigiria preflight, e **o beacon não
      // sabe fazer preflight** — falharia em silêncio. Por isso o destino é uma
      // rota do próprio Next (same-origin), que repassa para a API.
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }

    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Falha de analytics não pode aparecer para quem está lendo.
    });
  } catch {
    // Idem: `track()` nunca lança.
  }
}

/**
 * Liga os gatilhos de descarga que não dependem de timer.
 *
 * `visibilitychange` → `hidden` é o evento que os navegadores garantem em
 * navegação, troca de aba e bloqueio de tela; `pagehide` cobre o bfcache. O par
 * é o padrão recomendado — `beforeunload` não dispara de forma confiável no
 * mobile e ainda atrapalha o bfcache.
 */
function attachListeners(): void {
  if (listenersAttached || typeof document === 'undefined') return;
  listenersAttached = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

/**
 * Registra um evento de produto.
 *
 * ```ts
 * track('story_open', { storyId, category, position: 0, source: 'hero' });
 * ```
 *
 * Quatro regras, e todas vêm da §2 de `docs/v2/04-analytics-e-slots.md`:
 *
 * 1. **Nunca lança e nunca bloqueia.** Falha de analytics não pode quebrar
 *    navegação — daí o `try` em volta de tudo e o `void` no envio.
 * 2. **Nenhum componente importa provider.** Só `track`. Trocar o destino não
 *    toca em componente nenhum.
 * 3. **Só em client component.** Server component não tem sessão para atribuir,
 *    e o guard de `window` faz a chamada virar no-op se alguém tentar.
 * 4. **Payload é tipado.** O TypeScript recusa evento fora do catálogo e campo
 *    faltando; é a união discriminada de `@newranews/types` que decide.
 *
 * `sessionId`, `locale`, `path` e `occurredAt` são anexados **aqui** — nunca
 * pelo componente, que não deve saber que eles existem.
 */
export function track<T extends ProductEventType>(
  type: T,
  ...args: TrackArgs<T>
): void {
  try {
    if (typeof window === 'undefined') return;
    if (!isTrackingAllowed()) return;

    const sessionId = getSessionId();
    if (!sessionId) return;

    const payload = (args[0] ?? {}) as PayloadArgs<T>;

    queue.push({
      sessionId,
      locale: document.documentElement.lang || 'pt-BR',
      // Sem query string: ela carrega o termo de busca, que tem regra de
      // higiene própria — e a API recusa `path` com `?`.
      path: window.location.pathname,
      occurredAt: new Date().toISOString(),
      type,
      ...payload,
    } as ProductEvent);

    attachListeners();

    if (queue.length >= PRODUCT_EVENT_BATCH_MAX) {
      flush();
      return;
    }

    if (flushTimer === null) {
      flushTimer = setTimeout(flush, FLUSH_DELAY_MS);
    }
  } catch {
    // Ver regra 1.
  }
}

/** Descarga imediata. Existe para os testes e para o `pagehide`. */
export function flushEvents(): void {
  flush();
}

/** Só para os testes: devolve a fila ao estado inicial. */
export function __resetAnalyticsForTests(): void {
  clearTimer();
  queue = [];
  listenersAttached = false;
}
