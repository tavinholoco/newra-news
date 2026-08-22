import type { Category } from './news';

export type ThemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

/**
 * As preferências que a interface consegue honrar hoje (§19 do plano V2).
 *
 * "Horário do briefing" não está aqui de propósito: o pipeline roda num cron
 * único, e oferecer um controle que o sistema não honra é o mesmo erro da
 * pílula de contagem da Fase 4. Receber o briefing por e-mail também não —
 * isso é `Subscriber`, e duas fontes de verdade para a mesma resposta é pior
 * do que uma tela a menos.
 */
export interface UserPreferences {
  categories: Category[];
  theme: ThemePreference;
}

/** Estado da inscrição na newsletter para a tela de conta. */
export interface NewsletterStatus {
  subscribed: boolean;
  /** O e-mail inscrito, que pode não ser o do login. Nulo se não há inscrição. */
  email: string | null;
}

export interface AccountProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}

/** Quantos itens de cada tipo o leitor salvou. */
export interface SavedCounts {
  news: number;
  articles: number;
}

/**
 * Tudo que a tela de conta precisa, numa chamada — o mesmo motivo que fez a
 * Home ter `GET /api/home` em vez de duas requisições que montavam menos
 * página.
 */
export interface AccountOverview {
  user: AccountProfile;
  preferences: UserPreferences;
  newsletter: NewsletterStatus;
  saved: SavedCounts;
}
