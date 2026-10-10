# Arquitetura — Newra News

> Reescrito em **09/10/2026**, depois das Fases 0–12 da V2 e do plano de
> observabilidade. A versão anterior descrevia a V1 (nove etapas, sem contas,
> sem painel). **Este é o mapa; o detalhe mora nos `CLAUDE.md` de cada app** —
> `apps/api/CLAUDE.md` para a API e o pipeline, `apps/web/CLAUDE.md` para o
> web, `packages/database/CLAUDE.md` para o banco — e nos seis diagramas de
> [`docs/diagrams/`](diagrams/), guardados contra deriva.

## Visão Geral

```
[Leitor] → [Vercel: Next.js 14, ISR + BFF] → [Render: Fastify] → [Neon: PostgreSQL]
                    ↑                              ↕                   ↕
     cron diário (11:00 UTC)            [NewsData.io + RSS]     [Gemini / Groq]
     Heartbeat (12:40 UTC, GitHub)      [Resend]
```

- **O navegador nunca fala com a API direto** nas rotas com sessão: o BFF do
  Next (`app/api/*`) assina um JWT de escopo curto com o segredo compartilhado
  (`AUTH_JWT_SECRET`) e repassa. As duas portas anônimas (`/api/events` e
  `/api/errors/client`) também passam pelo BFF.
- **A API dorme no plano free do Render** (~15 min sem tráfego), e não há
  keep-alive desde 01/09/2026: quem precisa dela acordada acorda antes de
  chamar. As 750 h/mês são do **workspace**, que a API divide com outro
  serviço — o arco da `/admin` mostra as duas partes (`docs/setup.md` §9.0).
- **O web lê a API por geração estática com ISR**, então uma página já gerada
  continua no ar com a API fora. O `revalidate` é de um dia (sete na
  `/news/[id]`); o frescor vem do cron, que invalida o conjunto do dia.

## Backend — Fastify API (`apps/api/`)

Padrão `routes → services → providers`; Zod em toda rota (o schema de
resposta **é** o contrato — o que ele não declara não sai), Prisma nos
services, clients externos nos providers.

### Estrutura de Diretórios

```
src/
├── app.ts                  # buildApp() — plugins, rotas, handler de erro e o 404 no contrato
├── server.ts               # Entry point — o cron interno e o heartbeat do DailyUptime moram aqui
├── config/                 # env.ts (Zod), ai-prompts.ts, rss-sources.ts, load-env-file.ts
├── plugins/
│   ├── auth.ts             # authPlugin (JWT com `purpose`), requireAdmin, requireSubject
│   ├── observability.ts    # x-request-id, uma linha de log por requisição, métricas HTTP em memória
│   ├── error-events.ts     # flush do ErrorEvent a cada 30 s e no onClose (com prazo)
│   ├── uptime-heartbeat.ts # o crédito de horas por dia UTC (registrado no server.ts)
│   ├── rate-limit.ts       # 100 req/min global; rotas com teto próprio
│   ├── helmet.ts · cors.ts · swagger.ts  # a UI do Swagger só em desenvolvimento
├── routes/                 # health, news, editorial, articles, jobs, metrics, auth, account,
│                           # favorites, newsletter, events, errors, admin (seis subgrupos), dev
├── services/               # pipeline, portões, invariantes, saúde por fonte, desfecho do run,
│                           # ErrorEvent, auditoria, horas do plano, saturação, métricas…
├── providers/
│   ├── news/               # newsdata, rss (com a nova tentativa da falha rápida), feed-text
│   ├── ai/                 # gemini, groq, ai-utils, output-guard (o portão de saída)
│   └── newsletter/         # resend
├── jobs/daily-pipeline.job.ts  # o agendador interno (caminho feliz — o disparo real é o cron da Vercel)
└── utils/                  # errors.ts (a taxonomia), logger.ts (pino + redação), job-secret.ts,
                            # request-route.ts, web-route.ts, event-loop.ts, cache.ts
```

### Fluxo de uma Requisição

```
HTTP Request
  → Fastify (trustProxy: 1, rate-limit, cors, helmet, recusa de Content-Type com caractere de controle)
  → preHandler: authPlugin / requireAdmin (rotas com sessão)
  → Route Handler (validação Zod via fastify-type-provider-zod)
  → Service → Prisma
  → HTTP Response (x-request-id em toda resposta)
  → onResponse: uma linha de log JSON, no nível do status; a métrica da rota

Erro: AppError com `code` (literal de um conjunto fechado) e `category` → o nível de
log sai da categoria → toda falha que não é `debug` vira uma linha de ErrorEvent
por (fingerprint, hora). Todo 5xx devolve `{ error, requestId }` e nada do interior.
```

### Pipeline Diário (14 etapas)

Disparado pelo cron da Vercel (`GET /api/cron/daily-news` → `POST
/api/jobs/daily-pipeline`, Bearer `JOB_SECRET`) ou pelo agendador interno.
**Idempotente por dia**: a resposta diz `started`, `already-running` ou
`already-succeeded-today`.

- **1 — Coleta** — NewsData.io + RSS em paralelo (`Promise.allSettled`)
- **2 — Normalização** — higiene de texto na entrada (`feed-text.ts`)
- **3 — Deduplicação** — por `sourceUrl`
- **4 — Persistência** — e a **saúde por fonte** do dia (`SourceHealth`)
- **5 — Seleção** — as 15 mais recentes
- **5.5 — Portão de entrada** — volume contra a mediana de 7 dias, três
  fontes, frescor; bloqueia **antes** de gastar a chamada de IA
- **6 — Geração IA** — Gemini → Groq
- **6.5 — Portão de saída** — por tentativa: URL ou envelope do prompt na
  saída **falha o dia sem cair para o Groq**; idioma e tamanho caem uma vez
