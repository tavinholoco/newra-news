# Newra News

Portal de notícias com **artigo diário gerado por IA** — um artigo em português
produzido automaticamente a cada dia a partir de centenas de notícias coletadas
de fontes brasileiras e internacionais.

## ✨ Funcionalidades

- **Pipeline diário automático** — coleta notícias (NewsData.io + 13 feeds RSS),
  deduplica, e gera o artigo do dia via **Gemini** (com fallback **Groq**)
- **8 categorias** — TECHNOLOGY, POLITICS, ECONOMY, SPORTS, SCIENCE,
  ENTERTAINMENT, WORLD e HEALTH, com classificação por palavras-chave nos feeds RSS
- **Home com feed de notícias** e artigo do dia em destaque (ISR)
- **Busca e filtros por categoria** em tempo real (TanStack Query)
- **Histórico de artigos diários** — navegue por data
- **SEO completo** — sitemap automático, Open Graph, meta tags dinâmicas
- **Mobile-first** com Tailwind CSS + shadcn/ui
- **Métricas em produção** — painel `/api/metrics/*` com contagens por provider e categoria

## 📸 Screenshots

| Home | Notícias | Artigo do dia |
|------|----------|---------------|
| ![Home](docs/screenshots/home.png) | ![Notícias](docs/screenshots/news.png) | ![Artigo](docs/screenshots/article.png) |

## 🧱 Stack

- **Frontend:** Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Backend:** Fastify + TypeScript + Prisma + Zod
- **Database:** PostgreSQL (Neon em produção, Docker local)
- **IA:** Google Gemini (principal) + Groq (fallback)
- **Notícias:** NewsData.io + RSS feeds
- **Monorepo:** Turborepo + pnpm workspaces
- **CI/CD:** GitHub Actions (lint, testes com cobertura >70%, Lighthouse semanal)

## 🚀 Quick Start

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar env vars (ver docs/setup.md §3)
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. Subir o banco (PostgreSQL + pgAdmin)
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed          # opcional: dados realistas

# 4. Rodar em dev
pnpm dev              # web → localhost:3000 · api → localhost:3001
```

## 🔧 Scripts

| Comando | Descrição |
|---|---|
| `pnpm dev` | Sobe web + api em modo desenvolvimento |
| `pnpm build` | Build de produção (monorepo) |
| `pnpm lint` | ESLint em todo o monorepo |
| `pnpm test` | Vitest (backend) |
| `pnpm --filter @newranews/api test:coverage` | Testes com cobertura (threshold 70%) |
| `pnpm db:generate` | Gera o Prisma Client |
| `pnpm db:migrate` | Roda migrations Prisma |
| `pnpm db:studio` | Abre o Prisma Studio |
| `pnpm --filter @newranews/web lighthouse:audit` | Auditoria Lighthouse contra a produção |

## 🔄 Pipeline diário (9 etapas)

```
NewsData.io + RSS → Normalização → Deduplicação → Persistência
→ Seleção (top 15) → Geração IA (Gemini/Groq) → Artigo do dia
→ Cleanup (>30d) → Métricas
```

Disparado às 08:00 BRT (Vercel Cron + cron interno de fallback). Diagramas
completos em [`docs/diagrams/`](docs/diagrams/).

## 📁 Estrutura

```
newranews/
├── apps/
│   ├── web/          # Frontend — Next.js 14
│   └── api/          # Backend — Fastify
├── packages/
│   ├── database/     # Prisma ORM (schema + client)
│   ├── types/        # Types TypeScript compartilhados
│   ├── eslint-config/# Configs ESLint
│   └── tsconfig/     # TSConfigs base
├── docs/             # Documentação + diagramas
└── docker-compose.yml
```

## 📚 Documentação

- [Setup Guide](docs/setup.md) — ambiente local passo a passo
- [Architecture](docs/architecture.md) — arquitetura e pipeline
- [API Guide](docs/api.md) — todos os endpoints
- [Diagrams](docs/diagrams/) — diagramas Mermaid (arquitetura, ER, sequência, fluxo)

## 🌐 Produção

- **Site:** [newra-news-web.vercel.app](https://newra-news-web.vercel.app)
- **API:** [newra-news-api.onrender.com](https://newra-news-api.onrender.com) (Swagger em `/api/docs`)
