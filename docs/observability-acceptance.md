# Matriz de aceitação do plano de observabilidade

> **A Fase 12 do `docs/Newra-News-Observability-Plan.md` (§22) preenche este
> arquivo.** Uma linha por coisa que o plano entregou, com o jeito de provocá-la
> ao vivo e o observável que prova que ela funciona. A fase termina quando
> **toda linha tem status e evidência** — nunca antes.
>
> Aberto em 24/09/2026 sobre `a0ae0fc` (a `dev` com o #233). Branch
> `observability/fase-12-acceptance`. **Revisado no mesmo dia, antes do M0**
> (§22, "A revisão da proposta"): a matriz foi conferida linha a linha contra o
> código e 25 inconsistências foram corrigidas aqui — sete linhas que não
> podiam sair como estavam escritas, expectativas que reprovariam sem defeito,
> onze guardas fora do M1, dois `code` sem linha, e o M7 dividido entre o que
> espera o Render e o que não espera. A `dev` foi trazida para a branch no
> merge `00f046b` (a triagem do Dependabot e o #241).

## Como ler e preencher

- **Status:** `[ ]` pendente · `[x]` provado · `[!]` achou defeito (a linha diz o
  PR que corrigiu e a guarda que nasceu) · `[~]` bloqueado (a linha diz por quê
  e qual gatilho o destrava).
- **Ambiente:**
  - **L** = local — Postgres do Docker, API e web em dev, chaves reais de
    provider. **A API do L é a do repositório, na sua máquina: não depende do
    Render.**
  - **C** = CI/GitHub.
  - **N** = o **branch do Neon** filho de `production` (dado real até 19/09),
    lido pela API e pelo web **locais** — produção não é tocada, porque toda
    escrita da API local vai para o branch. Só exige o dono reautenticar o
    `neonctl`.
  - **P** = produção no ar (Render + Vercel).
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
  `git rev-list --count origin/dev..origin/main` = 0 (era 0 em 24/09); a branch
  0 commits atrás da `dev`. · L
- [ ] **A0.02 — O alvo é um commit fixo.** A triagem dos seis PRs do Dependabot
  (**abertos em 21/09**, não 24/09) foi feita em 24/09: #234, #235, #239 e
  #240 mergeados na `dev` (o #240 substituiu o #236, que o robô fechou ao
  pedido de rebase); o #238 substituído pelo **#241** (dotenv 18 carregado em
  silêncio — a 18 escrevia `◇ injected env` no stderr a cada boot) e fechado
  pelo robô. **O #237 (`@vitest/coverage-v8` 5, exige vitest 5) fica aberto
  de propósito:** o `ignore` dele vai ao `.github/dependabot.yml` **da
  `main`**, e hoje todo push na `main` dispara o Smoke E2E (reprova com a API
  fora), o build de produção da Vercel e um deploy no Render — vai no A7.11.
  Com o PR aberto o robô o atualiza e não abre outro. **Anotar aqui o SHA da
  branch no início do M0** — é ele que o ensaio mede. · C
- [ ] **A0.03 — A suíte na contagem, não no pass/fail.** `pnpm test` com **1.389
  na API (92 arquivos) e 904 no web (89)** — o número de 24/09, depois do #241;
  `pnpm lint` e `pnpm turbo typecheck` verdes. O sintoma de clone mal montado é
  verde com número menor (§19). · L
- [ ] **A0.04 — O banco local no estado conhecido.** Docker de pé (se cair no
  boot, a receita do `.sock` órfão está na memória: matar `*docker*`, renomear
  `Docker\run` e `docker-secrets-engine` de uma vez, subir uma vez);
  `docker compose -f docker-compose.yml up -d --wait postgres`; seed rodado,
  **com a data anotada**; **contagem de toda tabela do schema** — a lista sai
  dos `model` do `schema.prisma` pelo script, não digitada (a lista antiga
  tinha 11 e deixava de fora `User`, `Favorite`, `UserPreference`,
  `Subscriber` e `NewsletterLog`). É o "antes" de tudo. **O seed é ancorado no
  dia em que roda**, e três coisas dele pesam no M4: um run `SUCCESS` hoje às
  11:05 UTC, a `DailyMetric` de 30 dias com o buraco do dia bloqueado
  (`daysAgo` 2) e a Superinteressante em `FAILED` nos dias 0–2 da
  `SourceHealth`. **Capturar os dois alertas do painel "Fontes" aqui**, antes
  de o run real reescrever as linhas de hoje (A5.07). · L
- [ ] **A0.05 — As chaves existem, sem aparecer.** Um script que lê os dois
  arquivos de ambiente e imprime **só** sim/não para cada chave, e
  igual/diferente para os pares — nunca um valor.
  - **API** (`apps/api/.env`): `DATABASE_URL`, `GEMINI_API_KEY`,
    `GROQ_API_KEY`, `NEWSDATA_API_KEY`, `RESEND_API_KEY`, `JOB_SECRET`,
    `AUTH_JWT_SECRET`.
  - **Web** (`apps/web/.env.local`): `NEXTAUTH_SECRET` (a captura exige que
    seja **diferente** do de produção), `AUTH_JWT_SECRET` (**igual** ao da
    API), `CRON_SECRET`, `BACKEND_JOB_URL`, `BACKEND_JOB_SECRET` (**igual** ao
    `JOB_SECRET` da API) — o botão do A4.01 atravessa BFF → cron → API e
    precisa dos três.
  - Sem Gemini e Groq, o M4 inteiro fica `[~]`. · L
