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

### Atalho: `./scripts/dev-bootstrap.sh`

Faz de uma vez tudo o que as seções 3 e 4 descrevem passo a passo — sobe o
Postgres (Docker se houver daemon, serviço nativo se não), cria banco, papel e
shadow database, escreve os três arquivos de ambiente com valores locais, aplica
as migrations, gera as imagens de placeholder e roda o seed:

```bash
./scripts/dev-bootstrap.sh
pnpm dev        # api :3001 · web :3000
```

É idempotente e **nunca sobrescreve um `.env` existente** — se você ajustou algo
à mão, fica. Rodar de novo só preenche o que falta.

Leia as seções abaixo quando quiser entender o que cada peça faz, ou quando
precisar de valores diferentes dos placeholders. Em ambientes efêmeros — uma
sessão do Claude Code na web, por exemplo — o script é o caminho, porque o
container começa vazio a cada sessão.

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
| `GROQ_MODEL` | ❌ | Modelo Groq (default `openai/gpt-oss-20b` — o antigo `llama-3.1-8b-instant` foi deprecado em 16/08/2026) |
| `JOB_SECRET` | ✅ | Token Bearer para disparar o pipeline (e proteger os endpoints `/api/dev/*` e `/dev/dashboard`) |
| `CORS_ORIGIN` | ❌ | Origem permitida no CORS (default `http://localhost:3000`) |
| `CRON_SCHEDULE` | ❌ | Cron interno (default `0 8 * * *`) |
| `CRON_TIMEZONE` | ❌ | Timezone do cron (default `America/Sao_Paulo`) |
| `RESEND_API_KEY` | ⚠️ | Chave da Resend p/ a newsletter (opcional — sem ela o envio é pulado no pipeline) |
| `SITE_URL` | ❌ | URL pública do frontend usada nos links do e-mail (default `http://localhost:3000`) |
| `NEWSLETTER_FROM` | ❌ | Remetente com domínio verificado no Resend (default `Newra News <news@newranews.com>`) |
| `AUTH_JWT_SECRET` | ⚠️ | Secret compartilhado com o web (a API valida os JWTs que o frontend assina). **Deve ser idêntico ao `AUTH_JWT_SECRET` do web** |
| `ADMIN_EMAILS` | ❌ | E-mails com `role: ADMIN` no login (separados por vírgula). Vale no **próximo sign-in** |

### 3.3 Frontend (`apps/web/.env.local`)

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `NEXT_PUBLIC_API_URL` | ✅ | URL da API do backend (local: `http://localhost:3001/api`) |
| `NEXT_PUBLIC_SITE_URL` | ❌ | URL do site p/ SEO (sitemap/OG). Na Vercel, deriva de `VERCEL_PROJECT_PRODUCTION_URL` |
| `CRON_SECRET` | ⚠️ | Token do cron Vercel (só relevante no deploy) |
| `BACKEND_JOB_URL` | ⚠️ | URL de trigger do pipeline (só relevante no deploy) |
| `BACKEND_JOB_SECRET` | ⚠️ | `JOB_SECRET` do backend (só relevante no deploy) |
| `NEXTAUTH_URL` | ⚠️ | URL base do site p/ o next-auth (local: `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | ✅ | Secret do next-auth (gerar com `openssl rand -base64 32`) |
| `AUTH_JWT_SECRET` | ✅ | Secret compartilhado com a API (**idêntico ao `AUTH_JWT_SECRET` do backend**) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ⚠️ | OAuth do Google — clientId vazio desativa o botão (o fluxo não completa) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | ⚠️ | OAuth do GitHub — idem; basta um dos dois providers configurado |

> ⚠️ **`BACKEND_JOB_SECRET` deve ser exatamente igual ao `JOB_SECRET` do
> backend** (`apps/api/.env`) — o cron web autentica no endpoint
> `POST /api/jobs/daily-pipeline` com esse valor. Se divergirem, o cron
> responde `502` com `Invalid or missing token`. No deploy, configure o
> mesmo valor nos dois ambientes (Vercel + Render).

> 🔑 **OAuth local:** nos OAuth Apps criados no Google/GitHub, a redirect URI
> de dev é `http://localhost:3000/api/auth/callback/google` (ou
> `/callback/github`). No Google, enquanto o app estiver em modo *Testing*,
> adicione seu e-mail em *Usuários de teste* — senão o login falha no Google.
> Após alterar o `.env.local`, **reinicie o dev server do web** (as envs são
> lidas no boot).

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

