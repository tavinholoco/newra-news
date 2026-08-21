# API Guide — Newra News Backend

Base URL (local): `http://localhost:3001/api`  
Documentação interativa: `http://localhost:3001/api/docs`

---

## Notícias

### GET /api/news

Lista notícias com paginação e filtros.

**Query Params:**

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `page` | number | 1 | Página |
| `limit` | number | 20 | Itens por página (máx: 100) |
| `category` | Category | — | Filtro por categoria |
| `search` | string | — | Busca no título/descrição |
| `date` | string (ISO) | — | Filtro por data de publicação |

**Categorias:** `TECHNOLOGY`, `POLITICS`, `ECONOMY`, `SPORTS`, `SCIENCE`, `ENTERTAINMENT`, `WORLD`, `HEALTH`

**Resposta 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string",
      "content": "string | null",
      "source": "string",
      "sourceUrl": "string",
      "imageUrl": "string | null",
      "category": "TECHNOLOGY",
      "publishedAt": "ISO string",
      "createdAt": "ISO string",
      "updatedAt": "ISO string"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

---

### GET /api/news/:id

Retorna uma notícia específica por UUID.

**Resposta 200:**
```json
{ "data": { ...news } }
```

**Resposta 404:**
```json
{ "error": "News not found" }
```

### DELETE /api/news/:id (admin)

Remove uma notícia. Exige `Authorization: Bearer <jwt>` com `role: ADMIN` no
payload (o JWT é assinado pelo frontend com o role vindo da sessão, que segue
`ADMIN_EMAILS`). Usada pelo painel `/admin` do frontend via rota proxy
(`/api/admin/news/:id`).

**Resposta 200:**
```json
{ "data": { "deleted": true, "id": "uuid" } }
```

**Resposta 401:** token ausente ou inválido.  
**Resposta 403:** token válido mas role ≠ `ADMIN`.  
**Resposta 404:** `{ "error": "News not found" }` — notícia inexistente.  
**Resposta 400:** `id` não é UUID válido.

---

## Editorial

Os três endpoints que a Home e as telas de matéria da V2 consomem. Contratos
fechados na Fase 0 em `docs/v2/03-contratos-api.md`.

**São as únicas rotas da API que definem `Cache-Control`**
(`public, s-maxage=300, stale-while-revalidate=3600`). O `s-maxage` vale para o
CDN, não para o browser: a ISR de 3600s da home continua, e os 300s existem para
o `revalidatePath` on-demand do cron surtir efeito em minutos. Nenhuma rota
autenticada recebe o cabeçalho — num proxy compartilhado isso seria vazamento
entre sessões, não otimização.

### GET /api/home

Resposta agregada da Home. Existe porque a Home da V2 tem hero, briefing, top
stories, trending, seções por categoria e newsletter: composta bloco a bloco,
seriam 6+ chamadas em sequência a partir de um Server Component.

| Param | Tipo | Default | Limites |
|---|---|---|---|
| `locale` | `pt-BR` \| `en` | `pt-BR` | reservado; o acervo é único hoje |
| `categories` | number | 4 | 1–8 |

**Nenhuma notícia aparece duas vezes na resposta.** A precedência é
`hero` → `topStories` → `trending` → `categories` → `latest`; um bloco que
perde a disputa continua descendo o próprio ranking até preencher.

**Resposta 200:**
```json
{
  "data": {
    "hero": { "...EditorialStory": "...", "isFeatured": true },
    "briefing": {
      "id": "uuid",
      "date": "2026-08-20",
      "title": "...",
      "summary": "...",
      "sourceCount": 15,
      "readingTimeMinutes": 4,
      "generatedAt": "2026-08-20T08:02:11.000Z",
      "aiDisclosure": true,
      "sources": [{ "id": "uuid", "position": 0, "title": "...", "source": "G1", "sourceUrl": "...", "newsId": null }]
    },
    "topStories": ["...EditorialStory"],
    "trending": ["...EditorialStory com isTrending"],
    "latest": ["...EditorialStory"],
    "categories": [{ "category": "ECONOMY", "stories": ["...EditorialStory"] }]
  }
}
```