- [ ] **A0.06 — O navegador da captura.** `CHROMIUM_PATH` apontando para o
  `chromium_headless_shell-<rev>` instalado se o Playwright pedir outra revisão
  (em 20/09 pediu a 1243 com a 1234 instalada; em 24/09 estavam instaladas a
  1208 e a 1234). · L
- [ ] **A0.07 — O cron interno neutralizado.** O `server.ts` registra o job do
  pipeline **sempre**, às 08:00 de São Paulo (11:00 UTC), sem interruptor: com
  a API local de pé nesse horário, um run real dispara — gasta NewsData e IA
  fora do orçamento do M4 e ocupa o "hoje" do A4.01. Durante toda a fase a API
  local sobe com `CRON_SCHEDULE="0 3 1 1 *"` (variável da sessão, nunca no
  `.env` commitado). Evidência: a linha de boot
  `[cron] registered, schedule: 0 3 1 1 *`. · L

## M1 — As guardas reprovam quando devem

> O plano criou ou estendeu **35 guardas** — as 24 da lista original e **11 que
> a revisão de 24/09 achou fora dela** (A1.25–A1.35), inclusive a da fiação do
> logger, que é a lição "a guarda pode estar certa e não guardar nada". Cada
> fase viu as **suas** reprovarem uma vez; este marco as vê **todas juntas,
> sobre a árvore final**, por um script versionado — a primeira vez que "a
> guarda reprova" vira comando repetível. É o eixo **T** da §28 da V2.
>
> **Por que um script próprio e não o Stryker:** o Stryker insere **todos** os
> mutantes no código de uma vez, com um interruptor `global.activeMutant` em
> tempo de execução (*mutant schemata*). Uma guarda que **lê o arquivo-fonte**
> veria o código instrumentado, e metade das mutações daqui é em YAML,
> Markdown e Mermaid, que ele não muta. A mutação aqui é **texto**, e tem de
> ser.

- [ ] **A1.00 — `scripts/guard-mutations.mjs` existe e se vê falhando.**
  - Tabela de mutações `{ id, arquivo, trecho, troca, pacote, arquivo de teste,
    teste esperado }`.
  - Para cada uma: confere que o arquivo está limpo no git, **copia o original
    para o scratchpad** (um `finally` não roda se o processo for morto no
    Windows), aplica a troca **exigindo que o trecho ocorra exatamente uma
    vez** (mutação que não aconteceu é falha do script — o CRLF do 5b fez uma
    "passar verde"), roda só aquele arquivo de teste e restaura em `finally`.
    Um modo `--restore` devolve os originais do scratchpad.
  - **O resultado sai de `--reporter=json --outputFile=<scratchpad>`**, e não
    do stdout: no vitest 2 o JSON vai para o terminal misturado com o
    `console.*` dos testes. Lê `numFailedTests` e o **nome** do teste que
    reprovou, e o compara com o esperado — reprovar por erro de import ou
    por outro teste não prova a guarda.
  - **Cobertura derivada, não digitada:** o script lista os arquivos de teste
    que leem fonte (`ts.createSourceFile`, `readFileSync`, `readdirSync`) e
    reprova se algum não estiver na tabela nem numa lista de exclusão **com
    motivo** (as guardas da V2 fora do plano). Foi uma lista digitada que
    deixou onze guardas de fora.
  - Imprime a tabela `id · reprovou? · teste`. Visto falhando: uma mutação
    inócua (comentário) tem de sair "NÃO reprovou". · L
- [ ] **A1.01..A1.35 — Cada mutação abaixo reprova a guarda indicada.** · L

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
| A1.11 | `tests/security/authorization-matrix.test.ts` | tirar a chamada `requireAdmin(request);` do `preHandler` de `routes/admin/index.ts` — **esse trecho**: a palavra `requireAdmin` ocorre três vezes no arquivo (import e comentário) |
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
| A1.25 | `tests/security/server-hardening.test.ts` | `logger: baseLogger,` → `logger: true,` no `app.ts` — o serializer certo sem ninguém ligado a ele |
| A1.26 | `tests/config/load-env-file.test.ts` | `config({ quiet: true })` → `config({ quiet: false })`; o `env.ts` de volta ao `import 'dotenv/config'` |
| A1.27 | `tests/security/pii-in-logs.test.ts` | um campo a mais no contexto do evento `'Daily newsletter sent'` da etapa 7.5 |
| A1.28 | `tests/services/audit.service.test.ts` | uma ação nova em `AUDIT_ACTIONS` sem quem a grave |
| A1.29 | `tests/services/source-health.test.ts` | a escrita de `recordSourceHealth` virando um laço de `upsert` fora da transação |
| A1.30 | `tests/services/uptime.service.test.ts` | tirar o `app.register(uptimeHeartbeatPlugin)` do `server.ts` |
| A1.31 | `tests/utils/request-route.test.ts` | um literal `'unmatched'` solto em `plugins/observability.ts` |
| A1.32 | `tests/security/client-error-ingest.test.ts` | `max: 10` → `max: 1000` no `routes/errors/index.ts` |
| A1.33 | `tests/routes/api-docs-drift.test.ts` | tirar a seção `### GET /api/admin/invariants` da `docs/api.md` |
| A1.34 | web `tests/lib/trust-boundary.test.ts` | uma chamada a `signAuthJwt` em `lib/log-server-error.ts` (um redator, não um signatário) |
| A1.35 | web `tests/lib/bff-seam.test.ts` | tirar o `signal: AbortSignal.timeout(API_TIMEOUT_MS)` do `fetch` de `app/api/events/route.ts` |

