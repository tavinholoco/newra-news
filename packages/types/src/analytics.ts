import type { Category } from './news';

/**
 * O catálogo de eventos de produto (§3 de `docs/v2/04-analytics-e-slots.md`).
 *
 * **Vive aqui e não no web porque a API valida o mesmo vocabulário.** Um
 * `source` novo escrito só de um lado passaria pelo build dos dois e seria
 * rejeitado em runtime, na produção, sem ninguém ver.
 *
 * **São doze, e eram catorze.** `ad_view` e `ad_click` saíram em 22/08/2026,
 * junto com a decisão de não exibir anúncio no site — evento sem emissor é a
 * mesma armadilha da tabela sem leitor. Histórico no item 29 do
 * `docs/progress.md`.
 */
export const PRODUCT_EVENT_TYPES = [
  'homepage_view',
  'story_open',
  'briefing_open',
  'category_view',
  'search',
  'article_scroll_25',
  'article_scroll_50',
  'article_scroll_90',
  'favorite_add',
  'share',
  'newsletter_signup',
  'subscription_intent',
] as const;

export type ProductEventType = (typeof PRODUCT_EVENT_TYPES)[number];

/** De onde o leitor veio — os doze valores fechados da §3. */
export const EVENT_SOURCES = [
  'hero',
  'briefing',
  'top-stories',
  'trending',
  'category-section',
  'latest',
  'related',
  'search',
  'favorites',
  'footer',
  'newsletter-landing',
  'article-cta',
] as const;

export type EventSource = (typeof EVENT_SOURCES)[number];

export const CONTENT_TYPES = ['story', 'briefing'] as const;
export type EventContentType = (typeof CONTENT_TYPES)[number];

export const SHARE_CHANNELS = [
  'copy-link',
  'whatsapp',
  'x',
  'linkedin',
  'native-share',
] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

/**
 * O que `track()` anexa a todo evento — **nunca o componente**.
 *
 * `sessionId` é aleatório e de sessão: não persiste entre visitas e não
 * identifica pessoa. Não há `userId`, e-mail, IP nem User-Agent aqui, e é a
 * §4 que fecha isso.
 */
export interface ProductEventBase {
  sessionId: string;
  locale: string;
  /** Caminho da rota, sem query string — a query pode carregar busca. */
  path: string;
  /** ISO 8601. Carimbado no cliente; o servidor guarda o seu próprio também. */
  occurredAt: string;
}

/**
 * O payload de cada evento, como união discriminada por `type`.
 *
 * É ela que faz o TypeScript recusar evento inventado ou campo faltando — a
 * regra 4 da §2. Evento sem payload próprio não ganha campo nenhum: um objeto
 * com só `type` é a forma honesta de "não há mais o que dizer".
 */
export type ProductEventPayload =
  | { type: 'homepage_view' }
  | {
      type: 'story_open';
      storyId: string;
      category: Category;
      /** Posição na lista, base 0 — é o que separa CTR de hero de CTR de rodapé. */
      position: number;
      source: EventSource;
    }
  | { type: 'briefing_open'; briefingId: string; date: string; source: EventSource }
  | { type: 'category_view'; category: Category; origin: EventSource }
  | {
      type: 'search';
      /** Já truncado e higienizado por `track()` — ver §4. */
      query: string;
      resultCount: number;
    }
  // Os três limiares são membros separados, e não um `type` em união: o
  // `track(type, payload)` resolve o payload por `Extract<..., { type: T }>`, e
  // um membro cujo `type` já é união não casa com literal nenhum — o helper
  // devolveria `never` e o evento ficaria impossível de disparar.
  | { type: 'article_scroll_25'; contentId: string; contentType: EventContentType }
  | { type: 'article_scroll_50'; contentId: string; contentType: EventContentType }
  | { type: 'article_scroll_90'; contentId: string; contentType: EventContentType }
  | {
      type: 'favorite_add';
      storyId: string;
      category: Category;
      origin: EventSource;
    }
  | {
      type: 'share';
      contentId: string;
      contentType: EventContentType;
      channel: ShareChannel;
    }
  | { type: 'newsletter_signup'; origin: EventSource }
  // Continua sem call site: medir intenção por um plano que não existe seria
  // evento morto. Fica no catálogo para o dia em que o Newra Plus existir.
  | { type: 'subscription_intent'; origin: EventSource; plan: string };

/** Um evento completo, na forma em que viaja para `POST /api/events`. */
export type ProductEvent = ProductEventBase & ProductEventPayload;

/** A resposta do endpoint de ingestão: quantos entraram. */
export interface IngestEventsResult {
  accepted: number;
}

/**
 * Retenção de evento cru, em dias (§4).
 *
 * Quem a executa é a etapa 8 do pipeline diário, junto do cleanup que já
 * existe — não há job manual a lembrar de rodar.
 */
export const PRODUCT_EVENT_RETENTION_DAYS = 90;

/** Teto de eventos por requisição. `track()` enfileira e manda em lote. */
export const PRODUCT_EVENT_BATCH_MAX = 20;

/** Teto do texto de busca antes de sair do navegador (§4). */
export const SEARCH_QUERY_MAX_LENGTH = 100;
