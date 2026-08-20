export interface Article {
  id: string;
  title: string;
  content: string;
  summary: string;
  date: string;
  newsCount: number;
  createdAt: string;
  updatedAt: string;
  /** Auditoria da geração (plano V2 §18.4) — nulo nos artigos anteriores à migration. */
  generatedAt: string | null;
  promptVersion: string | null;
  modelVersion: string | null;
  status: ArticleStatus;
}

export enum ArticleStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

/** Notícia que originou o briefing, na ordem em que foi enviada à IA. */
export interface BriefingSource {
  id: string;
  position: number;
  title: string;
  source: string;
  sourceUrl: string;
  /** Ponteiro fraco: nulo quando não resolveu, ou obsoleto após o cleanup de News. */
  newsId: string | null;
}

/** Artigo com a lista de fontes — servido pelos endpoints de detalhe. */
export interface ArticleWithSources extends Article {
  sources: BriefingSource[];
}
