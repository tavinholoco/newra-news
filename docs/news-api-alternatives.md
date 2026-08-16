# Alternativas à NewsAPI — Pesquisa (2026-08-14)

> Documento de decisão técnica. Contexto: a chave gratuita da NewsAPI foi revogada
> porque o plano Developer **proíbe uso em produção** (ver seção abaixo).

---

## 1. Por que a NewsAPI falhou

Termos de serviço da NewsAPI (newsapi.org/terms):

> "The Developer plan may be used for development and testing in a development
> environment only, and cannot be used in a staging or production environment.
> If the Service has been integrated outside of a development environment,
> license to use the Developer plan **will be revoked** and a paid subscription
> will be required."

O backend roda em produção no Render → a chave foi **revogada automaticamente**.
Evidência em produção: `newsApiTotal: 0` em agosto/2026 (RSS: 3.884 itens).

O plano pago mínimo da NewsAPI custa **US$ 449/mês** — inviável para portfólio.

---

## 2. Comparativo das alternativas (dados de agosto/2026)

| API | Free tier | Artigos/dia (aprox.) | Atraso | Cobertura pt-BR | Uso em produção | Observações |
|---|---|---|---|---|---|---|
| **NewsData.io** ⭐ | 200 créditos/dia (10 artigos/crédito) | ~2.000 | 12h | Sim (multi-idioma, `country=br`) | Permitido (sem proibição no free) | 100k+ fontes, JSON, sentiment analysis. Pago: US$ 199,99/mês |
| **GNews.io** | 100 req/dia (10 artigos/req) | ~1.000 | 12h | Sim (`lang=pt`) | Free = não-comercial (portfólio ok) | 60k+ fontes, 30 dias de histórico. Pago: 1.000 req/dia |
| **Currents API** | 250 req/dia | ~750 | Tempo real* | Parcial | Permitido | Pago a partir de US$ 69/mês |
| **Mediastack** | 500 req/mês | ~16/dia | Tempo real | Sim | Exige atribuição | 7.500+ fontes. Muito baixo para uso diário |
| **Bing News Search (Azure)** | 1.000 transações/mês | ~33/dia | Tempo real | Sim | Permitido | Requer conta Azure + cartão. Baixo para uso diário |
| **RSS feeds** (já usado) | Ilimitado | ~250/dia hoje | Tempo real | Sim (G1, BBC, Folha) | Sem chave, sem risco | Base atual do pipeline; requer classificação por categoria |

\* Currents: fontes divergem sobre atraso; confirmar no cadastro.

---

## 3. Recomendação

**Arquitetura alvo — três camadas, em ordem de prioridade:**

1. **RSS feeds (base, já funciona)** — expandir para 1-2 feeds por categoria
   (economia, esportes, ciência, saúde) + classificador por palavras-chave
   no backend. Custo zero, sem chave, sem risco de revogação.
2. **NewsData.io (API principal)** — melhor free tier do mercado (~2.000
   artigos/dia), cobertura brasileira, sem proibição de produção. Implementar
   como novo provider (`providers/news/newsdata.provider.ts`), reutilizando o
   mesmo `RawNewsItem` e o fallback via `Promise.allSettled` do `news-fetcher`.
3. **GNews.io (fallback)** — caso a NewsData.io falhe ou mude termos.

**Não recomendado:** NewsAPI pago (US$ 449/mês), Mediastack e Bing (free tiers
baixos demais para uso diário).

---

## 4. Migração ✅ Concluída (2026-08-14)

1. ✅ Chave gratuita criada em newsdata.io e adicionada ao `.env` local (gitignorado)
2. ✅ `NEWSDATA_API_KEY` adicionada ao `.env.example`, `render.yaml` e schema do env (opcional)
3. ✅ `newsdata.provider.ts` implementado + testes (`tests/providers/newsdata.provider.test.ts`)
4. ✅ `fetchAll()` do `news-fetcher.service.ts` usa NewsData.io no lugar da NewsAPI
5. ⏳ Pendente: adicionar `NEWSDATA_API_KEY` nas env vars do Render e validar em produção via métricas (`newsApiCount`/`rssCount` no DailyMetric)

---

## 5. Recomendação extra — Endpoint de diagnóstico de providers

Para nunca mais depender de investigação manual (como a deste documento):

- **Endpoint:** `GET /api/health/providers` (protegido com `JOB_SECRET`)
- **Resposta:** `{ newsdata: "ok", gemini: "ok", groq: "ok" }`
- **Implementação:** testar cada chave com uma requisição leve
  (ex.: `GET /v2/top-headlines?pageSize=1`, `GET /v1beta/models`,
  `GET /openai/v1/models`) e reportar status sem expor as chaves
- **Benefício:** status visível de todas as chaves em segundos, direto do navegador
