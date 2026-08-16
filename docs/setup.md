# Setup — Newra News (Guia de Desenvolvimento Local)

Guia passo a passo para rodar o projeto localmente. Para arquitetura, ver
[`docs/architecture.md`](architecture.md); para os endpoints, [`docs/api.md`](api.md).

---

## 1. Pré-requisitos

| Ferramenta | Versão | Motivo |
|------------|--------|--------|
| Node.js | **22 LTS** (ver `.nvmrc`) | Runtime do monorepo |
| pnpm | 9+ | Gerenciador de pacotes (workspaces) |
| Docker Desktop | 20+ | PostgreSQL 16 + pgAdmin locais |

Verifique a versão do Node: `node -v` (deve ser 22.x). Se usa nvm: `nvm use`.

> ⚠️ **Nunca use npm para instalar dependências neste projeto.** Sempre `pnpm`.

---

## 2. Instalação

```bash
# 1. Clonar o repositório
git clone <url-do-repositorio> && cd newranews

# 2. Instalar dependências (monorepo Turborepo + pnpm workspaces)
pnpm install
```

---

## 3. Variáveis de ambiente

São **três** arquivos de ambiente. Copie cada `.env.example` para o arquivo real
e preencha os valores:

```bash
cp .env.example .env                          # raiz — DATABASE_URL
cp apps/api/.env.example apps/api/.env        # backend — chaves de API
cp apps/web/.env.example apps/web/.env.local  # frontend — URLs públicas
```

### 3.1 Raiz (`.env`)

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `DATABASE_URL` | ✅ | URL de conexão do PostgreSQL (usada pelo `packages/database`) |

### 3.2 Backend (`apps/api/.env`)

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `PORT` | ❌ | Porta do servidor (default `3001`) |
| `NODE_ENV` | ❌ | `development` / `production` / `test` |
| `HOST` | ❌ | Host de bind (default `0.0.0.0`) |
| `DATABASE_URL` | ✅ | URL do PostgreSQL (local: `postgresql://user:password@localhost:5432/newranews`) |
| `NEWSDATA_API_KEY` | ⚠️ | Chave da NewsData.io (opcional — sem ela o pipeline roda só com RSS) |
| `GEMINI_API_KEY` | ✅ | Chave da Gemini (geração do artigo) |
| `GEMINI_MODEL` | ❌ | Modelo Gemini (default `gemini-2.5-flash`) |
| `GROQ_API_KEY` | ✅ | Chave da Groq (fallback de IA) |
| `GROQ_MODEL` | ❌ | Modelo Groq (default `llama-3.1-8b-instant`) |
| `JOB_SECRET` | ✅ | Token Bearer para disparar o pipeline |
| `CORS_ORIGIN` | ❌ | Origem permitida no CORS (default `http://localhost:3000`) |
| `CRON_SCHEDULE` | ❌ | Cron interno (default `0 8 * * *`) |
| `CRON_TIMEZONE` | ❌ | Timezone do cron (default `America/Sao_Paulo`) |

### 3.3 Frontend (`apps/web/.env.local`)

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `NEXT_PUBLIC_API_URL` | ✅ | URL da API do backend (local: `http://localhost:3001/api`) |
| `NEXT_PUBLIC_SITE_URL` | ❌ | URL do site p/ SEO (sitemap/OG). Na Vercel, deriva de `VERCEL_PROJECT_PRODUCTION_URL` |
| `CRON_SECRET` | ⚠️ | Token do cron Vercel (só relevante no deploy) |
| `BACKEND_JOB_URL` | ⚠️ | URL de trigger do pipeline (só relevante no deploy) |
| `BACKEND_JOB_SECRET` | ⚠️ | `JOB_SECRET` do backend (só relevante no deploy) |

> 💡 Se faltar alguma variável obrigatória, o backend exibe um painel no console
> listando as variáveis ausentes — basta copiar o `.env.example` e preencher.

---

## 4. Banco de dados local

O `docker-compose.yml` sobe **PostgreSQL 16** e **pgAdmin 4**:

