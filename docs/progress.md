# Progresso do Projeto — Newra News

> Este arquivo é a fonte de verdade do progresso de desenvolvimento.
> Atualizar ao concluir cada milestone. Referenciar o commit correspondente.

---

## Fase Atual

**Fase 5 — Polish e Portfólio** ⏳ Pendente

> Fases 1–4 concluídas. Pipeline validado em produção: 89 artigos em 90 dias (17/mai → 14/ago), 1 gap, 0 falhas no último mês.
> NewsAPI substituída pela NewsData.io — provider ativo em produção desde 2026-08-16: 3 chaves ok (NewsData/Gemini/Groq), 8 categorias preenchidas, 491 notícias/dia.

---

## Plano de Ação — Continuar o Desenvolvimento (atualizado 2026-08-16)

> Checklist vivo do que falta. Marcar `[x]` ao concluir (referenciar commit).

### 1. Publicar o provider NewsData.io ✅

- [x] Merge dev → main + deploy no Render — main em `0bbe811` (2026-08-16), deploy automático confirmado (endpoint novo `/api/health/providers` respondendo)
- [x] Confirmar boot com `NEWSDATA_API_KEY` — validado: `GET /api/health/providers` → `{ newsdata: "ok", gemini: "ok", groq: "ok" }`

> Correção incluída neste item: provider NewsData agora trata `source_name` ausente (fallback para `source_id`/`Unknown source`) e remove o placeholder `ONLY AVAILABLE IN PAID PLANS` do tier free — commit `0bbe811`. Sem isso o `prisma.news.createMany` falhava (`Argument source is missing`) e o pipeline abortava.

### 2. Validar NewsData em produção (comparar com RSS) ✅

- [x] Dashboard após execução (2026-08-16, pipeline `06fbe642`): 491 notícias, artigo gerado (Gemini), 26,5s, 0 erros; mensal: `newsApiCount` 67 vs `rssCount` 4321 e `newsByCategory` com **as 8 categorias preenchidas** (WORLD 3484, TECHNOLOGY 345, ECONOMY 128, HEALTH 98, SCIENCE 61, SPORTS 57, POLITICS 40, ENTERTAINMENT 17)
- [x] Qualidade: pt-BR, sem duplicatas (dedup por URL no pipeline), imagens presentes. Observação: o tier free da NewsData tem ruído de bucket (alguns artigos chegam em categoria não-condizente, ex.: notícia de eleição no bucket technology) — aceitável para portfólio; possível refino futuro no pipeline

### 3. Endpoint de diagnóstico de chaves ✅

- [x] `GET /api/health/providers` (protegido com `JOB_SECRET`) testando ao vivo NewsData, Gemini e Groq — resposta `{ newsdata: "ok"|"invalid", gemini: "...", groq: "..." }`
- [x] Testes Vitest (26 novos: service + rota) + documentação em `docs/api.md`

### 4. Classificador de categorias RSS ✅

- [x] Classificação por palavras-chave (título/descrição → Category) para feeds sem categoria (hoje 4 de 5 caem em WORLD) — `services/category-classifier.service.ts`, peso 2 no título / 1 na descrição, sem acentos, fallback WORLD
- [x] Expandir `rss-sources.ts` com feeds especializados (economia: InfoMoney, Valor; esportes: ESPN Brasil, Trivela; ciência: Olhar Digital, Superinteressante; saúde: Veja Saúde, Drauzio Varella — URLs verificadas como RSS válido)
- [x] Testes do classificador (14 unit) + integração no provider RSS (16 testes novos no total)

### 5. Medição (critérios de sucesso do PRD §18) ✅

- [x] Cobertura de testes do backend >70% — medido 2026-08-16: 94,33% linhas / 91,91% statements / 94,73% funções / 94,33% branches; threshold 70 em `apps/api/vitest.config.ts` + passo `test:coverage` no CI (`ci.yml`, `turbo test:coverage`)
- [x] Lighthouse >90 — auditado contra produção 2026-08-16 (mobile, via Lighthouse real): **Performance 96 · Accessibility 96 · Best Practices 96 · SEO 100**; `.lighthouserc.json` + workflow `lighthouse.yml` (semanal + manual) falham se qualquer categoria < 90

### 6. Documentação (Fase 5)