## M2 — O log e a taxonomia, ao vivo (Fases 1, 3, 7a)

> API em dev com `LOG_LEVEL=info` e o `CRON_SCHEDULE` do A0.07, stdout **e
> stderr** capturados num arquivo do scratchpad. Tudo pela **porta real**
> (`curl`/socket), nunca `inject` — o `inject` não passa pelo parser HTTP
> (lição da Fase 3). Tokens de teste assinados por um script de scratch com o
> `AUTH_JWT_SECRET` local.
>
> **Toda resposta 4xx gera duas linhas `warn`**: a do `AppError` (com o `code`)
> e a de acesso (`request completed`, nível pelo status). **O balde global é de
> 100/min por IP**, e todo pedido local sai de `127.0.0.1` — rajadas do M2 e
> do M3 no mesmo minuto se somam.

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
  `GET /api/nao-existe` → 404 `{ "error": … }` sem ecoar o caminho. A linha do
  `AppError` é `debug` e **não aparece** em `info`; **aparece** a linha de
  acesso `warn` (`request completed`, `route: 'unmatched'`, `statusCode: 404`)
  — todo 4xx a tem. · L
- [ ] **A2.10 — `ACTOR_ID_INVALID`.** Secret certo + `x-actor-id: lixo` → 400,
  linha `error` (`internal` num 400), pipeline **não** disparado. · L
- [ ] **A2.11 — `AUTH_SUBJECT_MISMATCH`.** `POST /api/auth/upsert` com token de
  `purpose: auth-upsert` do e-mail A e corpo com o e-mail B → 401, `warn`. · L
- [ ] **A2.12 — `AUTH_SESSION_INCOMPLETE`.** Token assinado sem `sub`/`email` →
  401, linha `error`. · L
- [ ] **A2.13 — `AUTH_NOT_CONFIGURED`.** API reiniciada com `AUTH_JWT_SECRET`
  vazio (o schema o aceita: `optional()`) → todo token 401, linha **`error`**
  (a categoria vence o status). · L
- [ ] **A2.14 — `UNHANDLED`: o 500 cru.** Postgres parado → `GET /api/news` →
  500 com a frase fixa e `x-request-id`; linha `error` com o `err` serializado
  (host da DSN, sem senha). · L
- [ ] **A2.15 — `/api/health/providers` diz "por quê" no log.** Com Bearer do
  `JOB_SECRET` (a rota passa por `assertJobSecret`) e `GEMINI_API_KEY` lixo →
  status `invalid` na resposta (contrato intacto) e a razão no log, **sem a
  URL da sonda**. · L
- [ ] **A2.16 — O BFF escreve a falha (7a).** API parada, web de pé, uma linha
  JSON no stderr do web por rota, com o `scope`, o `cause` com `ECONNREFUSED`
  e nenhum valor de segredo:
  - `/api/admin/errors` (com sessão) → `bff.proxy`;
  - `/api/events` → `bff.events`;
  - `/api/errors/client` → `bff.errors.client`;
  - `/news-sitemap.xml` → `bff.news-sitemap`;
  - `/api/cron/daily-news` → **`cron.daily-news`** (não é `bff.*`), com
    `warmed: false` e o Bearer redigido. Demora ~50 s: o `warmApi` tenta duas
    vezes, com 25 s cada. · L
- [ ] **A2.17 — `bff.proxy.sign`.** Web com `AUTH_JWT_SECRET` vazio → a rota de
  conta loga a falha de assinatura **e relança** (o status não muda). · L
- [ ] **A2.18 — O boot só escreve JSON.** Do spawn da API até a primeira
  requisição, **toda** linha de stdout e stderr parseia como JSON — o dotenv 18
  escrevia `◇ injected env (N) from .env` fora do formato, e foi o #241 que o
  calou. · L

## M3 — O registro durável (Fases 4, 7c, 5b)

- [ ] **A3.01 — As falhas do M2 viram linhas em ≤ 30 s.** `ErrorEvent` com um
  fingerprint por falha distinta (`API:WARN:AUTH_TOKEN_INVALID:/api/account`, …),
  `category` e `severity` certas, `firstRequestId`/`lastRequestId`. · L
- [ ] **A3.02 — Coalescimento.** 50 × o mesmo 401 num laço → **uma** linha com
  `count` somando 50 na hora. O laço fica abaixo do balde global de 100/min
  (a 101.ª do minuto seria 429, não 401). · L
- [ ] **A3.03 — `debug` não vira linha.** Nenhuma linha de `NOT_FOUND`. · L
- [ ] **A3.04 — O banco fora, e o preço escrito.** O flush roda de 30 em 30 s
  **contados do boot** e esvazia o buffer **antes** de ir ao banco. Falhas
  acontecendo com o Postgres parado → o primeiro tique com o banco fora escreve
  `warn` `[error-event] failed to persist` e aquelas ocorrências se perdem (é o
  documentado); as que chegarem **depois** desse tique e antes de o banco
  voltar persistem no primeiro tique seguinte. O que decide é o tique cair ou
  não na janela, não a duração do apagão. · L