# Aplicar o schema ao banco. As migrations SÃO versionadas neste repo —
# `migrate dev` aplica o histórico existente e regenera o client.
pnpm db:migrate

# (Opcional) Popular com dados realistas de todas as categorias
pnpm db:seed

# (Opcional) Abrir o Prisma Studio para inspecionar o banco
pnpm db:studio
```

> 🔁 **Notícias duplicadas (pipeline rodou 2x no mesmo dia):** desde o fix de
> 2026-08-17 o pipeline usa `skipDuplicates` + constraint única em
> `News.sourceUrl`, então não gera mais duplicatas. Se o banco **já tinha**
> duplicatas de antes do fix (ex.: 1º run falhou e um 2º re-inseriu as
> notícias), limpe antes de aplicar o schema:

```bash
# (Opcional) Contar duplicatas sem alterar nada
DATABASE_URL=... DRY_RUN=true pnpm --filter @newranews/database db:cleanup-news-duplicates

# Remover duplicatas (mantém a linha mais recente por sourceUrl)
DATABASE_URL=... pnpm --filter @newranews/database db:cleanup-news-duplicates

# Depois disso, a migration com a constraint única aplica sem erro:
pnpm db:migrate
```

### Alterando o schema

Toda mudança de schema passa por `packages/database/prisma/schema.prisma` seguida
de uma migration gerada — nunca por alteração manual no banco nem por `db push`:

```bash
# 1. editar packages/database/prisma/schema.prisma
# 2. gerar e aplicar localmente (o `--` é obrigatório: o script raiz é `turbo db:migrate`)
pnpm db:migrate -- --name add_briefing_metadata
# 3. revisar o SQL gerado em packages/database/prisma/migrations/ antes de commitar
```

Em produção as migrations são aplicadas pelo workflow `.github/workflows/migrate.yml`
(`prisma migrate deploy`), nunca da máquina do dev. O baseline do banco de produção
(operação única, pendente) está em `docs/db-baseline.md`. Estratégia completa —
nomenclatura, expand-and-contract e rollback — na §37 do
`docs/Newra-News-V2-Frontend-Redesign-Plan.md`.

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
| Frontend (Next.js) | `http://localhost:3000` (páginas em `/pt-BR` e `/en`) |
| Backend (Fastify) | `http://localhost:3001` |
| Swagger (API docs) | `http://localhost:3001/api/docs` |
| Painel admin | `http://localhost:3000/pt-BR/admin` (login + role `ADMIN`) |
| Dashboard de logs (dev) | `http://localhost:3001/dev/dashboard?secret=<JOB_SECRET>` |

---

## 6. Testes, lint e build

```bash
pnpm test                      # Vitest (API + web, via turbo)
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

Observabilidade da pipeline (dev-only, protegida por `JOB_SECRET`):

```bash
# Últimos runs + erros recentes (filtros: ?status=FAILED&since=2026-08-01&limit=20)
curl http://localhost:3001/api/dev/logs -H "Authorization: Bearer <SEU_JOB_SECRET>"

# Detalhe de um run com os eventos por etapa
curl http://localhost:3001/api/dev/logs/<pipelineId> -H "Authorization: Bearer <SEU_JOB_SECRET>"

# Painel HTML no browser
# http://localhost:3001/dev/dashboard?secret=<SEU_JOB_SECRET>
```

Auth local (OAuth): logar em `http://localhost:3000/pt-BR/signin` com
Google/GitHub. O role de admin segue `ADMIN_EMAILS` do backend e é aplicado
no **próximo sign-in** (sair e entrar de novo após mudar a lista).

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
| Notícia repetida no feed (mesma URL 2×) | Pipeline rodou 2x no mesmo dia antes do fix de duplicatas | Rodar `db:cleanup-news-duplicates` (seção 4) e aplicar o schema atualizado |
| `pnpm install` demora/erro de rede | Cache pnpm corrompido | `pnpm install --force` ou apagar `node_modules` |