- [ ] `docs/setup.md` (stub `TODO`)
- [ ] Diagramas Mermaid (4 stubs `%% TODO` em `docs/diagrams/`)
- [ ] README final com screenshots

### 7. Polish UI/UX (Fase 5)

- [ ] Dark mode
- [ ] Animações e micro-interações
- [ ] Testes no frontend (hoje zero)

### 8. Pós-MVP (depois do core polido)

- [ ] Dashboard de métricas no frontend (a API `/api/metrics/*` já existe pronta)
- [ ] Newsletter com o artigo diário
- [ ] Autenticação/favoritos, i18n, painel admin

### 9. Dashboard de logs e erros do pipeline (dev-only) — Observabilidade

> Contexto: hoje, diagnosticar falhas da pipeline exige caçar `console.warn/error`
> não estruturados no painel do Render ou consultar endpoints isolados
> (`/api/jobs/:pipelineId`, `/api/health/providers`). Este item centraliza logs e erros
> num painel privado do dev.
> **Não conflita com o item 8:** lá é um dashboard **público de métricas de negócio** no
> frontend (portfólio); aqui é **observabilidade** (logs e erros da pipeline) no backend,
> protegida por `JOB_SECRET` e sem exposição ao público.

- [ ] Modelo `PipelineEvent` no Prisma: registra cada evento da pipeline (pipelineLogId, Stage 1–9, nível info/warn/error, mensagem, contexto JSON, createdAt) — substitui os `console.warn/error` soltos
- [ ] Enriquecer `PipelineLog`: etapa da falha (Stage N) + erro estruturado (mensagem, provider, status HTTP) — hoje `error` é uma string única
- [ ] Endpoints protegidos com `JOB_SECRET` (prefixo `/api/dev`): `GET /api/dev/logs` (últimos runs + erros recentes, filtros status/intervalo) e `GET /api/dev/logs/:pipelineId` (detalhe completo com eventos por etapa)
- [ ] Página HTML servida pela API em `/dev/dashboard` (protegida + rate limit): histórico de runs (status, duração, contagens, erro), erros recentes e status dos providers (reusa `GET /api/health/providers` do item 3)
- [ ] Testes Vitest + documentação em `docs/api.md`

---

## Fase 1 — Setup e Infraestrutura ✅ Concluída em 2026-03-13

### Checklist do PRD (seção 17)

- [x] Monorepo Turborepo + pnpm workspaces
- [x] Packages compartilhados: `@newranews/database`, `@newranews/types`, `@newranews/eslint-config`, `@newranews/tsconfig`
- [x] Docker Compose — PostgreSQL 16 + pgAdmin 4 (`docker-compose.yml`)
- [x] Backend Fastify com TypeScript — `apps/api/src/server.ts` + `app.ts`
- [x] Prisma com schema inicial — 4 models (News, Article, PipelineLog, DailyMetric), 2 enums (Category, PipelineStatus)
- [x] Next.js 14 (App Router) com Tailwind CSS
- [x] shadcn/ui instalado e configurado (New York style, Zinc color, CSS variables)
- [x] Componentes base shadcn/ui: Button, Card, Badge, Input, Skeleton
- [x] ESLint + Prettier em todo o monorepo
- [x] Vitest no backend — `vitest.config.ts` + `tests/setup.ts` + stubs de teste
- [x] CI no GitHub Actions — pipeline lint → test → build com serviço PostgreSQL
- [x] Node.js 22 LTS alinhado em todo o projeto

### Commits desta fase

| Commit | Descrição |
|--------|-----------|
| `98d710c` | chore: initial monorepo scaffolding |
| `6e9e47b` | chore: upgrade Node.js from 20 to 22 LTS |
| `669e9d3` | fix(ci): force Node.js 24 runtime for GitHub Actions |
| `7a42e15` | fix(ci): upgrade checkout and setup-node to v5 for native Node.js 24 support |
| `5f60cbb` | chore: align Node.js config with 22 LTS target |
| `a8cd95e` | feat(web): add shadcn/ui completing Phase 1 setup |

### Decisões técnicas desta fase