Regras que a resposta garante:

- `hero` é a mais recente **com imagem** — a §6.2 quer capa, e cerca de 30% do
  acervo vem de RSS sem imagem. `null` se nenhuma tiver;
- `briefing` é `null` quando o pipeline do dia ainda não rodou. A Home renderiza
  sem ele;
- categorias vazias são **omitidas**, não devolvidas com lista vazia;
- `sourceCount` cai para `newsCount` nos artigos anteriores à migration de
  auditoria, que não têm `sources`.

Sem campo `newsletter`: o bloco é estático (texto + formulário) e não depende de
dado do servidor.

### GET /api/trending

| Param | Tipo | Default | Limites |
|---|---|---|---|
| `limit` | number | 5 | 1–20 |
| `window` | `24h` \| `7d` | `24h` | |

Resposta: `{ data: EditorialStory[] }`, todas com `isTrending: true`.

**Etapa 1.** A §18.2 do plano propõe `recency + clicks + saves + shares`.
Destes, só `saves` existe — é a tabela `Favorite`. Cliques e compartilhamentos
dependem da camada de analytics da §27, que ainda não foi construída.

```
etapa 1 (atual)          score = recência + saves × 2
etapa 2 (após a Fase 8)  score = recência + saves × 2 + clicks × 0,5 + shares × 3
```

A recência decai por meia-vida de 12h: peso 1,0 na publicação, 0,5 doze horas
depois. **O que este endpoint devolve hoje é "recentes mais favoritadas"**, e
está dito assim de propósito — um "trending" cujo critério não está escrito vira
mito.

### GET /api/news/:id/related

| Param | Tipo | Default | Limites |
|---|---|---|---|
| `limit` | number | 4 | 1–12 |

Resposta: `{ data: EditorialStory[] }`. **404** se a notícia base não existir.

Critério, em ordem de precedência: mesma categoria em ±72h → mesma categoria
fora da janela → mais recentes de qualquer categoria. O terceiro nível existe
para uma categoria pouco povoada nunca devolver lista vazia.

Sem embeddings nem busca semântica: o acervo é de notícia diária, a categoria já
é sinal forte, e a §9 pede relacionadas úteis, não relevância de estado da arte.

### EditorialStory

O formato que os três endpoints devolvem — a notícia na perspectiva da
**composição**, não da coleta.

```json
{
  "id": "uuid",
  "title": "...",
  "dek": "a description da News, no vocabulário editorial",
  "imageUrl": null,
  "category": "ECONOMY",
  "source": "G1",
  "sourceUrl": "https://...",
  "publishedAt": "2026-08-20T12:00:00.000Z",
  "updatedAt": "2026-08-20T12:00:00.000Z",
  "readingTimeMinutes": 3,
  "isFeatured": true,
  "isTrending": true
}
```

`readingTimeMinutes` é calculado (200 ppm, do `content` e caindo para o `dek`) e
é `null` quando não há texto — zero seria uma afirmação, e ausência de conteúdo
é outra coisa. `isFeatured` e `isTrending` são **posicionais**, só aparecem
quando verdadeiros, e nenhum dos três é coluna no banco.

---

## Artigos

### GET /api/articles

Lista artigos diários com paginação.

**Query Params:** `page` (default: 1), `limit` (default: 10)