---

## 9. Deploy (resumo)

- **Frontend** → Vercel (repo conectado; cron em `vercel.json`)
- **Backend** → Render (blueprint `render.yaml`; deploy automático a partir da `main`)
- **Banco** → Neon (PostgreSQL serverless); migrations aplicadas pelo workflow `migrate.yml` (`pnpm db:migrate:deploy`), disparado em push na `main` quando o schema ou as migrations mudam
- **Keep-alive** → **não há**, por decisão medida. A API dorme com ~15 min sem
  tráfego e acorda na primeira requisição; quem precisava dela quente — o
  pipeline e o gate do Lighthouse — acorda sozinho. Ver §9.0, com os números e
  as duas tentativas que falharam antes

Detalhes completos: `docs/PRD-NewraNews_V1.1.md` §13.

### 9.0 Não há keep-alive, e é decisão medida (01/09/2026)

**A API dorme depois de ~15 min sem tráfego, e isso está certo.** O plano free do
Render não cobra requisição — cobra **tempo de instância ligada**: 750 h por mês
por workspace, zerando no dia 1º.

#### O que veio antes, e por que as duas tentativas falharam

**1. UptimeRobot a cada 5 min, o tempo todo.** Como 5 < 15, o serviço nunca
dormia — 24 h × 31 dias = **744 h contra o teto de 750**, 0,8% de folga. Em
**29/08/2026** as horas acabaram e o Render **suspendeu a API até o dia 1º**. O
site ficou de pé mas congelado: `/news` sem carregar, news sitemap com zero URLs,
**três briefings perdidos** (30/08, 31/08 e 01/09).

**2. Workflow do GitHub Actions com janela de horário.** Medido em 01/09:
**2 execuções contra 46 esperadas**, uma delas 47 min atrasada e fora da janela.
A documentação do GitHub pede **no mínimo 15 min** em repositório público e avisa
que execução agendada é despriorizada e **descartada em silêncio** — e o Render
dorme aos 15 min. Os dois números não deixam folga: o mecanismo não podia
funcionar.

#### Por que não há um terceiro

Porque, ao medir o que o keep-alive comprava, a resposta foi: **quase nada.**

| De onde a tela tira o dado | Rotas | O leitor espera? |
|---|---|---|
| **Estática + ISR**, dado no HTML | `/`, `/news`, `/article`, `/about`, `/newsletter` | **não** — recebe a página guardada; a regeneração é atrás |
| **ISR sob demanda**, 1ª visita àquele item | `/news/[id]`, `/article/[date]` | sim, uma vez, **com esqueleto** (`loading.tsx`) |
| **Busca no navegador** | `/account`, `/favorites`, `/admin`, e a `/news` ao filtrar | sim, uma vez, **com esqueleto** |

A `/news` **já traz a primeira página no HTML** (`prefetch(getNews(1, 20))` mais
as facetas) e o TanStack Query tem `staleTime` de 5 min — ela nem busca de novo
ao montar. A Home é uma chamada só, no servidor, com ISR. Nenhuma rota deixa
alguém diante de tela em branco.

**O que sobra de custo:** ~5 s de esqueleto na primeira matéria aberta em cada
sessão — e essa requisição acorda a API para o resto da visita.

#### E as duas peças que dependiam disso já não dependem

- **O pipeline** — a rota do cron **acorda a API antes de disparar**
  (`warmApi` em `app/api/cron/daily-news`, duas tentativas de 25 s). Foi
  justamente o que faltou em 01/09, quando o disparo estourou contra uma API
  dormindo e o dia ficou sem briefing.
- **O gate do Lighthouse** — o passo "Warm production before measuring" bate
  duas vezes em cada URL antes do collect, desde 23/08.

#### Consumo

```
sem keep-alive:  ~60–150 h/mês   (8–20% do teto)
com janela:      ~566 h/mês      (75%)
24/7:             744 h/mês      (99,2%)  <- foi o que suspendeu a API
```