- **Node.js 22 LTS** como target — `engines`, `.nvmrc`, `@types/node ^22.0.0`, Dockerfile `node:22-alpine`
- **CI actions v5** (`actions/checkout@v5`, `actions/setup-node@v5`) — elimina warnings de deprecação do Node 20
- **shadcn/ui New York style, Zinc** — mantido padrão; Geist font removida (indisponível no Next.js 14.2), substituída por Inter com `--font-sans`
- **Prisma migrations** — diretório criado mas vazio; primeira migration será gerada ao subir o banco pela primeira vez
- **Stubs de teste** — `apps/api/tests/` tem estrutura pronta; implementação real começa na Fase 2

---

## Fase 2 — Backend Core ✅ Concluída em 2026-03-16

> Referência: PRD seção 17 — "Fase 2 — Backend Core (Semana 3-4)"

### Checklist do PRD

- [x] Configurar plugins Fastify: cors, helmet, rate-limit, swagger
- [x] Implementar `GET /api/health`
- [x] Implementar `GET /api/news` (listagem paginada + filtro por categoria)
- [x] Implementar `GET /api/news/:id`
- [x] Implementar `GET /api/articles`
- [x] Implementar `GET /api/articles/latest`
- [x] Implementar `GET /api/articles/:date`
- [x] Implementar `POST /api/jobs/daily-pipeline` (Bearer token auth)
- [x] Implementar provider NewsAPI (`src/providers/newsapi.provider.ts`)
- [x] Implementar provider RSS (`src/providers/rss.provider.ts`)
- [x] Implementar provider Gemini AI (`src/providers/gemini.provider.ts`)
- [x] Implementar provider Groq AI fallback (`src/providers/groq.provider.ts`)
- [x] Implementar pipeline service completo (9 estágios)
- [x] Configurar cron job com `@fastify/schedule` (trigger diário)
- [x] Escrever testes para todos os services e rotas
- [x] Validar todas as rotas com Zod schemas

### Refatorações pós-fase 2 ✅ Concluídas em 2026-03-17

- [x] Cleanup de artigos >90 dias adicionado ao Stage 8 do pipeline (PRD 3.4)
- [x] Rate limit restritivo na rota `/api/jobs/daily-pipeline` (20 req/min vs 100 global)
- [x] Implementar `GET /api/jobs/:pipelineId` — status de execução do pipeline
- [x] Implementar `GET /api/metrics/weekly`, `/monthly`, `/dashboard` — 3 endpoints de métricas
- [x] Providers reestruturados em `providers/news/` (NewsAPI, RSS) e `providers/ai/` (Gemini, Groq, ai-utils)
- [x] `packages/database/prisma/seed.ts` — seed com dados realistas para todas as categorias
- [x] `docs/architecture.md` e `docs/api.md` preenchidos com documentação real
- [x] Testes atualizados: 131 testes em 16 suites

### Arquitetura de referência (apps/api/CLAUDE.md)

```
src/
├── routes/          # Uma rota por arquivo + schema Zod adjacente
├── services/        # Lógica de negócio (sem dependência do Fastify)
├── providers/
│   ├── news/        # NewsAPI, RSS
│   └── ai/          # Gemini, Groq
├── plugins/         # Registro de plugins Fastify
└── utils/          # errors.ts (erros customizados), schemas.ts (schemas Zod compartilhados)
```

---

## Fase 3 — Frontend Core ✅ Concluída em 2026-03-25

> Referência: PRD seção 17 — "Fase 3 — Frontend Core (Semana 5-6)"

### Commits desta fase

