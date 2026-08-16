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
      "updatedAt": "ISO string"
    }
  ],
  "meta": { "total": 30, "page": 1, "limit": 10, "totalPages": 3 }
}
```

---

### GET /api/articles/latest

Retorna o artigo mais recente.

**Resposta 200:** `{ "data": { ...article } }`  
**Resposta 404:** `{ "error": "Article not found" }`

---

### GET /api/articles/:date

Retorna o artigo de uma data específica.

**Param:** `:date` — formato `YYYY-MM-DD`

**Resposta 200:** `{ "data": { ...article } }`  
**Resposta 404:** `{ "error": "Article not found" }`

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

### GET /api/metrics/dashboard

Retorna um resumo com métricas de hoje, última semana e último mês.

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
