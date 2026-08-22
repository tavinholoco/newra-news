import type { Category } from './news';

/**
 * O catálogo de eventos de produto (§3 de `docs/v2/04-analytics-e-slots.md`).
 *
 * **Vive aqui e não no web porque a API valida o mesmo vocabulário.** Um
 * `source` novo escrito só de um lado passaria pelo build dos dois e seria
 * rejeitado em runtime, na produção, sem ninguém ver.
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
  'ad_view',
  'ad_click',
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
 * As cinco posições de anúncio da §9 e os quatro formatos.
 *
 * **O vocabulário mora aqui; a tabela de alturas continua em
 * `apps/web/lib/ads.ts`.** A altura é decisão de layout e só o web a usa; o
 * nome da posição, não — ele viaja no payload de `ad_view` e a API o valida.
 */
export const AD_PLACEMENTS = [
  'home-after-hero',
  'home-between-sections',
  'news-list-inline',
  'article-in-content',
  'article-after-content',
] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export const AD_FORMATS = [
  'leaderboard',
  'rectangle',
  'in-article',
  'mobile-banner',
] as const;
export type AdFormat = (typeof AD_FORMATS)[number];

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
  | {
      type: 'article_scroll_25' | 'article_scroll_50' | 'article_scroll_90';
      contentId: string;
      contentType: EventContentType;
    }
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
  | { type: 'ad_view'; placement: AdPlacement; format: AdFormat }
  | { type: 'ad_click'; placement: AdPlacement; format: AdFormat }
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