- [ ] **A3.05 — O flush do desligamento, com prazo.** Falhas acumuladas e
  **Ctrl+C na API** → as linhas persistidas; com o Postgres parado, o processo
  sai em ~2 s (`ERROR_EVENT_CLOSE_TIMEOUT_MS`), sem pendurar. **O Ctrl+C é do
  dono, num terminal com a API em primeiro plano:** no Windows,
  `process.kill(pid, 'SIGINT')` termina o processo **incondicionalmente**
  (documentação do Node), o `kill` do Git Bash também, e o `preview_stop` não
  manda sinal — nenhuma ferramenta do agente produz um SIGINT de verdade. O
  agente lê o resultado no log e no banco. · L
- [ ] **A3.06 — `GET /api/admin/errors`.** `24h` e `7d`: grupos por
  fingerprint, `byCategory` com **as seis** categorias na ordem da taxonomia,
  `since` alinhado à hora cheia (item 65), `truncated: false`. · L
- [ ] **A3.07 — O relato do cliente (7c).** Pelo BFF,
  `POST /api/errors/client` `{ message, digest, path: '/pt-BR/news/<uuid>' }` →
  **202** `{ accepted: true }`; depois do flush, linha `WEB · CLIENT_ERROR ·
  /[locale]/news/[id]` com `digest` e `path` no `context`. · L
- [ ] **A3.08 — Caminho desconhecido vai para `unmatched`.** · L
- [ ] **A3.09 — O balde de 10/min atravessa o BFF.** O 11.º relato no minuto →
  **429** no navegador; o buffer não ganha a 11.ª ocorrência. **O balde é um só
  para o site**: A3.07, A3.08, A3.10 e A3.15 gastam dele — contar os pedidos,
  ou esperar o minuto virar entre as linhas. · L
- [ ] **A3.10 — O corpo é lista de permissão.** `userId`, `email` e `stack` no
  corpo → nenhum deles no `context`. · L
- [ ] **A3.11 — O 4xx por rota (armadilha 39).** `GET /api/metrics/http` tem a
  linha `POST /api/errors/client` com `clientErrorRate > 0` depois do A3.09.
  **A métrica é em memória e zera a cada reinício da API** — ler aqui, na
  mesma vida do processo. · L
- [ ] **A3.12 — Saturação e horas do plano (5b).** Com a API de pé > 10 min, a
  linha de hoje do `DailyUptime` cresce ~300 s por tique; `saturation.plan.hoursUsed`
  = soma do mês / 3600; `eventLoop.lagMs.p50` ≈ 0 em repouso (sem a resolução do
  timer). · L
- [ ] **A3.13 — A rota em memória responde com o banco fora (item 65).**
  Postgres parado → `GET /api/metrics/http` **200**, com `saturation.plan: null`
  e memória/event loop presentes. · L
- [ ] **A3.14 — Auditoria de exclusão.** Excluir uma notícia pela `/admin` →
  `AuditEvent` `news.deleted` com `actorId` (nunca e-mail) e `targetId`. · L
- [ ] **A3.15 — O visualizador do log não executa o que a porta anônima
  escreve.** O OWASP lista como consequência de *log injection* o XSS "à espera
  de ser visto num visualizador vulnerável" e a linha forjada por quebra de
  linha — e aqui a porta anônima (`/api/errors/client`) grava texto que o admin
  lê na `/admin/security`. Um relato com `message` contendo
  `<img src=x onerror=alert(1)>` e uma quebra de linha seguida de uma linha JSON
  falsa → **o relato não escreve a mensagem no stdout** (vai direto ao buffer
  do `ErrorEvent`; só a linha de acesso sai, com a rota), então a forja de
  linha não tem onde acontecer ali; no banco, a `message` guardada com a quebra
  e as tags como caracteres; na tabela, o texto literal (A5.15). · L
- [ ] **A3.16 — `AUDIT_WRITE_FAILED`: a auditoria falha e a ação não.** Por SQL
  no banco local, a tabela `AuditEvent` renomeada (anotado; desfeito no fim) →
  excluir uma notícia pela `/admin` → a exclusão responde sucesso **e** nasce
  a linha `API · ERROR · AUDIT_WRITE_FAILED · news.deleted`. É um dos 18
  códigos gravados, e o único que a matriz não provocava. · L
- [ ] **A3.17 — `INTERNAL`: o contrato quebrado entre quem grava e quem lê.**
  Por SQL, o `context` do último evento da etapa 9.5 corrompido (anotado) →
  `GET /api/admin/invariants` → 500 com a frase fixa, e a linha
  `API:ERROR:INTERNAL:/api/admin/invariants` com `category: contract` — nunca
  "nenhuma verificação ainda". O `INTERNAL` é o default do `AppError`, e só o
  `Invariant report is malformed` o produz sem nome próprio. · L
- [ ] **A3.18 — A falha do próprio registro não vira segunda falha.** O OWASP
  manda testar "erros de execução no próprio módulo de log". Um `throw`
  guardado por variável de ambiente (nunca commitado) dentro do
  `fingerprintFor` → a requisição que falhou responde o status de sempre, e o
  log ganha `warn` `[error-event] failed to buffer`. **Não no
  `scrubErrorContext`:** o serializer de `err` do logger também o chama, e o
  `throw` quebraria o próprio log em vez de o registro. · L

## M4 — O pipeline de ponta a ponta, com provedores reais (Fases 2, 8, 11, 6, 9)