| Commit | Descrição |
|--------|-----------|
| `d84001a` | feat(web): implement global layout with header, navbar, and footer |
| `bb591c5` | feat(web): implement home page with news feed and daily article hero (#30) |
| `a5b727d` | fix(web): upgrade to Tailwind CSS v4 and fix missing styles |
| `8f8f393` | feat(web): implement /news page with ISR, filters, search, and pagination (#31) |
| `ccf6b5d` | fix(web): fix CI build failure and address code review issues in /news page |
| `1d4632c` | fix(api): improve error message when .env file is missing |
| `c59a752` | feat(web): implement /news/[id] individual news page with ISR (#32) |
| `7301248` | fix(web): remove dead prose classes and add aria labels to news placeholders |
| `5c859ee` | feat(web): implement /article and /article/[date] pages with ISR (#33, #34) |
| `f4d6258` | feat(web): implement /about page and enhance global 404 (#36) |
| `36765fa` | feat(web): configure TanStack Query with hooks and refactor client components (#37) |
| `3ebf0fb` | fix: resolve inconsistencies from recent commits code review |
| `58be12b` | feat(web): implement SEO — metadata, Open Graph, sitemap, robots (#38) |
| `ae2c7e3` | feat(web): mobile-first responsiveness improvements (#39) |
| `9e0c2b3` | fix(web): mobile menu covering header on small viewports |
| `c9b7bda` | fix(web): replace undefined brand-700 hover color and sanitize error output |

### Auditoria final pré-Fase 4 ✅

Auditoria completa realizada em 2026-03-25 antes de iniciar Fase 4:

- **Checklist PRD:** 11/11 itens verificados e completos
- **Integração frontend ↔ backend:** 5/5 endpoints compatíveis, tipos compartilhados via `@newranews/types`
- **Bugs corrigidos:** `hover:text-brand-700` (cor inexistente no tema) → `hover:text-brand-900` em 4 arquivos; `error.tsx` sanitizado para não expor `error.message` em produção
- **Build:** lint 0 erros, build limpo (10 rotas)

### Decisões técnicas desta fase

- **Tailwind CSS v4** — upgrade de v3 para v4 (CSS-first config, `@theme inline`, `@import "tailwindcss"`) para compatibilidade com shadcn v4 base-nova style e suporte a opacity modifiers com CSS variables hex
- **ISR com revalidate: 3600** — home page revalida server-side a cada hora
- **Fontes:** Bricolage Grotesque (`--font-display`) para headings, Inter (`--font-sans`) para body via next/font/google
- **`lib/format.ts`** — `CATEGORY_LABELS`, `formatDate()`, `formatArticleDate()` e `toDateSlug()` extraídos para uso compartilhado entre componentes de news e article
- **`generateMetadata()`** — introduzido em `/news/[id]` e `/article/[date]`; título dinâmico + Open Graph tags
- **`ArticleHistoryCard`** — card compacto para grid de artigos (distinto do hero `ArticleCard` da home)
- **`/about` SSG** — página estática sem data fetching; evitou uso de Badge/Card (shadcn base-ui hooks) em favor de elementos nativos compatíveis com server components SSG
- **404 global** — melhorado com ícone `SearchX`, hierarquia visual e descrição, alinhado ao padrão de `/news/[id]/not-found.tsx`
- **TanStack Query v5** — `QueryClientProvider` em `app/providers.tsx`, hooks em `lib/queries.ts` com query key factories hierárquicas; `staleTime: 5min`, `gcTime: 10min`, `refetchOnWindowFocus: false`; `keepPreviousData` para paginação sem flash; client components refatorados de 5-7 useState + fetch manual para `useQuery` hooks
- **SEO completo** — `lib/seo.ts` com constantes centrais (`SITE_URL`, `SITE_NAME`, `SITE_DESCRIPTION`); `metadataBase` + `title.template` no root layout; `generateMetadata()` + OG + Twitter tags em todas as páginas; `opengraph-image.tsx` com `ImageResponse` (edge runtime, 1200×630); `sitemap.ts` (ISR 1h, rotas estáticas + news + artigos, graceful fallback se API indisponível); `robots.ts`; `NEXT_PUBLIC_SITE_URL` env var
- **Responsividade mobile-first** — touch targets: `Input` `h-8→h-9`, botões de paginação `size='lg'`, botão X de busca com `p-1` + `aria-label`; tipografia: `text-2xl sm:text-3xl` nos h1 de listagem; `break-words` em divs de conteúdo de notícia/artigo para evitar overflow horizontal com URLs longas

### Checklist do PRD

- [x] Implementar layout global (header, footer, navbar)
- [x] Página `/` — Home com feed de notícias (ISR)
- [x] Página `/news` — Listagem de notícias (ISR + CSR para filtros)
- [x] Página `/news/[id]` — Notícia individual (ISR)
- [x] Página `/article` — Histórico de artigos (ISR)
- [x] Página `/article/[date]` — Artigo do dia (ISR)
- [x] Implementar busca e filtros por categoria
- [x] Página `/about` e página 404 (SSG)
- [x] Configurar TanStack Query — `QueryClientProvider` + hooks em `lib/queries.ts`
- [x] SEO: `generateMetadata()`, Open Graph tags, sitemap auto-gerado
- [x] Responsividade mobile-first

---

## Fase 4 — Integração e Deploy ✅ Concluída em 2026-08-14

> Referência: PRD seção 17 — "Fase 4 — Integração e Deploy (Semana 7-8)"

### Commits desta fase

| Commit | Descrição |
|--------|-----------|
| `601c1f6` | feat(web): harden Vercel cron route and adjust schedule to BRT timezone |
| `3992903` | feat(web): prepare monorepo for Vercel deployment |
| `bcf997b` | feat(api): prepare backend for Render deployment |
| `287eef5` | fix(api): resolve Prisma type resolution in pnpm monorepo |
| `2ce1f2f` | fix(api): truncate and sanitize news content in AI prompt |
| `cc8c2c5` | fix(api): also truncate description field in AI prompt |
| `cf83180` | fix(api): migrate Gemini provider from deprecated 1.5-flash to 2.5-flash |
| `b231841` | fix: decode HTML entities in news pipeline and handle broken images |
| `e0703fe` | fix(api): handle ISO-8859-1 encoding and extract media images in RSS provider |

### Checklist do PRD

- [x] Configurar Vercel Cron Job (`vercel.json`)
- [x] Implementar API Route de trigger no Next.js (`/api/cron/daily-news`)
- [x] Deploy do frontend na Vercel
- [x] Deploy do backend no Render
- [x] Criar instância PostgreSQL no Neon
- [x] Configurar UptimeRobot para keep-alive
- [x] Configurar variáveis de ambiente em todos os serviços
- [x] Rodar migrations em produção
- [x] Testar pipeline completo em produção

### Validação em produção (2026-08-14)

Verificado ao vivo contra `https://newra-news-web.vercel.app` e `https://newra-news-api.onrender.com`:

- **Pipeline diário:** 89 artigos gerados em 90 dias (17/05 → 14/08/2026), apenas 1 gap (01/06)
- **Confiabilidade:** último mês — 31 artigos, 0 dias de falha, taxa de sucesso 100%, IA: Gemini
- **Volume:** ~250 notícias/dia, ~27s por execução do pipeline
- **Infra:** backend Render com uptime de ~92 dias; todas as rotas do frontend retornam 200; Swagger em `/api/docs`
- **CORS:** configurado para o domínio de produção da Vercel

### Problemas conhecidos (pós-validação)

- [x] **Sitemap com URLs de localhost** — `NEXT_PUBLIC_SITE_URL` ausente na Vercel. Corrigido no código (fallback para `VERCEL_PROJECT_PRODUCTION_URL`) e validado em produção em 2026-08-14 — commit `ea2fb5f`
- [x] **Artigos ausentes do sitemap** — `getArticles(1, 90)` estourava o limite de 50 da API e falhava em silêncio. Corrigido com paginação + `toDateSlug()` e validado em produção (89 URLs de artigos, todas respondendo 200) — commit `5994ce7`
- [x] **Diversidade de categorias reduzida** — NewsAPI substituída pela **NewsData.io** (provider implementado + testes; ver `docs/news-api-alternatives.md`). Pendente: adicionar `NEWSDATA_API_KEY` no Render e validar em produção

### Recomendações pendentes

- [x] **Endpoint de diagnóstico de providers** — `GET /api/health/providers` (protegido) testando ao vivo NewsData/Gemini/Groq, para nunca mais depender de investigação manual. Detalhes: `docs/news-api-alternatives.md` §5

### Pendências pós-Fase 4 (não-bloqueantes)

- [ ] Configurar domínio customizado (opcional) — quando houver, definir `NEXT_PUBLIC_SITE_URL`
- [ ] Documentação final (README, docs/) — movida para a Fase 5

---

## Fase 5 — Polish e Portfólio ⏳ Pendente

> Referência: PRD seção 17 — "Fase 5 — Polish e Portfólio (Semana 9-10)"

### Checklist do PRD

- [ ] Refinar UI/UX e animações
- [ ] Gerar diagramas Mermaid (arquitetura, ER, sequência, fluxo)
- [ ] Completar documentação do README com screenshots
- [ ] Code review geral e refatorações
- [ ] Otimização de performance (Lighthouse score)
- [ ] Adicionar loading states e error boundaries
- [ ] Preparar apresentação do projeto para portfólio