**Resposta 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "summary": "string",
      "content": "string (Markdown)",
      "date": "ISO string",
      "newsCount": 15,
      "createdAt": "ISO string",
      "updatedAt": "ISO string",
      "generatedAt": "ISO string | null",
      "promptVersion": "v1-ebb73b75 | null",
      "modelVersion": "gemini-2.5-flash | null",
      "status": "PUBLISHED"
    }
  ],
  "meta": { "total": 30, "page": 1, "limit": 10, "totalPages": 3 }
}
```

> A listagem **não** traz `sources` — seriam 15 linhas por artigo sem nada as
> exibindo. Elas acompanham só os endpoints de detalhe abaixo.

---

### Campos de auditoria da geração

Presentes em todo artigo (plano V2 §18.4). São **nulos nos artigos publicados
antes da migration `add_daily_briefing_metadata`** — não há como preenchê-los
retroativamente, porque nada registrava quais notícias entraram no briefing.

| Campo | Descrição |
|---|---|
| `generatedAt` | quando a IA gerou o texto (≠ `createdAt`, que é a linha do banco) |
| `promptVersion` | época do prompt + impressão digital do conteúdo (ex.: `v1-ebb73b75`) |
| `modelVersion` | modelo que de fato gerou (ex.: `gemini-2.5-flash`, `openai/gpt-oss-20b`) |
| `status` | `DRAFT` \| `PUBLISHED` \| `FAILED` |

---

### GET /api/articles/latest

Retorna o artigo mais recente, com a lista de fontes.

**Resposta 200:** `{ "data": { ...article, "sources": [...] } }`  
**Resposta 404:** `{ "error": "Article not found" }`

---

### GET /api/articles/:date

Retorna o artigo de uma data específica, com a lista de fontes.

**Param:** `:date` — formato `YYYY-MM-DD`

**Resposta 200:**
```json
{
  "data": {
    "...": "campos do artigo",
    "sources": [
      {
        "id": "uuid",
        "position": 0,
        "title": "string",
        "source": "G1",
        "sourceUrl": "https://...",
        "newsId": "uuid | null"
      }
    ]
  }
}
```

**Resposta 404:** `{ "error": "Article not found" }`

`sources` vem ordenado por `position` — a ordem em que as notícias foram
enviadas à IA. Os campos de exibição são cópias, não joins: o cleanup do
pipeline apaga `News` com mais de 30 dias e o artigo vive 90, então um join
deixaria dois terços dos briefings retidos sem lista de fontes. Por isso
`newsId` é um ponteiro fraco — nulo quando não resolveu, e obsoleto depois que
a notícia é removida.

---

## Jobs

### POST /api/jobs/daily-pipeline

Dispara o pipeline de coleta de notícias e geração do artigo.

**Rate limit:** 20 req/min  
**Header obrigatório:** `Authorization: Bearer <JOB_SECRET>`

O processamento é assíncrono — o endpoint retorna imediatamente com o ID do pipeline.

**Resposta 200:**
```json
{ "status": "started", "pipelineId": "uuid" }
```

**Resposta 401:**
```json
{ "error": "Invalid or missing token" }
```

---

### POST /api/jobs/renormalize-news

Reaplica as regras de ingestão às notícias **já gravadas**: decodifica
entidades, higieniza título e descrição, e reclassifica a categoria — nesta
ordem, porque a classificação lê o texto higienizado.

Existe porque corrigir a ingestão só conserta o que entra daqui pra frente. O
acervo vive 30 dias antes do cleanup, então uma correção nas regras leva um mês
para aparecer inteira sem este job.

**Rate limit:** 20 req/min
**Header obrigatório:** `Authorization: Bearer <JOB_SECRET>`

**Corpo (todos opcionais):**

| Campo | Tipo | Default | Descrição |
|---|---|---|---|
| `dryRun` | boolean | **`true`** | Sem `false` explícito, nada é gravado |
| `limit` | number | — | Teto de linhas examinadas, das mais recentes para as mais antigas |
| `sources` | string[] | fontes sem categoria fixa | Sobrescreve o recorte |

> **`dryRun` é o padrão de propósito.** É mutação em massa de conteúdo
> publicado; a resposta do ensaio traz `transitions` e uma amostra de até 25
> reclassificações justamente para ser lida antes de aplicar.

O recorte padrão são as fontes **sem `category` fixa** em `rss-sources.ts` — as
únicas cuja categoria o classificador decidiu. Fonte especializada (TechCrunch,
InfoMoney, ESPN…) teve a categoria escolhida pela configuração, e recalcular
ali destruiria dado correto.

**Resposta 200:**
```json
{
  "data": {
    "dryRun": true,
    "scanned": 910,
    "textChanged": 255,
    "categoryChanged": 279,
    "transitions": [
      { "from": "POLITICS", "to": "WORLD", "count": 118 },
      { "from": "TECHNOLOGY", "to": "WORLD", "count": 54 }
    ],
    "sample": [
      {
        "id": "uuid",
        "title": "Receita Nosso Campo: aprenda a fazer uma broa de fubá",
        "from": "TECHNOLOGY",
        "to": "WORLD"
      }
    ]
  }
}
```

**Resposta 401:** `{ "error": "Invalid or missing token" }`

**Ensaio, depois aplicação:**
```bash
# 1. ensaio — lê `transitions` e `sample`, não grava nada
curl -X POST "$API/api/jobs/renormalize-news" -H "Authorization: Bearer $JOB_SECRET" -H 'Content-Type: application/json' -d '{}'