> **Orçamento: no máximo três runs**, e só o primeiro consome a NewsData; **no
> máximo três chamadas de IA no ensaio adversarial** (A4.15). Antes do run 1, o
> terreno é preparado por SQL no banco local e anotado aqui. Durante todo run,
> um laço em segundo plano bate no `/api/health` a cada segundo e grava a
> latência (é o teste do incidente de 03/09). **O cron interno está
> neutralizado (A0.07).**
>
> **Os três runs caem no mesmo dia UTC, e isso tem duas consequências:** o
> `Article` é um por dia (`date @unique`, e a etapa 7 faz `upsert` — o run 2
> sobrescreve o briefing do run 1), e a faixa de 30 dias mostra **um** desfecho
> por dia, o do último run (`outcomeByDay`).

- [ ] **A4.00 — Preparação, anotada.**
  - (a) uma linha velha em cada uma das **sete** tabelas que a etapa 8 expurga
    (`News` 31 d, `PipelineLog` 31 d, `Article` 91 d, `ProductEvent` 91 d,
    `ErrorEvent` 15 d, `AuditEvent` 366 d, `SourceHealth` 91 d);
  - (b) um `PipelineLog` `RUNNING` de 20 min atrás;
  - (c) uma `News` com HTML no `content`;
  - (d) a janela de 7 dias de `DailyMetric` com `articleGenerated` (linha de
    base). **O `newsByCategory` do seed é sintético** (WORLD 31,5 %) e o
    acervo real é muito mais WORLD: a deriva pode passar de 0,5 e o portão
    **avisar**, deixando o "run limpo" degradado pela 5.5. Ou a distribuição
    dos sete dias é trocada pela de uma colheita real (anotada), ou o
    `category-drift` fica registrado aqui como **esperado**;
  - (e) **se o M4 cair no mesmo dia UTC do seed:** o run `SUCCESS` que o seed
    cria hoje às 11:05 marcado `FAILED`. Sem isso o botão devolve
    `already-succeeded-today`, e o `findFirst` do `triggerPipeline` — que não
    tem `orderBy` — escolhe por acaso entre ele e o `RUNNING` de (b);
  - (f) a contagem de `News` com `createdAt` de hoje **antes** do run (o seed
    rodado hoje e a linha de (c) entram nela). · L
- [ ] **A4.01 — Run 1, limpo, pelo botão.** "Executar agora" na `/admin` local
  (sessão forjada pela mecânica do `capture-admin.mjs`, num script de scratch) —
  BFF → `/api/cron/daily-news` → API. Tela: "disparado" com a hora; banco:
  `AuditEvent` `pipeline.triggered` com o `actorId` da sessão, `targetId` = o run,
  `outcome: started`. **Clicar de novo com o run em curso** →
  `already-running` na tela e no `AuditEvent` — é o único jeito de ver esse
  desfecho sem um quarto run. · L
- [ ] **A4.02 — O cadáver foi enterrado.** O `RUNNING` de A4.00b virou `FAILED`
  com `errorStage` **nulo**, evento de etapa 0 `ERROR`, e `ErrorEvent`
  `PIPELINE_STAGE_FAILED · stage-0` com o id **do run morto**. · L
- [ ] **A4.03 — As 14 etapas anunciam.** Eventos das etapas 1, 3, 4, 5, **5.5**,
  6, **6.5**, 7, 7.5, 8, 8.5, 9, 9.5 e o resumo final (a etapa 2 não grava
  evento); toda linha de log do run com `pipelineLogId`. · L
- [ ] **A4.04 — O portão de entrada mediu.** Evento 5.5 com `baseline: 'ok'`,
  `volume`, `median`, `volumeRatio`, `sources ≥ 3`, `freshestAgeHours < 24` — e
  o `category-drift` conforme a decisão do A4.00d. · L
- [ ] **A4.05 — O portão de saída mediu.** Evento 6.5 com `provider`, `chars`,
  `ptRatio` acima do dobro do piso, `urls: 0`, `findings: []`. · L
- [ ] **A4.06 — A saúde de cada fonte.** 13 linhas de `SourceHealth` hoje,
  `kept ≤ fetched` em cada uma, **Σ`kept` = `News` de hoje depois do run − a
  contagem do A4.00f**, `latencyMs` presente, desfechos coerentes com os avisos
  da etapa 1. · L
- [ ] **A4.07 — A retenção apagou as sete linhas velhas**, e o evento da etapa 8
  as conta por tabela. · L
- [ ] **A4.08 — A renormalização limpou o HTML de A4.00c** (`textChanged ≥ 1`); no
  run seguinte, zero (ponto fixo). · L
- [ ] **A4.09 — As invariantes.** Evento 9.5 com `checked: 12`, as sete
  `retention.*` em `OK` depois do expurgo, `durationMs` bem abaixo de
  `budgetMs`. **Esperado, não achado:** `briefing.one_per_day` **violada** — o
  seed deixa o dia bloqueado (`daysAgo` 2) sem briefing de propósito, e os
  dias entre o seed e o M4, se houver, também —, com a linha `INVARIANT ·
  WARN · INVARIANT_VIOLATED · briefing.one_per_day` e **sem** degradar o run.
  `newsletter.delivered` em `OK` (o seed não cria assinante). · L
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
  `BriefingSource` de um briefing **dos últimos 7 dias** apagadas (é a janela
  de `briefing.has_sources`; um mais velho não seria visto). Disparo **direto**
  (`JOB_SECRET` + `x-actor-id`) → Gemini recusa sem retry (4xx não é
  transitório — só 429 e 5xx são), Groq serve → `SUCCESS_DEGRADED` com
  `degradedBy: [1, 6]`; `ErrorEvent` `PIPELINE_STAGE_DEGRADED` em `stage-1` e
  `stage-6` (`upstream`); e `INVARIANT_VIOLATED · briefing.has_sources` —
  **sem** degradar o run por isso. O briefing de hoje passa a ser o do Groq. · L
