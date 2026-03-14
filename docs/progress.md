# Progresso do Projeto — Newra News

> Este arquivo é a fonte de verdade do progresso de desenvolvimento.
> Atualizar ao concluir cada milestone. Referenciar o commit correspondente.

---

## Fase Atual

**Fase 2 — Backend Core** (em andamento)

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

## Fase 2 — Backend Core (em andamento)

> Referência: PRD seção 17 — "Fase 2 — Backend Core (Semana 3-4)"

### Checklist do PRD

- [x] Configurar plugins Fastify: cors, helmet, rate-limit, swagger
- [x] Implementar `GET /api/health`
- [x] Implementar `GET /api/news` (listagem paginada + filtro por categoria)
- [x] Implementar `GET /api/news/:id`
- [x] Implementar `GET /api/articles`
- [x] Implementar `GET /api/articles/latest`
- [x] Implementar `GET /api/articles/:date`
- [ ] Implementar `POST /api/jobs/daily-pipeline` (Bearer token auth)
- [ ] Implementar provider NewsAPI (`src/providers/news/newsapi.provider.ts`)
- [ ] Implementar provider RSS (`src/providers/news/rss.provider.ts`)
- [ ] Implementar provider Gemini AI (`src/providers/ai/gemini.provider.ts`)
- [ ] Implementar provider Groq AI fallback (`src/providers/ai/groq.provider.ts`)
- [ ] Implementar pipeline service completo (9 estágios)
- [ ] Configurar cron job com `@fastify/schedule` (trigger diário)
- [ ] Escrever testes para todos os services e rotas
- [ ] Validar todas as rotas com Zod schemas

### Arquitetura de referência (apps/api/CLAUDE.md)

```
src/
├── routes/          # Uma rota por arquivo + schema Zod adjacente
├── services/        # Lógica de negócio (sem dependência do Fastify)
├── providers/
│   ├── news/        # NewsAPI, RSS
│   └── ai/          # Gemini, Groq
├── plugins/         # Registro de plugins Fastify
└── utils/          # errors.ts (erros customizados), schemas.ts (schemas JSON compartilhados)
```

---

## Fase 3 — Frontend Core (pendente)

> Referência: PRD seção 17 — "Fase 3 — Frontend Core (Semana 5-6)"

### Checklist do PRD

- [ ] Implementar layout global (header, footer, navbar)
- [ ] Página `/` — Home com feed de notícias (ISR)
- [ ] Página `/news` — Listagem de notícias (ISR + CSR para filtros)
- [ ] Página `/news/[id]` — Notícia individual (ISR)
- [ ] Página `/article` — Histórico de artigos (ISR)
- [ ] Página `/article/[date]` — Artigo do dia (ISR)
- [ ] Implementar busca e filtros por categoria
- [ ] Página `/about` e página 404 (SSG)
- [ ] Configurar TanStack Query — `QueryClientProvider` + hooks em `lib/queries.ts`
- [ ] SEO: `generateMetadata()`, Open Graph tags, sitemap auto-gerado
- [ ] Responsividade mobile-first

---

## Fase 4 — Integração e Deploy (pendente)

> Referência: PRD seção 17 — "Fase 4 — Integração e Deploy (Semana 7-8)"

### Checklist do PRD

- [ ] Configurar Vercel Cron Job (`vercel.json`)
- [ ] Implementar API Route de trigger no Next.js (`/api/cron/daily-news`)
- [ ] Deploy do frontend na Vercel
- [ ] Deploy do backend no Render
- [ ] Criar instância PostgreSQL no Neon
- [ ] Configurar UptimeRobot para keep-alive
- [ ] Configurar variáveis de ambiente em todos os serviços
- [ ] Rodar migrations em produção
- [ ] Testar pipeline completo em produção
- [ ] Configurar domínio customizado (opcional)
- [ ] Documentação final (README, docs/)

---

## Fase 5 — Polish e Portfólio (pendente)

> Referência: PRD seção 17 — "Fase 5 — Polish e Portfólio (Semana 9-10)"

### Checklist do PRD

- [ ] Refinar UI/UX e animações
- [ ] Gerar diagramas Mermaid (arquitetura, ER, sequência, fluxo)
- [ ] Completar documentação do README com screenshots
- [ ] Code review geral e refatorações
- [ ] Otimização de performance (Lighthouse score)
- [ ] Adicionar loading states e error boundaries
- [ ] Preparar apresentação do projeto para portfólio