- **7 — Persistência do Artigo** — com as fontes citadas e os campos de
  auditoria
- **7.5 — Newsletter**
- **8 — Cleanup** — o expurgo por idade (tabela abaixo)
- **8.5 — Renormalização** — reaplica as regras de ingestão ao acervo gravado
- **9 — Métricas** — `DailyMetric` e o resumo do run no evento final
- **9.5 — Invariantes** — doze consultas perguntando se o que as etapas
  anteriores deveriam ter deixado está lá; violação vira `ErrorEvent`, não
  degrada o run

**O desfecho do run é derivado dos eventos**, não do `status`: `SUCCESS`,
`SUCCESS_DEGRADED` (com as etapas em `degradedBy`) ou `FAILED`. Depois do
`SUCCESS`, o cron invalida as páginas do dia pela rota irmã
`/api/cron/daily-news/revalidate`, pede cada uma e confere que trazem a marca
do run — até três rodadas.

### Política de Retenção (etapa 8)

| Tabela | Retenção | Corte por |
|--------|---------|-----------|
| News | 30 dias | `createdAt` |
| PipelineLog | 30 dias | `startedAt` |
| Article | 90 dias | `createdAt` |
| ProductEvent | 90 dias | `occurredAt` |
| SourceHealth | 90 dias | `day` |
| ErrorEvent | 14 dias | `windowStart` |
| AuditEvent | 365 dias | `createdAt` |
| DailyMetric, DailyUptime, NewsletterLog | indefinida | — |

Os números têm guarda (`apps/api/tests/docs/retention-drift.test.ts`), e a
invariante `retention.*` de cada tabela reprova no dia seguinte a um expurgo
que roda e não apaga.

## Frontend — Next.js (`apps/web/`)

### Estratégia de Renderização

- **ISR com `generateStaticParams`** — Home, `/news`, `/news/[id]`, `/article`,
  `/article/[date]`, nos dois idiomas. Sem `generateStaticParams`, um segmento
  dinâmico é renderizado a cada requisição e o `revalidate` não vale para o
  HTML — há guarda (`tests/lib/rendering-mode.test.ts`).
- **Estáticas** — `/about`, `/newsletter`, a 404.
- **Dinâmicas, com sessão** — `/signin`, `/account/*`, `/favorites`, `/admin/*`.
- **CSR** — busca, filtros e paginação do acervo, com o estado na URL.

### O BFF (`app/api/`)

- **Com sessão:** `account`, `favorites`, `admin/*` (o papel ADMIN é conferido
  no BFF **e** na API).
- **Anônimas:** `events` (analytics) e `errors/client` (o relato dos error
  boundaries, com o `digest` do servidor).
- **Cron:** `cron/daily-news` e a rota irmã `cron/daily-news/revalidate`.
- **A sonda do login:** `health/auth` — assina um JWT de escopo
  `health-probe` e pergunta à API se ela o aceita; o cron a regenera todo dia
  e o Heartbeat lê o resultado.
- Toda falha do BFF escreve uma linha JSON no log de função da Vercel
  (`lib/log-server-error.ts`), com os segredos redigidos.

### O painel de admin — três abas

| Aba | Rota | O que mostra |
|---|---|---|
| Painel | `/admin` | runs com o desfecho derivado, a faixa de 30 dias, o tempo desde o último briefing, as horas do workspace (com a leitura do Billing) e as horas por dia |
| Métricas | `/admin/metrics` | os quatro sinais de ouro, as métricas de produto e a saúde de cada fonte |
| Logs e segurança | `/admin/security` | falhas agrupadas por fingerprint, a trilha de auditoria, as invariantes e os portões |

`pnpm --filter @newranews/web admin:capture` fotografa as três, em 375 e
1440 px, claro e escuro.

## O que mede o sistema de fora

| Mecanismo | Quando | O que pergunta |
|---|---|---|
| **Heartbeat** (`.github/workflows/heartbeat.yml`) | todo dia, 12:40 UTC | o site, a API (e se é suspensão do Render), o briefing de hoje, as duas Homes o mostrando, a sonda do login, o último push a menos de 45 dias — **o job reprovado é o e-mail** |
| **Smoke E2E** | todo push na `main` | os fluxos do leitor e a matriz de autorização contra produção (os fluxos com login ficam pulados por decisão) |
| **Lighthouse CI** | segunda, 12:00 UTC (e à mão no ritual) | sete rotas, gate de 90 na mediana |
| **Gitleaks** | todo PR e todo push | o PR pela action; o push pelo binário, sobre `before..after`, merges incluídos |

## Banco de Dados — Prisma + PostgreSQL

- **Local:** Docker Compose (PostgreSQL 16), que sobe e para junto com o dev
  server da API (`scripts/dev-with-db.mjs`)
- **Produção:** Neon (plano free)
- **Migrations:** `pnpm db:migrate` em desenvolvimento; em produção só pelo
  workflow `Migrate`, no push da `main`
- **Seed de desenvolvimento:** `pnpm db:seed` — popula também as tabelas de
  observabilidade, para o painel ter o que desenhar

## Packages Compartilhados

| Package | Conteúdo |
|---------|---------|
| `@newranews/database` | Prisma Client singleton, schema, migrations e seed |
| `@newranews/types` | os contratos entre os apps — editorial, analytics (o catálogo de eventos), pipeline, observabilidade (`PLAN_READING_MAX_HOURS`, `UptimeSeries`). **Emite JavaScript**: a API o importa em runtime |
| `@newranews/eslint-config` | Configs ESLint (base, next, node) |
| `@newranews/tsconfig` | TSConfigs base (base, next, node) |