- [ ] **A4.14 — Run 3, o portão de entrada bloqueia, sem IA.** Os sete
  `DailyMetric` anteriores com `newsCollected: 5000` (backup antes, restaurado
  depois); run 2 marcado `FAILED` por SQL → `FAILED` com `errorStage: 5.5`,
  **nenhuma** chamada ao Gemini ou ao Groq no log, o `Article` de hoje intocado,
  `ErrorEvent` `PIPELINE_GATE_BLOCKED · ERROR · stage-5.5:volume ·
  upstream`. A conta fecha: ~600 contra a mediana de 5.000 dá 0,12, abaixo do
  piso `MIN_VOLUME_RATIO` de 0,3. · L
- [ ] **A4.15 — Ensaio adversarial contra o Gemini de verdade, nos dois
  destinos.** Script de scratch chama `generateArticle` com material
  envenenado, e o bloqueio é gravado pelo mesmo `logPipelineEvent` do pipeline
  — **sobre um `PipelineLog` criado para o ensaio** (o evento tem chave
  estrangeira para o run), com o script esperando a escrita antes de sair.
  - **Segurança** (a ordem **e** um link no título de um item) → anotar se o
    modelo obedeceu e o veredito do guarda; se houve URL: `GateBlockedError`,
    **o Groq não chamado** (sem a linha "falling back to Groq") e a linha
    **`FATAL`** no `ErrorEvent` **sem esperar o flush**. Uma chamada de IA.
  - **Qualidade** (o material pede o texto em espanhol) → se o modelo
    obedecer: `language` recusa o Gemini, o Groq é chamado **uma vez**, e a
    linha é `PIPELINE_GATE_BLOCKED · WARN · stage-6.5:language · contract`
    (qualidade que o Groq recuperou). É o caminho central da §13.2, que nenhum
    teste ao vivo exercitava. Até duas chamadas de IA. · L
- [ ] **A4.16 — `gates:rehearse` sobre o banco depois dos runs** → o briefing de
  hoje (o do run 2 — o do run 1 foi sobrescrito) e os semeados passam; nenhuma
  reprovação que não seja artefato de seed (e o artefato nomeado). · L

## M5 — As três abas, com o dado que o M2–M4 produziu (Fases 2, 5, 8, 11, 6, 7b, 9)

- [ ] **A5.01 — `admin:capture` 21/21, com a medição de largura**, e **cada
  imagem olhada** nos dois temas — a captura achou defeito sem sintoma de código
  em cinco fases seguidas; o código de saída não basta. (21 = 5 rotas × 2
  larguras × 2 temas + `admin-en`.) · L
- [ ] **A5.02 — `/admin`: o arco e o ritmo do mês**, com as horas do
  `DailyUptime`; "Indisponível" nunca zero. · L
- [ ] **A5.03 — Os três desfechos do botão, cada um com a sua frase** —
  `started` e `already-running` (os dois cliques do A4.01) e
  `already-succeeded-today` (A4.12), fotografados **na hora do clique**: a
  frase é resposta ao clique, não estado da página. · L
- [ ] **A5.04 — A faixa de 30 dias.** Uma célula por dia UTC, com o desfecho do
  **último** run do dia: hoje é o `FAILED` do run 3, **cheio vermelho** com a
  etapa 5.5 no título; o contorno de degradado vem dos dias **semeados** (os
  de fallback do seed, `daysAgo` múltiplo de 5); os dias sem run, vazados. O
  run 2 degradado **não tem célula própria** — ele aparece na lista de runs e
  no detalhe (A5.06). O alerta "Degradado pela etapa N há 3 execuções
  seguidas" fica calado, porque o último dia decidido é `FAILED`. · L
- [ ] **A5.05 — O batimento** "Último briefing há …" medido do último run que
  **produziu** briefing (o run 2, não o run 3, que falhou). · L
- [ ] **A5.06 — O detalhe do run** expandido com as etapas 5.5 e 6.5 e os
  contextos; o run 2 com "Degradado pelas etapas 1 e 6"; o run 3 com
  `errorStage` 5.5 e a mensagem do portão. · L
- [ ] **A5.07 — `/admin/metrics`:**
  - KPI com variação; rosquinhas (o Groq aparece em provider); série por dia
    preenchida.
  - Sinais de ouro com a coluna **4xx** mostrando um 429 **provocado de novo
    depois do último reinício da API** — a métrica é em memória e o A4.13
    reiniciou a API, então o 429 do A3.09 não existe mais.
  - O painel "Fontes" com 13 linhas ordenáveis, e os alertas **que as linhas
    reais dizem**: o run 1 reescreveu a `SourceHealth` de hoje, então a
    Superinteressante semeada em falha nos dias 0–2 perde a sequência se a
    colheita real a trouxe `OK` (em 16/09 as 13 vieram `OK`). O "antes" é a
    captura do A0.04. · L
