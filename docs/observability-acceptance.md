# Matriz de aceitação do plano de observabilidade

> **A Fase 12 do `docs/Newra-News-Observability-Plan.md` (§22) preenche este
> arquivo.** Uma linha por coisa que o plano entregou, com o jeito de provocá-la
> ao vivo e o observável que prova que ela funciona. A fase termina quando
> **toda linha tem status e evidência** — nunca antes.
>
> Aberto em 24/09/2026 sobre `a0ae0fc` (a `dev` com o #233). Branch
> `observability/fase-12-acceptance`.

## Como ler e preencher

- **Status:** `[ ]` pendente · `[x]` provado · `[!]` achou defeito (a linha diz o
  PR que corrigiu e a guarda que nasceu) · `[~]` bloqueado (a linha diz por quê
  e qual gatilho o destrava).
- **Ambiente:** **L** = local (Postgres do Docker, API e web em dev, chaves reais
  de provider) · **C** = CI/GitHub · **P** = produção.
- **Evidência é observável, nunca "passou".** Uma linha de log (sem segredo), o
  resultado de uma consulta SQL, uma resposta HTTP com status e corpo, o nome de
  uma captura. Quem ler a evidência daqui a um mês tem de conseguir repetir.
- **Nada de injeção de falha commitada.** Variável de ambiente local, SQL no
  banco local, `page.route` no Playwright, parar o container. O que for arquivo
  mutado volta do conteúdo guardado em memória, nunca por `git checkout` (lição
  do 5a: com o arquivo sujo, ele reverte o trabalho inteiro).
- **Todo `[!]` sai como correção mergeada + guarda, ou dívida com gatilho
  numérico no §16 do plano.** Nunca como item de lista.

---

## M0 — O terreno (antes de qualquer teste)

- [ ] **A0.01 — Sessão no lugar certo.** `pwd && git branch --show-current`
  responde a pasta do repositório e `observability/fase-12-acceptance`;
  `git rev-list --count origin/dev..origin/main` = 0. · L
- [ ] **A0.02 — O alvo é um commit fixo.** Os seis PRs do Dependabot abertos em
  24/09 (#234–#239) triados **antes** de começar — os minors verdes mergeados, os
  majors que reprovam (#237: `@vitest/coverage-v8` 5 exige vitest 5) no `ignore`
  do `.github/dependabot.yml` **da `main`**, num PR só com o arquivo (a
  plataforma lê a branch padrão). O SHA medido fica anotado aqui. · C
- [ ] **A0.03 — A suíte na contagem, não no pass/fail.** `pnpm test` com **1.384
  na API e 904 no web** (ou o número novo, se A0.02 mudou algo — anotado);
  `pnpm lint` e `pnpm turbo typecheck` verdes. O sintoma de clone mal montado é
  verde com número menor (§19). · L
- [ ] **A0.04 — O banco local no estado conhecido.** Docker de pé (se cair no
  boot, a receita do `.sock` órfão está na memória: matar `*docker*`, renomear
  `Docker\run` e `docker-secrets-engine` de uma vez, subir uma vez);
  `docker compose -f docker-compose.yml up -d --wait postgres`; seed rodado;
  **contagem de cada tabela anotada** (`News`, `Article`, `BriefingSource`,
  `PipelineLog`, `PipelineEvent`, `DailyMetric`, `ErrorEvent`, `AuditEvent`,
  `DailyUptime`, `SourceHealth`, `ProductEvent`) — é o "antes" de tudo. · L
- [ ] **A0.05 — As chaves existem, sem aparecer.** Um script que lê o
  `apps/api/.env` e imprime **só** quais de `GEMINI_API_KEY`, `GROQ_API_KEY`,
  `NEWSDATA_API_KEY`, `RESEND_API_KEY`, `JOB_SECRET`, `AUTH_JWT_SECRET` estão
  preenchidas (sim/não). Sem Gemini e Groq, o M4 inteiro fica `[~]`. · L
- [ ] **A0.06 — O navegador da captura.** `CHROMIUM_PATH` apontando para o
  `chromium_headless_shell-<rev>` instalado se o Playwright pedir outra revisão
  (em 20/09 pediu a 1243 com a 1234 instalada). · L

## M1 — As guardas reprovam quando devem

> O plano criou ou estendeu ~30 guardas, e cada fase viu as **suas** reprovarem
> uma vez. Este marco as vê **todas juntas, sobre a árvore final**, por um script
> versionado — a primeira vez que "a guarda reprova" vira comando repetível. É o
> eixo **T** da §28 da V2 aplicado ao plano.

- [ ] **A1.00 — `scripts/guard-mutations.mjs` existe e se vê falhando.** Tabela
  de mutações `{ id, arquivo, trecho, troca, pacote, arquivo de teste }`; para
  cada uma: confere que o arquivo está limpo no git, guarda o conteúdo, aplica a
  troca **exigindo que o trecho ocorra exatamente uma vez** (mutação que não
  aconteceu é falha do script — o CRLF do 5b fez uma "passar verde"), roda só
  aquele arquivo de teste com `--reporter=json` (o ANSI do 5b quebrou o regex de
  `failed`), e **restaura em `finally`**. Imprime a tabela `id · reprovou?`. Visto
  falhando: uma mutação inócua (comentário) tem de sair "NÃO reprovou". · L
- [ ] **A1.01..A1.24 — Cada mutação abaixo reprova a guarda indicada.** · L

| ID | Guarda | Mutação |
|---|---|---|
| A1.01 | `tests/build/workflow-hardening.test.ts` | um `uses:` sem SHA; um `permissions: write-all` na coluna zero |
| A1.02 | `tests/build/dependabot-config.test.ts` | `@types/node` sem aspas numa entrada de `ignore` |
| A1.03 | `tests/security/secrets-in-logs.test.ts` | um `console.warn` no fim de `routes/dev/dashboard.ts` (o arquivo que cegou a varredura por regex) |
| A1.04 | `tests/utils/error-taxonomy.test.ts` | um `code` novo no tuple sem quem o lance; um `code` montado com template |
| A1.05 | `tests/services/error-event.test.ts` | `recordError` virando `async`; um `code:` interpolado num call site |
| A1.06 | `tests/services/run-outcome-wiring.test.ts` | apagar o `degradedBy.push(5.5)` do bloco do aviso do portão de entrada |
| A1.07 | `tests/docs/diagram-drift.test.ts` | tirar a linha `6.5 ·` do `pipeline-sequence.mermaid` |
| A1.08 | `tests/docs/retention-drift.test.ts` | `ERROR_EVENT_RETENTION_DAYS = 15` |
| A1.09 | `tests/build/migrations.test.ts` | um `model` novo no schema sem SQL; uma coluna tirada do schema sem `DROP COLUMN` |
| A1.10 | `tests/docs/schema-docs-drift.test.ts` | um `model` ausente do `packages/database/CLAUDE.md` |
| A1.11 | `tests/security/authorization-matrix.test.ts` | tirar o `requireAdmin` do `routes/admin/index.ts` |
| A1.12 | `tests/security/bff-route-seam.test.ts` | `'/admin/errors'` → `'/admin/error'` num `proxyToApi` |
| A1.13 | web `tests/lib/admin-surface.test.ts` | tirar o `requireRole: 'ADMIN'` de `app/api/admin/sources/route.ts` |
| A1.14 | web `tests/lib/hand-written-lists.test.ts` | tirar `admin-security` do `ALL_ROUTES` do `capture-admin.mjs` |
| A1.15 | web `tests/lib/bff-error-log.test.ts` | tirar o `logServerError` de um `catch` de `route.ts` |
| A1.16 | `tests/services/invariants.service.test.ts` | um `findMany` sem `select` numa invariante |
| A1.17 | `tests/utils/web-route.test.ts` | tirar um padrão de `WEB_ROUTE_PATTERNS` |
| A1.18 | `tests/routes/shared-type-contract.test.ts` | uma resposta `202` sem contrato declarado |
| A1.19 | web `tests/lib/gate-checks.test.ts` | um check novo em `OUTPUT_GUARD_CHECKS` sem rótulo |
| A1.20 | `tests/providers/output-guard.test.ts` | `copied-url` voltando a aviso |
| A1.21 | `tests/security/prompt-injection.test.ts` (camada 4) | o guarda aceitando URL cujo host está no material |
| A1.22 | web `tests/lib/isr-determinism.test.ts` | tirar o `STATIC_NOW` do `i18n/request.ts` |
| A1.23 | web `tests/lib/api-failure.test.ts` | `.catch(() => [])` no `news-sitemap.xml` |
| A1.24 | web `tests/lib/state-matrix.test.ts` | um `error.tsx` que não desenha pela casca `error-state` |

## M2 — O log e a taxonomia, ao vivo (Fases 1, 3, 7a)

> API em dev com `LOG_LEVEL=info`, stdout capturado num arquivo do scratchpad.
> Tudo pela **porta real** (`curl`/socket), nunca `inject` — o `inject` não passa
> pelo parser HTTP (lição da Fase 3). Tokens de teste assinados por um script de
> scratch com o `AUTH_JWT_SECRET` local.

- [ ] **A2.01 — Uma linha por requisição, com `reqId` e nível pelo status.**
  `GET /api/health` e `GET /api/news` → exatamente uma linha cada, `info`. · L
- [ ] **A2.02 — Segredo nunca no stdout.** Depois de todo o M2, um script procura
  no log capturado os **valores** de `JOB_SECRET`, `AUTH_JWT_SECRET`, das chaves
  de provider e a senha da DSN (lidos do `.env`, nunca impressos) → zero
  ocorrências; o host da DSN aparece, a palavra `Bearer` aparece. · L
- [ ] **A2.03 — `LOG_LEVEL=warn` deixa só o que deu errado.** Reiniciar com
  `warn`, repetir A2.01 → zero linhas. · L
- [ ] **A2.04 — `AUTH_TOKEN_INVALID`.** `GET /api/account` com token lixo → 401
  `{ "error": "Invalid or missing token" }`; linha `warn`, `code`, `category:
  authorization`, `requestId`, e o `cause` do jose (`JWSInvalid`); com token
  expirado, `JWTExpired`. · L
- [ ] **A2.05 — `ADMIN_REQUIRED`.** Token válido de `role: USER` em
  `GET /api/admin/errors` → 403, `warn`. · L
- [ ] **A2.06 — `JOB_SECRET_INVALID`.** `POST /api/jobs/daily-pipeline` com
  Bearer errado → 401, `warn`, nenhum run criado. · L
- [ ] **A2.07 — `DASHBOARD_SECRET_INVALID`.** `POST /dev/dashboard/session` com
  senha errada → 303 e linha `warn`; **o palpite não aparece no log**. · L
- [ ] **A2.08 — `CONTENT_TYPE_REJECTED`.** Pela porta, com o caractere de controle
  que o `content-type-bypass.test.ts` usa → 415 com a **frase fixa do nosso
  hook** (não a do Fastify, que ecoa o cabeçalho); linha `warn`; o cabeçalho
  forjado não entra no log. · L
- [ ] **A2.09 — `NOT_FOUND` fora do contrato não existe mais.**
  `GET /api/nao-existe` → 404 `{ "error": … }` sem ecoar o caminho; **nenhuma**
  linha em `info` (é `debug`). · L
- [ ] **A2.10 — `ACTOR_ID_INVALID`.** Secret certo + `x-actor-id: lixo` → 400,
  linha `error` (`internal` num 400), pipeline **não** disparado. · L
- [ ] **A2.11 — `AUTH_SUBJECT_MISMATCH`.** `POST /api/auth/upsert` com token de
  `purpose: auth-upsert` do e-mail A e corpo com o e-mail B → 401, `warn`. · L
- [ ] **A2.12 — `AUTH_SESSION_INCOMPLETE`.** Token assinado sem `sub`/`email` →
  401, linha `error`. · L
- [ ] **A2.13 — `AUTH_NOT_CONFIGURED`.** API reiniciada com `AUTH_JWT_SECRET`
  vazio → todo token 401, linha **`error`** (a categoria vence o status). · L
- [ ] **A2.14 — `UNHANDLED`: o 500 cru.** Postgres parado → `GET /api/news` →
  500 com a frase fixa e `x-request-id`; linha `error` com o `err` serializado
  (host da DSN, sem senha). · L
- [ ] **A2.15 — `/api/health/providers` diz "por quê" no log.** Com
  `GEMINI_API_KEY` lixo → status `invalid` na resposta (contrato intacto) e a
  razão no log, **sem a URL da sonda**. · L
- [ ] **A2.16 — O BFF escreve a falha (7a).** API parada, web de pé: as rotas
  `/api/admin/errors` (com sessão), `/api/events`, `/api/errors/client`,
  `/news-sitemap.xml` e `/api/cron/daily-news` → uma linha JSON no stderr do web
  com o `scope` (`bff.proxy`, `bff.events`, `bff.errors.client`, …), o `cause`
  com `ECONNREFUSED`, e nenhum valor de segredo (o Bearer do cron redigido). · L
- [ ] **A2.17 — `bff.proxy.sign`.** Web com `AUTH_JWT_SECRET` vazio → a rota de
  conta loga a falha de assinatura **e relança** (o status não muda). · L

## M3 — O registro durável (Fases 4, 7c, 5b)

- [ ] **A3.01 — As falhas do M2 viram linhas em ≤ 30 s.** `ErrorEvent` com um
  fingerprint por falha distinta (`API:WARN:AUTH_TOKEN_INVALID:/api/account`, …),
  `category` e `severity` certas, `firstRequestId`/`lastRequestId`. · L
- [ ] **A3.02 — Coalescimento.** 50 × o mesmo 401 num laço → **uma** linha com
  `count` somando 50 na hora. · L
- [ ] **A3.03 — `debug` não vira linha.** Nenhuma linha de `NOT_FOUND`. · L
- [ ] **A3.04 — O banco fora, e o preço escrito.** Postgres parado por > 30 s
  com falhas acontecendo → linha `warn` `[error-event] failed to persist` e a
  ocorrência perdida (é o documentado); parado por < 30 s → a linha aparece
  depois que ele volta. · L
- [ ] **A3.05 — O flush do desligamento, com prazo.** Falhas acumuladas e
  `Ctrl+C` na API (o `server.ts` trata `SIGINT` e `SIGTERM`; o `preview_stop` do
  painel **não** manda sinal) → as linhas persistidas; com o Postgres parado, o
  processo sai em ~2 s (`ERROR_EVENT_CLOSE_TIMEOUT_MS`), sem pendurar. · L
- [ ] **A3.06 — `GET /api/admin/errors`.** `24h` e `7d`: grupos por
  fingerprint, `byCategory` com **as seis** categorias na ordem da taxonomia,
  `since` alinhado à hora cheia (item 65), `truncated: false`. · L
- [ ] **A3.07 — O relato do cliente (7c).** Pelo BFF,
  `POST /api/errors/client` `{ message, digest, path: '/pt-BR/news/<uuid>' }` →
  **202** `{ accepted: true }`; depois do flush, linha `WEB · CLIENT_ERROR ·
  /[locale]/news/[id]` com `digest` e `path` no `context`. · L
- [ ] **A3.08 — Caminho desconhecido vai para `unmatched`.** · L
- [ ] **A3.09 — O balde de 10/min atravessa o BFF.** O 11.º relato no minuto →
  **429** no navegador; o buffer não ganha a 11.ª ocorrência. · L
- [ ] **A3.10 — O corpo é lista de permissão.** `userId`, `email` e `stack` no
  corpo → nenhum deles no `context`. · L
- [ ] **A3.11 — O 4xx por rota (armadilha 39).** `GET /api/metrics/http` tem a
  linha `POST /api/errors/client` com `clientErrorRate > 0` depois do A3.09. · L
- [ ] **A3.12 — Saturação e horas do plano (5b).** Com a API de pé > 10 min, a
  linha de hoje do `DailyUptime` cresce ~300 s por tique; `saturation.plan.hoursUsed`
  = soma do mês / 3600; `eventLoop.lagMs.p50` ≈ 0 em repouso (sem a resolução do
  timer). · L
- [ ] **A3.13 — A rota em memória responde com o banco fora (item 65).**
  Postgres parado → `GET /api/metrics/http` **200**, com `saturation.plan: null`
  e memória/event loop presentes. · L
- [ ] **A3.14 — Auditoria de exclusão.** Excluir uma notícia pela `/admin` →
  `AuditEvent` `news.deleted` com `actorId` (nunca e-mail) e `targetId`. · L

## M4 — O pipeline de ponta a ponta, com provedores reais (Fases 2, 8, 11, 6, 9)

> **Orçamento: no máximo três runs**, e só o primeiro consome a NewsData. Antes
> do run 1, o terreno é preparado por SQL no banco local e anotado aqui. Durante
> todo run, um laço em segundo plano bate no `/api/health` a cada segundo e grava
> a latência (é o teste do incidente de 03/09).

- [ ] **A4.00 — Preparação, anotada.** (a) uma linha velha em cada uma das
  **sete** tabelas que a etapa 8 expurga (`News` 31 d, `PipelineLog` 31 d,
  `Article` 91 d, `ProductEvent` 91 d, `ErrorEvent` 15 d, `AuditEvent` 366 d,
  `SourceHealth` 91 d); (b) um `PipelineLog` `RUNNING` de 20 min atrás; (c) uma
  `News` com HTML no `content`; (d) a janela de 7 dias de `DailyMetric` com
  `articleGenerated` (linha de base). · L
- [ ] **A4.01 — Run 1, limpo, pelo botão.** "Executar agora" na `/admin` local
  (sessão forjada pela mecânica do `capture-admin.mjs`, num script de scratch) —
  BFF → `/api/cron/daily-news` → API. Tela: "disparado" com a hora; banco:
  `AuditEvent` `pipeline.triggered` com o `actorId` da sessão, `targetId` = o run,
  `outcome: started`. · L
- [ ] **A4.02 — O cadáver foi enterrado.** O `RUNNING` de A4.00b virou `FAILED`
  com `errorStage` **nulo**, evento de etapa 0 `ERROR`, e `ErrorEvent`
  `PIPELINE_STAGE_FAILED · stage-0` com o id **do run morto**. · L
- [ ] **A4.03 — As 14 etapas anunciam.** Eventos das etapas 1, 3, 4, 5, **5.5**,
  6, **6.5**, 7, 7.5, 8, 8.5, 9, 9.5 e o resumo final; toda linha de log do run
  com `pipelineLogId`. · L
- [ ] **A4.04 — O portão de entrada mediu.** Evento 5.5 com `baseline: 'ok'`,
  `volume`, `median`, `volumeRatio`, `sources ≥ 3`, `freshestAgeHours < 24`. · L
- [ ] **A4.05 — O portão de saída mediu.** Evento 6.5 com `provider`, `chars`,
  `ptRatio` acima do dobro do piso, `urls: 0`, `findings: []`. · L
- [ ] **A4.06 — A saúde de cada fonte.** 13 linhas de `SourceHealth` hoje,
  `kept ≤ fetched` em cada uma, Σ`kept` = notícias com `createdAt` hoje,
  `latencyMs` presente, desfechos coerentes com os avisos da etapa 1. · L
- [ ] **A4.07 — A retenção apagou as sete linhas velhas**, e o evento da etapa 8
  as conta por tabela. · L
- [ ] **A4.08 — A renormalização limpou o HTML de A4.00c** (`textChanged ≥ 1`); no
  run seguinte, zero (ponto fixo). · L
- [ ] **A4.09 — As invariantes.** Evento 9.5 com `checked: 12`, as sete
  `retention.*` em `OK` depois do expurgo, `durationMs` bem abaixo de
  `budgetMs`. · L
- [ ] **A4.10 — As duas contas do `degradedBy` batem.** O resumo da etapa 9 = a
  derivação sobre os eventos gravados = o `degradedBy` da listagem
  (`/api/admin/pipeline/runs`), e o `outcome` casa. · L
- [ ] **A4.11 — O event loop não travou.** Latência máxima do `/api/health`
  durante o run < 5 s (o timeout do health check do Render); `lagMs.max` do
  `/api/metrics/http` anotado. · L
- [ ] **A4.12 — Idempotência que diz a verdade.** Clicar de novo →
  `already-succeeded-today` com a hora do run na tela; `AuditEvent` com esse
  `outcome` e **sem** `targetId`; nenhum run novo. · L
- [ ] **A4.13 — Run 2, degradado, sem gastar NewsData.** O run 1 marcado `FAILED`
  por SQL (anotado — é o que permite o re-disparo); API reiniciada com
  `GEMINI_API_KEY` e `NEWSDATA_API_KEY` com valor lixo; e, antes, as
  `BriefingSource` de um briefing antigo apagadas. Disparo **direto** (`JOB_SECRET`
  + `x-actor-id`) → Gemini recusa sem retry (não é transitório), Groq serve →
  `SUCCESS_DEGRADED` com `degradedBy: [1, 6]`; `ErrorEvent`
  `PIPELINE_STAGE_DEGRADED` em `stage-1` e `stage-6` (`upstream`); e
  `INVARIANT_VIOLATED · briefing.has_sources` — **sem** degradar o run por
  isso. · L
- [ ] **A4.14 — Run 3, o portão de entrada bloqueia, sem IA.** Os sete
  `DailyMetric` anteriores com `newsCollected: 5000` (backup antes, restaurado
  depois); run 2 marcado `FAILED` por SQL → `FAILED` com `errorStage: 5.5`,
  **nenhuma** chamada ao Gemini ou ao Groq no log, o `Article` de hoje intocado,
  `ErrorEvent` `PIPELINE_GATE_BLOCKED · ERROR · stage-5.5:volume ·
  upstream`. · L
- [ ] **A4.15 — Ensaio adversarial contra o Gemini de verdade.** Script de
  scratch chama `generateArticle` com material envenenado (a ordem **e** um link
  no título de um item) → anotar (a) se o modelo obedeceu, (b) o veredito do
  guarda; se houve URL: `GateBlockedError` de segurança, **o Groq não chamado**
  (sem a linha "falling back to Groq"). O bloqueio gravado pelo mesmo
  `logPipelineEvent` do pipeline → linha **`FATAL`** no `ErrorEvent` **sem esperar
  o flush**. No máximo duas chamadas de IA. · L
- [ ] **A4.16 — `gates:rehearse` sobre o banco depois dos runs** → os briefings dos
  runs 1 e 2 passam; nenhuma reprovação que não seja artefato de seed (e o
  artefato nomeado). · L

## M5 — As três abas, com o dado que o M2–M4 produziu (Fases 2, 5, 8, 11, 6, 7b, 9)

- [ ] **A5.01 — `admin:capture` 21/21, com a medição de largura**, e **cada
  imagem olhada** nos dois temas — a captura achou defeito sem sintoma de código
  em cinco fases seguidas; o código de saída não basta. · L
- [ ] **A5.02 — `/admin`: o arco e o ritmo do mês**, com as horas do
  `DailyUptime`; "Indisponível" nunca zero. · L
- [ ] **A5.03 — Os três desfechos do botão** — `started` (A4.01),
  `already-succeeded-today` (A4.12) e `already-running` (dois cliques
  seguidos) — cada um com a sua frase. · L
- [ ] **A5.04 — A faixa de 30 dias** com os runs do M4: hoje no desfecho do
  último run; o `FAILED` na 5.5 cheio vermelho; o degradado em contorno; os
  dias sem run vazados; o título "Degradado pelas etapas 1 e 6". · L
- [ ] **A5.05 — O batimento** "Último briefing há …" medido do último run que
  **produziu** briefing (não do run 3, que falhou). · L
- [ ] **A5.06 — O detalhe do run** expandido com as etapas 5.5 e 6.5 e os
  contextos; o run 3 com `errorStage` 5.5 e a mensagem do portão. · L
- [ ] **A5.07 — `/admin/metrics`:** KPI com variação; rosquinhas (o Groq aparece
  em provider); série por dia preenchida; sinais de ouro com a coluna **4xx**
  mostrando o 429 do A3.09; o painel "Fontes" com 13 linhas ordenáveis e os
  dois alertas do seed. · L
- [ ] **A5.08 — `/admin/security`:** a tabela com todas as falhas do M2–M4
  (busca "CONTENT_TYPE", filtro `authorization`, ordenação por ocorrências,
  `requestId` selecionável, link do run); o painel **Portões** com aprovação
  < 100 %, a rosquinha com `volume` (e o motivo do A4.15, se houve) e o alerta
  vermelho de URL se o A4.15 bloqueou; as **Invariantes** com a violação do
  A4.13 e o `detail`; a **Auditoria** com os disparos e a exclusão, só ids. · L
- [ ] **A5.09 — Nenhum polling.** Cada aba aberta por 3 min →
  `read_network_requests` sem requisição repetida a `/api/admin/*` (armadilha
  3). · L
- [ ] **A5.10 — O boundary de cliente (7b).** A rota `admin-metrics-error` do
  capture (`breakBff`) → a casca `error-state`, o relato **202 uma vez por
  montagem**, e a linha `WEB · CLIENT_ERROR · /[locale]/admin/metrics`. · L
- [ ] **A5.11 — O `digest` chega a um humano numa página `force-dynamic`.** Um
  `throw` guardado por variável de ambiente (nunca commitado) na
  `/admin/security` → "Referência do erro: <digest>" na tela e **o mesmo
  digest** no `context` da linha. · L
- [ ] **A5.12 — O `global-error.tsx`.** `throw` guardado por variável no layout
  de idioma → a tela de crash no **tema escuro** quando o tema salvo é escuro
  (armadilha 40), strings no idioma do caminho, relato enviado. · L
- [ ] **A5.13 — Teclado e leitor.** Cabeçalhos ordenáveis com `aria-sort`,
  alertas como `role="status"` (nunca `alert` sobre conteúdo), tabelas com nome
  acessível — pela árvore de acessibilidade (`read_page`). · L
- [ ] **A5.14 — A aba em inglês.** `/en/admin/security` com o painel Portões e
  os motivos traduzidos. · L

## M6 — A esteira (Fase 10)

- [ ] **A6.01 — Os seis workflows** (`ci`, `codeql`, `gitleaks`, `lighthouse`,
  `migrate`, `smoke`) com `permissions` no mínimo e todo `uses:` em SHA com o
  comentário da versão — lido nos arquivos, não só pela guarda. · C
- [ ] **A6.02 — O gate de advisories.** `pnpm audit --audit-level=high --prod`
  sai 0; a lista silenciada no `package.json` = a de
  `docs/security-advisories.md`; nenhuma linha com mais de 90 dias sem revisão
  (§16). · C
- [ ] **A6.03 — CodeQL.** Os alertas abertos na `main` contados; os sete
  `js/file-system-race` nomeados no item 82 decididos (corrigidos, ou dívida com
  gatilho). · C
- [ ] **A6.04 — Dependabot.** A configuração da `main` válida (a guarda) e os PRs
  chegando com base `dev` — os seis de 24/09 são a evidência. · C
- [ ] **A6.05 — Gitleaks.** O scan de PR varre > 0 commits; o do push de merge
  varre 0 (a dívida do §16) — medido de novo no merge desta fase. · C

## M7 — Produção (bloqueado até a API voltar, e pela decisão de promover)

> A API do Render está suspensa desde 19/09 (503 `x-render-routing: suspend`,
> reconferido em 24/09); pelo precedente de 29/08, as horas voltam no dia 1º. O
> build da Vercel falha de propósito com ela fora — **não se promove antes**.

- [ ] **A7.00 — A API voltou.** `/api/health` 200; o dono lê em Render → Billing
  as horas por serviço (a API e o `NetsheetEngine`) e anota. · P
- [ ] **A7.01 — Antes de promover.** `dev..main` = 0; nenhuma migration nova
  desde o #215 (conferido em 24/09: **nenhuma**); nenhuma env nova;
  `git ls-tree -r --name-only origin/main | git check-ignore --stdin` vazio. · P
- [ ] **A7.02 — A promoção (decisão do dono)** e os dois deploys de pé;
  Smoke E2E automático (31 passed, 6 skipped enquanto os segredos E2E não
  existirem — hoje o repositório só tem `DATABASE_URL`). · P
- [ ] **A7.03 — O ritual:** Lighthouse (medianas) e baseline visual. · P
- [ ] **A7.04 — `gates:rehearse` contra os retidos do Neon**, com o
  `DATABASE_URL` numa sessão só (o dono reautentica o `neonctl`) → **zero
  reprovações**; a distribuição de tamanho e de deriva calibra
  `MAX_ARTICLE_CONTENT_LENGTH` (p95 × 2) e `MAX_CATEGORY_DRIFT` (p95 real) — se
  mudar, PR com os números. · P
- [ ] **A7.05 — O primeiro run das 11:00 UTC depois da volta.** Espera-se
  **`baseline: 'insufficient'`** no evento 5.5 nos primeiros dias — a suspensão
  apagou a série de `DailyMetric` desde 19/09, e o portão de volume não opina
  sem três dias com briefing na janela (armadilha 24, agora em produção); as
  duas etapas de portão `INFO`; a `SourceHealth` do dia; as invariantes, com
  `briefing.one_per_day` **violada** pelos dias da suspensão (o `detail` nomeia
  as datas). · P
- [ ] **A7.06 — A primeira leitura das três abas com a sessão ADMIN do dono.**
  O dono entra (o agente nunca digita credencial); o agente lê e confere cada
  painel contra o banco: o arco das horas contra o número do Billing (o gatilho
  do §16 do heartbeat), as 13 fontes reais, as invariantes do run das 11:00, os
  Portões, as falhas das sondas (`AUTH_TOKEN_INVALID` do smoke), a trilha. · P
- [ ] **A7.07 — O #231 no ar.** Duas regenerações da `/about` com payload RSC
  idêntico; os dois sitemaps com contagem estável; e, se a API cair de novo, o
  documento anterior mantido (5xx na revalidação). · P
- [ ] **A7.08 — A cota de imagem.** Sonda numa imagem em `MISS` (nunca `HIT`). · P

## M8 — Fechamento

- [ ] **A8.01 — Toda linha acima com status e evidência.** · —
- [ ] **A8.02 — Todo `[!]` virou PR mergeado com guarda, ou dívida no §16.** · —
- [ ] **A8.03 — Item 85 do `docs/progress.md`**, a §22 do plano marcada ✅, o topo
  do `CLAUDE.md`, a memória. · —
