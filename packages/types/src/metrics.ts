export interface WeeklyMetrics {
  period: { start: string; end: string };
  totalDays: number;
  avgNewsPerDay: number;
  totalArticlesGenerated: number;
  pipelineSuccessRate: number;
  avgPipelineDuration: number | null;
  newsByCategory: Record<string, number>;
  aiProviderUsage: Record<string, number>;
}

export interface MonthlyMetricsSummary {
  totalNewsCollected: number;
  totalArticlesGenerated: number;
  avgNewsPerDay: number;
  failureDays: number;
}

export interface DashboardToday {
  newsCollected: number;
  articleGenerated: boolean;
  aiProvider: string | null;
  pipelineDuration: number | null;
  pipelineErrors: number;
}

export interface DashboardMetrics {
  today: DashboardToday | null;
  lastWeek: WeeklyMetrics;
  lastMonth: MonthlyMetricsSummary;
}

/**
 * Métricas de **produto** — comportamento de gente, não saúde de máquina.
 *
 * O `DashboardMetrics` acima mede o pipeline (notícias coletadas, artigo gerado,
 * duração, erros). Este lê o `ProductEvent`, e existe porque até agora a camada
 * de analytics gravava e **ninguém lia**.
 */
export interface ProductMetrics {
  period: { start: string; end: string; days: number };
  /**
   * O bloco que responde "dá para vender patrocínio?".
   *
   * **`sessions` não é gente recorrente, e não dá para saber quem volta.** O
   * `sessionId` vive em `sessionStorage` e morre ao fechar a aba — é justamente
   * isso que mantém a medição anônima. Quem mede audiência **recorrente** são os
   * dois números persistentes ao lado: assinante e conta.
   */
  audience: {
    /** Sessões distintas na janela — volume de visita, não de pessoas. */
    sessions: number;
    /** Assinantes ativos. É o número que um patrocinador pede. */
    newsletterSubscribers: number;
    /** Contas criadas. Quem loga volta por definição. */
    accounts: number;
  };
  byDay: Array<{ date: string; sessions: number; events: number }>;
  byType: Array<{ type: string; count: number }>;
  /** CTR por origem: separa o hero do rodapé. */
  storyOpensBySource: Array<{ source: string; count: number }>;
  categoryViews: Array<{ category: string; count: number }>;
  /** Aberto × lido. `scroll90 / opened` é a taxa de leitura completa. */
  readingDepth: {
    opened: number;
    scroll25: number;
    scroll50: number;
    scroll90: number;
  };
  /** Busca sem resultado — o que o acervo não cobre. */
  searchesWithoutResults: Array<{ query: string; count: number }>;
}