- [ ] **A5.08 — `/admin/security`:**
  - A tabela com todas as falhas do M2–M4 (busca "CONTENT_TYPE", filtro
    `authorization`, ordenação por ocorrências, `requestId` selecionável, link
    do run).
  - O painel **Portões** com aprovação < 100 %, a rosquinha com `volume` (e os
    motivos do A4.15, se houve) e o alerta vermelho de URL se o A4.15
    bloqueou.
  - As **Invariantes** do último relatório, que é o do run 2 (o run 3 parou na
    5.5 e não chega à 9.5): **duas** violações, `briefing.one_per_day` (o
    seed) e `briefing.has_sources` (A4.13), cada uma com o `detail`.
  - A **Auditoria** com os disparos e a exclusão, só ids. · L
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
- [ ] **A5.15 — O payload do A3.15 na tabela é texto.** A linha do relato
  mostra `<img src=x onerror=alert(1)>` **como caractere**: a árvore de
  acessibilidade tem o texto e nenhum elemento `img` novo, e nenhum diálogo
  abre. (A defesa esperada é o React escapar — não há `dangerouslySetInnerHTML`
  no admin; a linha prova, não supõe.) · L

## M6 — A esteira (Fase 10)

- [ ] **A6.01 — Os seis workflows** (`ci`, `codeql`, `gitleaks`, `lighthouse`,
  `migrate`, `smoke`) com `permissions` no mínimo e todo `uses:` em SHA com o
  comentário da versão — lido nos arquivos, não só pela guarda. · C
- [ ] **A6.02 — O gate de advisories.** `pnpm audit --audit-level=high --prod`
  sai 0; a lista silenciada no `package.json` = a de
  `docs/security-advisories.md`; nenhuma linha com mais de 90 dias sem revisão
  (§16). · C