#### O que foi medido e recusado: assar as páginas de detalhe

A ideia era pôr as matérias recentes no `generateStaticParams` em vez de `[]`,
eliminando o único caso em que o leitor espera. **O custo de build é baixo** —
36 matérias custam ~2 s, 300 custam ~20 s, contra um build de ~1 min.

**O que o mata é a validade.** Medido em 01/09: **as 36 matérias linkadas na
Home são todas do dia** (idade mediana 0,0 dias), e o pipeline traz ~530 novas
por dia. O `generateStaticParams` roda **só no build** — então assar hoje cobre
as matérias de hoje, e amanhã a Home linka 36 outras, nenhuma assada.

Só funcionaria com **rebuild diário** disparado depois do pipeline, o que é uma
peça nova e grande, com falha própria, e que **descarta o cache da ISR inteiro a
cada deploy** — deixando todas as páginas frias, que é o oposto do objetivo.

#### Se um dia a lentidão incomodar

Nessa ordem, e só com medição na mão:

1. **cron-job.org** com janela `*/10 9-23,0-2 * * *` em UTC — gratuito, mas
   **sem SLA e sem garantia de execução**, por escrito na documentação deles. É
   a mesma classe de dependência que já falhou duas vezes aqui.
2. **Render Starter, US$ 7/mês** — sem hibernação, sem teto, sem terceiro. Se
   incomodou o bastante para querer resolver, é esta.

#### Se a API for suspensa de novo

1. **Confira a página de uso do Render** (Dashboard → Billing → *Monthly
   Included Usage*) antes de qualquer coisa. Ligado 24/7 desde o dia 1º, a API
   sozinha chegaria a ~685 h em 29/08 — abaixo das 750. A suspensão naquele dia
   sugere **um segundo serviço free no mesmo workspace**.
2. **Não clique em "Remove usage limits".** Ele tira o teto do free, ou seja,
   passa a cobrar por uso.
3. **A suspensão expira sozinha** no dia 1º.

### 9.1 Rotacionar o `AUTH_JWT_SECRET` (runbook)

**O segredo é o mesmo nos dois serviços** — o web assina o JWT, a API valida —,
e **os dois deploys disparam juntos e não terminam juntos**. Trocá-lo sem
procedimento abre uma janela em que toda rota de conta devolve 401: o web já
assina com o segredo novo e a API ainda valida com o velho, ou o contrário.

Não há como fazer a troca sem janela com um segredo só. **O que dá para fazer é
escolher onde ela cai**, e o procedimento é este:

1. **Gerar** o valor novo: `openssl rand -base64 48`.
2. **Trocar na API primeiro** (painel do Render → `AUTH_JWT_SECRET` → Save). O
   Render reinicia o serviço; a partir daí, todo token assinado com o segredo
   velho é recusado. **Começa a janela.**
3. **Trocar na Vercel** (Settings → Environment Variables → `AUTH_JWT_SECRET`) e
   **redeployar** — variável de ambiente só entra num build novo.
4. **Fechar a janela** conferindo uma rota autenticada: entrar no site e abrir
   `/pt-BR/favorites`. Lista carregando = os dois lados combinam.

**Por que a API primeiro, e não o web:** a janela é a mesma nos dois sentidos,
mas o sintoma não é. Trocando a API antes, o efeito é 401 nas telas de conta —
alto e imediato. Trocando o web antes, o `POST /api/auth/upsert` do sign-in
passa a falhar em silêncio, e desde a revisão da Fase 11 isso é retentado a cada
cinco minutos: a falha ficaria escondida atrás de uma retentativa.

**A janela não desloga ninguém.** O cookie de sessão do next-auth é assinado com
`NEXTAUTH_SECRET`, que é outro segredo e não muda aqui. O que para de funcionar
é a ponte para a API, e ela volta sozinha quando o segundo lado subir.

> **`NEXTAUTH_SECRET` é o oposto:** trocá-lo **invalida toda sessão viva** e
> desloga todo mundo. Não há janela — há um evento. Só com motivo.