# 2. aplicação — só depois de conferir a amostra acima
curl -X POST "$API/api/jobs/renormalize-news" -H "Authorization: Bearer $JOB_SECRET" -H 'Content-Type: application/json' -d '{"dryRun": false}'
```

É idempotente: a segunda execução sobre o mesmo acervo relata zero mudanças.

---

### GET /api/jobs/:pipelineId

Consulta o status de execução de um pipeline.

**Resposta 200:**
```json
{
  "data": {
    "id": "uuid",
    "status": "RUNNING | SUCCESS | FAILED",
    "newsCount": 42,
    "articleId": "uuid | null",
    "error": "string | null",
    "startedAt": "ISO string",
    "completedAt": "ISO string | null"
  }
}
```

**Resposta 404:** `{ "error": "Pipeline not found" }`

---

## Métricas

### GET /api/metrics/weekly

Retorna métricas agregadas dos últimos 7 dias.

**Query Params:** `date` (opcional, `YYYY-MM-DD`) — data de referência (default: hoje)

**Resposta 200:**
```json
{
  "data": {
    "period": { "start": "ISO string", "end": "ISO string" },
    "totalDays": 7,
    "avgNewsPerDay": 45.3,
    "totalArticlesGenerated": 6,
    "pipelineSuccessRate": 0.857,
    "avgPipelineDuration": 12000,
    "newsByCategory": { "TECHNOLOGY": 90, "WORLD": 60 },
    "aiProviderUsage": { "gemini": 5, "groq": 1 }
  }
}
```

---

### GET /api/metrics/monthly

Retorna métricas do mês completo.

**Query Params:** `month` (opcional, `YYYY-MM`) — default: mês atual

**Resposta 200:**
```json
{
  "data": {
    "period": { "month": "2024-01" },
    "totalNewsCollected": 1400,
    "totalArticlesGenerated": 29,
    "avgNewsPerDay": 45.2,
    "topCategories": [{ "category": "TECHNOLOGY", "count": 350 }],
    "failureDays": 2,
    "newsApiTotal": 700,
    "rssTotal": 700
  }
}
```

---

### GET /api/metrics/dashboard (admin)

Retorna um resumo com métricas de hoje, última semana e último mês.

**Era pública até 20/08/2026.** Passou a exigir `Authorization: Bearer <jwt>`
com `role: ADMIN` no payload — mesmo desenho de `DELETE /api/news/:id`. Métrica
de pipeline é dado operacional, e a página que a consome saiu de
`/[locale]/dashboard` para `/[locale]/admin/metrics`; o browser chega aqui pela
rota proxy `/api/admin/metrics`, que lê a sessão e assina o token server-side.

`GET /api/metrics/weekly` e `/monthly` seguem públicas.

**Resposta 401:** token ausente ou inválido.
**Resposta 403:** `{ "error": "Admin access required" }` — autenticado sem role
ADMIN.

**Resposta 200:**
```json
{
  "data": {
    "today": {
      "newsCollected": 50,
      "articleGenerated": true,
      "aiProvider": "gemini",
      "pipelineDuration": 11000,
      "pipelineErrors": 0
    },
    "lastWeek": { ...weeklyMetrics },
    "lastMonth": {
      "totalNewsCollected": 1400,
      "totalArticlesGenerated": 29,
      "avgNewsPerDay": 45.2,
      "failureDays": 2
    }
  }
}
```

---

## Saúde

### GET /api/health

Healthcheck do servidor (usado pelo UptimeRobot).

**Resposta 200:**
```json
{ "status": "ok", "timestamp": "ISO string", "uptime": 3600.5 }
```

### GET /api/health/providers

Diagnóstico de chaves dos providers (NewsData.io, Gemini e Groq). Faz uma requisição leve ao vivo contra cada API e reporta apenas o status — as chaves nunca são expostas na resposta.

**Auth:** `Authorization: Bearer <JOB_SECRET>`

**Rate limit:** 10 req/min (além do limite global de 100 req/min).

**Resposta 200:**
```json
{
  "newsdata": "ok",
  "gemini": "ok",
  "groq": "ok"
}
```

**Status possíveis por provider:**

| Status | Significado |
|--------|------------|
| `ok` | Chave válida, API respondendo |
| `invalid` | Chave inválida, erro HTTP ou timeout |
| `not_configured` | Chave não configurada no ambiente (ex.: `NEWSDATA_API_KEY` ausente) |

**Resposta 401:** token ausente ou inválido.

---

## Newsletter

### POST /api/newsletter/subscribe

Inscreve um e-mail na newsletter do artigo diário. Idempotente: se o e-mail já está ativo, retorna o assinante existente; se estava cancelado, **reativa**.

**Body:** `{ "email": "assinante@example.com" }`

**Rate limit:** 5 req/min (além do limite global).

**Resposta 200:**
```json
{
  "data": {
    "id": "uuid",
    "email": "assinante@example.com",
    "status": "ACTIVE",
    "createdAt": "ISO string",
    "updatedAt": "ISO string"
  }
}
```

**Resposta 400:** e-mail inválido ou body ausente.

### GET /api/newsletter/unsubscribe

Cancela a assinatura via token (link presente no rodapé de cada e-mail). Não requer autenticação — o token UUID é o segredo.

**Query:** `?token=<uuid>`

**Resposta 200:**
```json
{ "data": { "unsubscribed": true } }
```

`unsubscribed: false` quando o token é desconhecido ou a assinatura já está cancelada.

**Resposta 400:** token ausente.

### POST /api/newsletter/send

Dispara manualmente o envio da newsletter do dia (idempotente — um envio por dia via `NewsletterLog`). O pipeline já chama isso internamente após gerar o artigo; este endpoint serve para reprocessamento manual após falha.

**Auth:** `Authorization: Bearer <JOB_SECRET>`

**Rate limit:** 10 req/min.

**Resposta 200:**
```json
{ "data": { "total": 12, "sent": 11, "failed": 1 } }
```

> Sem `RESEND_API_KEY` o envio é pulado (contado como `failed`) — o pipeline não quebra.

**Resposta 401:** token ausente ou inválido.

---

## Favoritos

> Requer autenticação: `Authorization: Bearer <jwt>` — JWT assinado pelo frontend com o `AUTH_JWT_SECRET` compartilhado (ver plano de auth). O `sub` do token identifica o usuário.

### GET /api/favorites

Lista as notícias favoritas do usuário (mais recentes primeiro) com a notícia embutida.

**Query Params:** `page` (default: 1), `limit` (default: 20, máx: 100)

**Resposta 200:**
```json
{
  "data": [
    {
      "id": "uuid (do favorito)",
      "newsId": "uuid",
      "createdAt": "ISO string",
      "news": { ...news }
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20, "totalPages": 1 }
}
```

### POST /api/favorites

Adiciona uma notícia aos favoritos. **Idempotente**: favoritar de novo retorna o mesmo favorito (200).

**Body:** `{ "newsId": "uuid" }`

**Resposta 200:**
```json
{
  "data": { "id": "uuid", "userId": "uuid", "newsId": "uuid", "createdAt": "ISO string" }
}
```

**Resposta 404:** `{ "error": "News not found" }` — notícia inexistente.

### DELETE /api/favorites/:newsId

Remove uma notícia dos favoritos do usuário.

**Resposta 200:** `{ "data": { "removed": true } }`  
**Resposta 404:** `{ "error": "Favorite not found" }` — favorito não existia.

**Resposta 401 (todas):** token ausente ou inválido.

---

## Observabilidade (dev-only)

> Painel de logs e erros do pipeline, **apenas para o dev** — todas as rotas
> exigem `Authorization: Bearer <JOB_SECRET>` (ou `?secret=` na página HTML) e
> têm rate limit próprio. Não são expostas ao público.

### GET /api/dev/logs

Últimos runs do pipeline + erros recentes, com filtros opcionais.

**Auth:** `Authorization: Bearer <JOB_SECRET>`  
**Rate limit:** 60 req/min  
**Query Params:**

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `status` | `RUNNING \| SUCCESS \| FAILED` | — | Filtro por status |
| `since` | number (dias) | — | Apenas runs iniciados nos últimos N dias (1–90) |
| `limit` | number | 30 | Máx. de runs retornados (1–100) |

**Resposta 200:**
```json
{
  "data": {
    "runs": [
      {
        "id": "uuid",
        "status": "SUCCESS",
        "newsCount": 42,
        "articleId": "uuid | null",
        "error": "string | null",
        "errorStage": 6,
        "errorDetail": { "message": "Gemini API error 500: boom", "provider": "gemini", "statusCode": 500 },
        "startedAt": "ISO string",
        "completedAt": "ISO string | null",
        "durationSeconds": 90,
        "eventCount": 5
      }
    ],
    "recentErrors": [ ...runs com status FAILED ]
  },
  "meta": { "total": 31 }
}
```

### GET /api/dev/logs/:pipelineId

Detalhe completo de um run: log resumido + **eventos por etapa** (Stage 1–9,
nível INFO/WARN/ERROR, mensagem e contexto JSON).

**Auth:** `Authorization: Bearer <JOB_SECRET>`  
**Rate limit:** 60 req/min

**Resposta 200:**
```json
{
  "data": {
    "log": { ...resumo igual ao de /api/dev/logs },
    "events": [
      {
        "id": "uuid",
        "stage": 6,
        "level": "ERROR",
        "message": "Gemini API error 500: boom",
        "context": { "provider": "gemini", "statusCode": 500 },
        "createdAt": "ISO string"
      }
    ]
  }
}
```

**Resposta 404:** `{ "error": "Pipeline not found" }`  
**Resposta 400:** `pipelineId` não é UUID válido.

### GET /dev/dashboard

Página HTML auto-contida servida pela API (auto-refresh a cada 30s): histórico
de runs (status, duração, contagens, etapa da falha, erro), erros recentes e
status dos providers (mesma checagem do `GET /api/health/providers`).

**Auth:** `Authorization: Bearer <JOB_SECRET>` **ou** `?secret=<JOB_SECRET>`
(para abrir direto no browser).  
**Rate limit:** 60 req/min

**Resposta 200:** `Content-Type: text/html`  
**Resposta 401:** secret ausente ou inválido.

---

## Erros

Todos os erros seguem o formato:
```json
{ "error": "Mensagem descritiva do erro" }
```

| Código | Situação |
|--------|---------|
| 400 | Validação falhou (query param ou body inválido) |
| 401 | Token ausente ou inválido |
| 404 | Recurso não encontrado |
| 429 | Rate limit excedido |
| 500 | Erro interno do servidor |