- [ ] **A6.03 — CodeQL: os alertas abertos, contados e decididos.** Em 24/09 a
  `main` tinha **10** abertos e a `dev` **11** — e não os "sete" que esta linha
  citava. Cada um sai corrigido com guarda, ou dívida com gatilho:
  - **7 × `js/file-system-race`** (testes; os do item 82);
  - **`js/regex/missing-regexp-anchor`** (web `tests/security/image-optimizer.test.ts:118`)
    e **`js/incomplete-sanitization`** (web `tests/lib/i18n-messages.test.ts:86`)
    — testes;
  - **`js/incomplete-multi-character-sanitization`, produção**
    (`providers/news/feed-text.ts:143`, aberto desde 05/09): o `htmlToText`
    tira as tags e **depois** decodifica as entidades, então um `&lt;script&gt;`
    do feed volta a `<script>`. Hoje nenhum consumidor renderiza o texto como
    HTML (o React escapa; a newsletter escapa antes de enviar) — o gatilho
    natural é o primeiro que renderizar;
  - **`js/polynomial-redos`, produção, só na `dev`**
    (`utils/redact.ts:33`, o `EMAIL_PATTERN`): aberto em **24/09**, com o
    arquivo parado desde 05/09 — o gatilho provável é o bump do CodeQL (#235),
    não código novo. Quadrático, não exponencial; a entrada anônima que o
    alcança (a `message` do `/api/errors/client`) tem teto de 300
    caracteres. · C
- [ ] **A6.04 — Dependabot.** A configuração da `main` válida (a guarda) e os PRs
  chegando com base `dev` — os seis de **21/09** são a evidência, e a triagem
  está no A0.02. · C
- [ ] **A6.05 — Gitleaks.** O scan de PR varre > 0 commits; o do push de merge
  varre 0 (a dívida do §16) — medido de novo no merge desta fase. · C

## M7a — Produção sem o Render (dá para fazer agora)

> **O que precisa do dono, e mais nada:** `npx neonctl@latest auth` (a sessão
> do `neonctl` expirou em 19/09, e ele não está no PATH do Bash — o `npx`
> resolve) e a leitura do painel do Render. **O agente nunca digita nem imprime
> credencial**: a string de conexão do branch vai para uma variável da sessão,
> que o agente usa sem ler.
>
> **O branch copia dado pessoal** (`User`, `Subscriber`) para outro endereço do
> mesmo projeto Neon e para o processo local. Nenhuma tela do admin mostra
> e-mail; a decisão de usar o branch é do dono, e ele é apagado no M8.

- [ ] **A7.01 — As horas do Render, lidas agora.** O dono lê em Render →
  Billing as *free instance hours* de setembro **por serviço** (a API e o
  `NetsheetEngine`) e a data da suspensão, e anota. É **agora** ou nunca: no
  dia 1º o contador zera. É o número contra o qual o A7.05 confere o arco. · P
- [ ] **A7.02 — As pré-checagens da promoção.** `dev..main` = 0; nenhuma
  migration nova desde o #215; nenhuma env nova; `git ls-tree -r --name-only
  origin/main | git check-ignore --stdin` vazio; as specs do smoke iguais às
  da promoção (`git diff 4efbacd.. -- apps/web/e2e` vazio em 24/09). Repetidas
  no A7.12, na véspera de promover. · C
- [ ] **A7.03 — O branch do Neon.** Um branch **normal** (não *schema-only* —
  as abas precisam do dado), filho de `production`, com data para expirar:
  `npx neonctl@latest branches create --project-id rapid-art-19064809 --name
  fase-12-ensaio --parent production --expires-at <hoje + 14 d>`. Plano free:
  10 branches por projeto, 100 CU-h/mês, 0,5 GB — o filho é *copy-on-write* e
  nasce sem consumir espaço. · N
- [ ] **A7.04 — `gates:rehearse` contra os retidos**, com o `DATABASE_URL` do
  **branch** numa sessão só → **zero reprovações**; a distribuição de tamanho e
  de deriva calibra `MAX_ARTICLE_CONTENT_LENGTH` (p95 × 2) e `MAX_CATEGORY_DRIFT`
  (p95 real) — se mudar, PR com os números. O script só lê, e o branch tira o
  risco do resto. · N
- [ ] **A7.05 — As três abas com dado de produção.** API e web **locais** com
  o `DATABASE_URL` do branch, o `CRON_SCHEDULE` do A0.07 (sem ele, às 08:00 a
  API local roda um pipeline real no branch) e a sessão forjada pela mecânica
  do `capture-admin.mjs` com o `User.id` do dono, que está no dado. Conferir
  cada painel contra o SQL do branch: as 13 fontes reais até 19/09, as
  invariantes dos runs reais, os Portões (a 9 nunca rodou em produção — vazio
  esperado), as falhas reais das sondas da promoção (`AUTH_TOKEN_INVALID`), a
  trilha. **O arco das horas contra o número do A7.01** — lido **antes** do
  primeiro tique do heartbeat (5 min), que escreve no `DailyUptime` do branch
  e somaria 300 s de uma instância que não é a do Render. `admin:capture` das
  três abas com o dado real, cada imagem olhada. · N
- [ ] **A7.06 — A cota de imagem.** Sonda numa imagem em `MISS` (nunca `HIT`) no
  `/_next/image` de produção — é a Vercel, não o Render. · P

## M7b — Produção com o Render (espera a API voltar, e a decisão de promover)

> A API do Render está suspensa desde 19/09 (503 `x-render-routing: suspend`,
> reconferido em 24/09). As 750 h são do **workspace** e zeram **no começo de
> cada mês** (documentação do Render): a data provável é **01/10**. A outra
> saída é do dono: mover o serviço para uma instância paga (Starter, US$ 7/mês,
> cobrada **proporcional ao segundo** — uma semana sai ~US$ 1,60); a
> documentação garante a volta por esse caminho só para outro tipo de
> suspensão, então **o painel confirma antes**. O build da Vercel falha de
> propósito com a API fora — **não se promove antes**, e nenhum push na `main`
> (o Smoke roda em todo push nela).

- [ ] **A7.10 — A API voltou.** `/api/health` 200. · P
- [ ] **A7.11 — O `ignore` do #237 na `main`, e a `dev` em dia.** Um PR na
  `main` só com o `.github/dependabot.yml` (a entrada do
  `@vitest/coverage-v8`, que acompanha a major do vitest — o motivo escrito
  como os outros); o Smoke do push roda verde; e a sincronização `main → dev`
  por PR, o terceiro estado do `CLAUDE.md`, até `dev..main` = 0. Fecha o
  #237. · P
- [ ] **A7.12 — A promoção (decisão do dono)** e os dois deploys de pé; as
  pré-checagens do A7.02 repetidas; Smoke E2E automático (31 passed, 6 skipped
  enquanto os segredos E2E não existirem — hoje o repositório só tem
  `DATABASE_URL`). · P
- [ ] **A7.13 — O ritual:** Lighthouse (medianas) e baseline visual. · P
- [ ] **A7.14 — O primeiro run das 11:00 UTC depois da volta.** Espera-se
  **`baseline: 'insufficient'`** no evento 5.5 nos primeiros dias — a suspensão
  apagou a série de `DailyMetric` desde 19/09, e o portão de volume não opina
  sem três dias com briefing na janela (armadilha 24, agora em produção); as
  duas etapas de portão `INFO`; a `SourceHealth` do dia; as invariantes, com
  `briefing.one_per_day` **violada** pelos dias da suspensão (o `detail` nomeia
  as datas da janela de 7 dias). · P
- [ ] **A7.15 — A leitura com a sessão ADMIN do dono, no site publicado.** O
  dono entra (o agente nunca digita credencial); o agente confere o que o A7.05
  não alcançava: o run do A7.14 nas três abas, a `DailyUptime` voltando a
  crescer, as sondas do smoke novo na tabela de falhas. · P
- [ ] **A7.16 — O #231 no ar.** Duas regenerações **seguidas** de uma listagem
  com `revalidate` (`/pt-BR/news` ou `/pt-BR/article`, sem run do pipeline
  entre elas) com payload RSC idêntico; os dois sitemaps com contagem estável;
  e, se a API cair de novo, o documento anterior mantido (5xx na revalidação).
  **Não a `/about`**: ela não tem `revalidate`, é gerada no build e nunca
  regenera (o item 82 mediu o `now` dela como a hora do build). · P

## M8 — Fechamento

- [ ] **A8.01 — Toda linha acima com status e evidência.** · —
- [ ] **A8.02 — Todo `[!]` virou PR mergeado com guarda, ou dívida no §16.** · —
- [ ] **A8.03 — Item 85 do `docs/progress.md`**, a §22 do plano marcada ✅, o topo
  do `CLAUDE.md`, a memória. · —
- [ ] **A8.04 — O branch do Neon apagado** (`npx neonctl@latest branches
  delete fase-12-ensaio --project-id rapid-art-19064809`), e o SQL de
  preparação do banco local desfeito ou o banco recriado. · —
