/**
 * Serializa as datas do artigo para a resposta.
 *
 * Fica em arquivo próprio porque as **três** rotas de artigo precisam dela — a
 * listagem, `/latest` e `/:date` — e uma delas importar da outra acoplaria dois
 * módulos de rota que não têm relação hierárquica.
 *
 * `generatedAt` é o único opcional: é nulo nos artigos anteriores à migration de
 * auditoria, e não havia como preenchê-lo retroativamente.
 */
export function serializeArticle<
  T extends {
    date: Date;
    createdAt: Date;
    updatedAt: Date;
    generatedAt: Date | null;
  },
>(article: T) {
  return {
    ...article,
    date: article.date.toISOString(),
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    generatedAt: article.generatedAt?.toISOString() ?? null,
  };
}
