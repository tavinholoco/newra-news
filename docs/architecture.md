# Arquitetura — Newra News

## Visão Geral

O Newra News segue uma arquitetura cliente-servidor desacoplada:

```
[Usuário] → [Frontend Vercel (Next.js)] → [Backend Render (Fastify)] → [PostgreSQL Neon]
                                              ↕                ↕
                                          [NewsAPI]    [Gemini / Groq]
                                          [RSS Feeds]
```

## Backend — Fastify API (`apps/api/`)

### Estrutura de Diretórios

```
src/
├── app.ts                  # buildApp() — registra plugins e rotas
├── server.ts               # Entry point — start do servidor
├── config/
│   ├── env.ts              # Validação de env vars com Zod
│   ├── ai-prompts.ts       # System e user prompts para geração do artigo
│   └── rss-sources.ts      # Lista de RSS feeds configurados
├── plugins/
│   ├── cors.ts             # @fastify/cors
│   ├── helmet.ts           # @fastify/helmet
│   ├── rate-limit.ts       # @fastify/rate-limit (100 req/min global)
│   └── swagger.ts          # @fastify/swagger + swagger-ui
├── routes/
│   ├── health/             # GET /api/health
│   ├── news/               # GET /api/news, GET /api/news/:id
│   ├── articles/           # GET /api/articles, /latest, /:date
│   ├── jobs/               # POST /api/jobs/daily-pipeline, GET /api/jobs/:pipelineId
│   └── metrics/            # GET /api/metrics/weekly, /monthly, /dashboard
├── services/
│   ├── news.service.ts     # Lógica de listagem/busca de notícias
│   ├── article.service.ts  # Lógica de listagem/busca de artigos
│   ├── pipeline.service.ts # Orquestra o pipeline diário completo (9 etapas)
│   ├── ai.service.ts       # Abstração de IA: Gemini → Groq fallback
│   ├── news-fetcher.service.ts  # Busca NewsAPI + RSS em paralelo
│   └── metrics.service.ts  # Agregações sobre DailyMetric
├── providers/
│   ├── types.ts            # Interfaces compartilhadas (RawNewsItem, GeneratedArticle)
│   ├── news/
│   │   ├── newsapi.provider.ts  # Client da NewsAPI
│   │   └── rss.provider.ts     # Parser de RSS Feeds
│   └── ai/
│       ├── gemini.provider.ts   # Client da Gemini API
│       ├── groq.provider.ts     # Client da Groq API
│       └── ai-utils.ts         # formatNewsItems + parseMarkdownResponse
├── jobs/
│   └── daily-pipeline.job.ts   # Cron job via @fastify/schedule (fallback)
└── utils/
    ├── errors.ts           # AppError, NotFoundError, UnauthorizedError, ValidationError
    ├── logger.ts           # Configuração Pino (pretty em dev, JSON em prod)
    └── schemas.ts          # errorResponseSchema compartilhado
```

### Fluxo de uma Requisição

```
HTTP Request
  → Fastify (rate-limit, cors, helmet)
  → Route Handler (validação Zod via fastify-type-provider-zod)
  → Service (lógica de negócio)
  → Prisma (banco de dados)
  → HTTP Response
```

### Pipeline Diário (9 Etapas)

Disparado por `POST /api/jobs/daily-pipeline` (Bearer token) ou pelo cron job interno:

1. **Coleta** — NewsAPI + RSS em paralelo (`Promise.allSettled`)
2. **Normalização** — Providers padronizam para `RawNewsItem`
3. **Deduplicação** — Por `sourceUrl`
4. **Persistência** — `news.createMany()` no PostgreSQL
5. **Seleção** — Top 15 por data de publicação
6. **Geração IA** — Gemini → Groq (fallback automático)
7. **Persistência do Artigo** — `article.upsert()` por data
8. **Cleanup** — News >30 dias, PipelineLogs >30 dias, Articles >90 dias
9. **Métricas** — `dailyMetric.upsert()` com estatísticas do pipeline

### Política de Retenção

| Tabela | Retenção |
|--------|---------|
| News | 30 dias |
| Article | 90 dias |
| PipelineLog | 30 dias |
| DailyMetric | Indefinida |

## Frontend — Next.js (`apps/web/`)

### Estratégia de Renderização

- **ISR** — Home, listagem de notícias, notícia individual, artigo do dia, histórico
- **SSG** — Páginas estáticas (Sobre, 404)
- **CSR** — Busca em tempo real, filtros dinâmicos

### Vercel Cron Job

`vercel.json` agenda diariamente `GET /api/cron/daily-news`, que chama `POST /api/jobs/daily-pipeline` no backend com Bearer token.

## Banco de Dados — Prisma + PostgreSQL

- **Local:** Docker Compose (PostgreSQL 16)
- **Produção:** Neon Free Tier (500MB, serverless)
- **Migrations:** `pnpm db:migrate`
- **Seed de desenvolvimento:** `pnpm db:seed`

## Packages Compartilhados

| Package | Conteúdo |
|---------|---------|
| `@newranews/database` | Prisma Client singleton + tipos gerados |
| `@newranews/types` | Types TypeScript: News, Article, ApiResponse, PaginatedResponse |
| `@newranews/eslint-config` | Configs ESLint (base, next, node) |
| `@newranews/tsconfig` | TSConfigs base (base, next, node) |