```bash
# Subir PostgreSQL + pgAdmin em background
docker compose up -d

# Gerar o Prisma Client
pnpm db:generate

# Criar/rodar as migrations
pnpm db:migrate

# (Opcional) Popular com dados realistas de todas as categorias
pnpm db:seed

# (Opcional) Abrir o Prisma Studio para inspecionar o banco
pnpm db:studio
```

| Serviço | URL | Credenciais |
|---------|-----|-------------|
| PostgreSQL | `localhost:5432` | `user` / `password` / db `newranews` |
| pgAdmin | `http://localhost:5050` | `admin@newranews.com` / `admin` |

---

## 5. Rodando em desenvolvimento

```bash
pnpm dev
```

Isso inicia os dois apps via Turborepo:

| App | URL |
|-----|-----|
| Frontend (Next.js) | `http://localhost:3000` |
| Backend (Fastify) | `http://localhost:3001` |
| Swagger (API docs) | `http://localhost:3001/api/docs` |

---

## 6. Testes, lint e build

```bash
pnpm test                      # Vitest (backend)
pnpm --filter @newranews/api test:coverage   # testes + cobertura (threshold 70%)
pnpm lint                      # ESLint no monorepo
pnpm build                     # build de produção (todos os apps)
```

> No CI (GitHub Actions), a cobertura é obrigatória: `pnpm turbo test:coverage`
> falha se cair abaixo de 70%. O Lighthouse é auditado semanalmente contra a
> produção (workflow `lighthouse.yml`).

---

## 7. Disparar o pipeline manualmente

O pipeline roda 1x/dia (08:00 BRT, via Vercel Cron + cron interno de fallback).
Para disparar manualmente:

```bash
curl -X POST http://localhost:3001/api/jobs/daily-pipeline \
  -H "Authorization: Bearer <SEU_JOB_SECRET>"
# → { "status": "started", "pipelineId": "uuid" }

# Acompanhar a execução
curl http://localhost:3001/api/jobs/<pipelineId>
# → { "data": { "status": "SUCCESS | RUNNING | FAILED", ... } }
```

Diagnóstico rápido das chaves dos providers (NewsData, Gemini, Groq):

```bash
curl http://localhost:3001/api/health/providers -H "Authorization: Bearer <SEU_JOB_SECRET>"
# → { "newsdata": "ok", "gemini": "ok", "groq": "ok" }
```

---

## 8. Troubleshooting

| Problema | Causa provável | Solução |
|----------|----------------|---------|
| Backend não sobe com painel de env vars | Variáveis obrigatórias ausentes | Copiar `apps/api/.env.example` → `.env` e preencher |
| `PrismaClientInitializationError` | Client desatualizado ou banco fora do ar | `docker compose up -d` + `pnpm db:generate` |
| Porta 3000/3001 ocupada | Outro processo usando a porta | Encerrar o processo ou mudar `PORT` no `.env` |
| Página sem dados no frontend | API não está rodando ou `NEXT_PUBLIC_API_URL` errada | Confirmar `pnpm dev` e o valor no `.env.local` |
| Pipeline roda só com RSS | `NEWSDATA_API_KEY` ausente ou inválida | Conferir a chave em `apps/api/.env` e em `/api/health/providers` |
| Conteúdo com `ONLY AVAILABLE IN PAID PLANS` | Tier free da NewsData (placeholder) | Normal — o provider já converte para `null` |
| `pnpm install` demora/erro de rede | Cache pnpm corrompido | `pnpm install --force` ou apagar `node_modules` |

---

## 9. Deploy (resumo)

- **Frontend** → Vercel (repo conectado; cron em `vercel.json`)
- **Backend** → Render (blueprint `render.yaml`; deploy automático a partir da `main`)
- **Banco** → Neon (PostgreSQL serverless); rodar `pnpm db:migrate:deploy` em produção
- **Keep-alive** → UptimeRobot pingando `GET /api/health` a cada 5 min

Detalhes completos: `docs/PRD-NewraNews_V1.1.md` §13.
