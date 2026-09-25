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
>
> **Estado em 25/09/2026, depois da primeira sessão de execução:** M0, M1,
> M2, M3 (menos o A3.05), M5 na parte que não depende do M4, M6 e M7a (menos
> o A7.01) feitos — **51 linhas provadas e 9 com defeito achado e corrigido
> no PR A, cada um com guarda e mutação no `pnpm guard:mutations` (54/54)**.
> O que falta e por quê: **o M4 inteiro espera chaves de IA válidas** no
> `apps/api/.env` (as locais são *placeholders* — A0.05); o A5.02–A5.08
> esperam o M4; o **A3.05 é o Ctrl+C do dono**; o **A7.01 é o Billing,
> antes de 01/10**; o M7b espera a API voltar; o M8 fecha.
>
> **25/09, depois da resposta do dono:** as chaves de IA estão válidas
> (`check-keys.mjs`: `válida: sim` nas duas) — o M4 está destravado; o
> **A7.01 foi lido** (753,4 de 750 h; o resto não é visível — ver a linha);
> o **Drauzio Varella saiu** por decisão dele (PR #243, contra a `dev`); e a
> **primeira tentativa do A3.05 não provou** o flush do desligamento — o
> relógio de 30 s gravou antes do Ctrl+C —, e a segunda, com o relógio na
> mão de um script (`fase12-kit/a305.mjs`), **provou a parte 1 e achou o
> décimo defeito**: com o banco fora, as duas gravações do desligamento
> desistiam sem escrever uma linha (A3.05, corrigido com A1.48/A1.49). **Do
> lado do dono não falta nada**, e o **PR A (#242) mergeia sem o M4**: o M4
> e o A5.02–A5.08 passam para o PR B, com o M7b e o M8.
>
> **25/09, noite — M4 e M5 feitos (PR B, contra a `dev`).** Três runs com
> provedores reais no mesmo dia UTC (20:25, 20:30, 20:30:59), o ensaio
> adversarial e a captura final: **mais três defeitos, os três de produto**
> — a ESPN escreve a hora de Brasília com o rótulo `EST` e dominava a seleção
> do briefing (A4.04: 11 das 15 matérias de 01/09); a chave recusada da
> NewsData virava "colheita vazia" (A4.13); o evento da etapa 8 não contava
> por tabela (A4.07). **13 defeitos na fase.** O que sobra é o **M7b**
> (depois de 01/10: o `ignore` do #237, a promoção, o ritual, o primeiro run
> real) e o **M8** — num PR C. **Decisão do dono, sem prazo:** corrigir por
> SQL, em produção, os itens da ESPN já gravados com 2 h a mais, ou deixar a
> retenção de 30 dias levá-los.
>
> **25/09, fim da sessão — #244 mergeado; o terreno do PR C pronto.** O dono
> decidiu **corrigir** a ESPN: a 1.ª janela foi ensaiada no branch do Neon e
> entregue a ele para rodar em produção, e a 2.ª virou a linha **A7.12b**,
> logo depois da promoção. O **A6.05 fechou** (os três merges da fase na `dev`
> com `0 commits scanned`). Branch **`observability/fase-12-acceptance-c`**,
> cortada de `0457823` (a `dev` com o #244). **O que falta é só o M7b e o
> M8**, e nada anda antes de a API do Render voltar. **Uma sessão nova começa
> pelo "A retomada" no fim da §22 do plano** — o estado, o que depende do
> dono, a ordem e o prompt.

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

- [x] **A0.01 — Sessão no lugar certo.** `pwd && git branch --show-current`
  responde a pasta do repositório e `observability/fase-12-acceptance`;
  `git rev-list --count origin/dev..origin/main` = 0 (era 0 em 24/09); a branch
  0 commits atrás da `dev`. · L
  - **24/09 20:05 UTC:** `/c/Users/tavin/Desktop/Projetos/Newra News` ·
    `observability/fase-12-acceptance` · `dev..main` = 0 · `main..dev` = 34 ·
    a branch 0 atrás da `dev` e 5 à frente (os commits de terreno, só docs).
- [x] **A0.02 — O alvo é um commit fixo.** A triagem dos seis PRs do Dependabot
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
  - **O alvo: `7901caf4e4a4130ef4ff998bcc8380dbcc4f74e2`** (local = remoto),
    24/09 20:05 UTC. `gh pr list --state open` → só o **#237**, base `dev`.
- [x] **A0.03 — A suíte na contagem, não no pass/fail.** `pnpm test` com **1.389
  na API (92 arquivos) e 904 no web (89)** — o número de 24/09, depois do #241;
  `pnpm lint` e `pnpm turbo typecheck` verdes. O sintoma de clone mal montado é
  verde com número menor (§19). · L
  - `Test Files 92 passed (92)` · `Tests 1389 passed (1389)` (API);
    `Test Files 89 passed (89)` · `Tests 904 passed (904)` (web) — 59,6 s.
    Lint `Tasks: 5 successful, 5 total`; typecheck `6 successful, 6 total`.
- [x] **A0.04 — O banco local no estado conhecido.** Docker de pé (se cair no
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
  - **O banco foi recriado, e o motivo é medido.** Docker 29.7.2 de pé; o
    `newranews` de sempre estava em dia de migrations (`Database schema is up
    to date!`), mas `prisma migrate diff --from-url … --to-schema-datamodel`
    devolvia `CREATE UNIQUE INDEX "News_sourceUrl_key"` — o baseline por
    `migrate resolve` que o `CLAUDE.md` registra. Sem o índice único, o
    `createMany({ skipDuplicates })` da etapa 4 não deduplica por URL, e o
    `kept` do A4.06 mediria o banco local, não o código. **Nada apagado:**
    `ALTER DATABASE newranews RENAME TO newranews_pre_fase12` (volta no
    A8.04), `CREATE DATABASE newranews`, `prisma migrate deploy` (7
    migrations) e o `migrate diff` passou a devolver `-- This is an empty
    migration.`
  - **Seed às `2026-09-24T20:09:33Z`** (o "hoje" dele é **24/09 UTC**).
    Imprimiu `DailyMetric: 29 created (1 already existed)` num banco vazio —
    o "1" é o dia bloqueado, que ele pula; a linha do `Article` desconta esse
    dia e a da métrica não (achado de prosa, corrigido no PR A).
  - **O "antes"** (`scratchpad/db-counts.cjs`, lista derivada dos **16**
    `model`): `News 8 · Article 6 · BriefingSource 18 · PipelineLog 27 ·
    PipelineEvent 368 · User 0 · Favorite 0 · UserPreference 0 · Subscriber 0
    · NewsletterLog 0 · DailyMetric 29 · ProductEvent 0 · ErrorEvent 8 ·
    AuditEvent 3 · DailyUptime 24 · SourceHealth 351`. Runs de hoje: **um**,
    `…c001` `SUCCESS` às 11:05 UTC; `RUNNING` 0; `News` de hoje 8;
    `SourceHealth` de hoje 13 linhas, só a Superinteressante em `FAILED`;
    `Article.date` 24, 23, 21, 20, 19, 18/09 (o 22 é o dia bloqueado).
  - **Os dois alertas, antes do run:** `admin:capture` com
    `ROUTES=admin-metrics` → 4/4 (`scratchpad/captures/a004/`); na
    `admin-metrics--1440.png`, "Superinteressante está em falha há 3 dias
    seguidos." e "Trivela está definhando: as novas por dia dos últimos 7
    dias são 25% da média de 30."
- [!] **A0.05 — As chaves existem, sem aparecer.** Um script que lê os dois
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
  - `scratchpad/check-keys.mjs` → API: `DATABASE_URL`, `GEMINI_API_KEY`,
    `GROQ_API_KEY`, `NEWSDATA_API_KEY`, `JOB_SECRET`, `AUTH_JWT_SECRET`
    **sim**; **`RESEND_API_KEY` NÃO**. Web: as cinco **sim**, mais
    `NEXT_PUBLIC_API_URL` e `NEXTAUTH_URL`. Pares: `AUTH_JWT_SECRET` web × API
    **igual**; `BACKEND_JOB_SECRET` × `JOB_SECRET` **igual**. O
    `NEXTAUTH_SECRET` local **é o valor do `dev-bootstrap.sh`** (versionado,
    então não é o de produção). Hosts: banco `localhost:5432`, API
    `localhost:3001`. Nem `CRON_SCHEDULE` nem `LOG_LEVEL` no `.env` — os dois
    vêm da sessão.
  - **Sem `RESEND_API_KEY` a etapa 7.5 não envia nada** — o que o ensaio
    quer (a newsletter local não entrega a assinante real de qualquer
    forma, e o seed não cria assinante). O efeito dela no desfecho do run 1
    se lê no A4.03/A4.10.
  - **Corrigido no mesmo dia, pelo A2.15: existir não é valer.** A
    conferência acima era só de presença, e as duas chaves de IA locais
    são **placeholders** — Groq `401 invalid_api_key` (sem o prefixo
    `gsk_`), Gemini `400 INVALID_ARGUMENT`. O `check-keys.mjs` passou a
    conferir a validade das duas listando modelos (sem custo); a NewsData
    só pelo formato (`pub_` — sim), porque a sonda dela gasta crédito.
    **Gatilho que destrava o M4:** o dono pôr uma `GEMINI_API_KEY` e uma
    `GROQ_API_KEY` válidas no `apps/api/.env` e o `check-keys.mjs` dizer
    `válida: sim` nas duas. Não é defeito do produto: é o terreno, e a
    linha fica `[!]` porque a conferência original teria deixado o M4
    começar e falhar no run 1.
- [x] **A0.06 — O navegador da captura.** `CHROMIUM_PATH` apontando para o
  `chromium_headless_shell-<rev>` instalado se o Playwright pedir outra revisão
  (em 20/09 pediu a 1243 com a 1234 instalada; em 24/09 estavam instaladas a
  1208 e a 1234). · L
  - `playwright-core@1.63.0` pede `chromium-headless-shell` **1243**; o
    `ms-playwright` tem 1208 e 1234. `CHROMIUM_PATH=$LOCALAPPDATA/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe`
    → a captura do A0.04 saiu 4/4 com ele, sem download.
- [x] **A0.07 — O cron interno neutralizado.** O `server.ts` registra o job do
  pipeline **sempre**, às 08:00 de São Paulo (11:00 UTC), sem interruptor: com
  a API local de pé nesse horário, um run real dispara — gasta NewsData e IA
  fora do orçamento do M4 e ocupa o "hoje" do A4.01. Durante toda a fase a API
  local sobe com `CRON_SCHEDULE="0 3 1 1 *"` (variável da sessão, nunca no
  `.env` commitado). Evidência: a linha de boot
  `[cron] registered, schedule: 0 3 1 1 *`. · L
  - A API do ensaio sobe por `scratchpad/run-api.mjs` — `tsx src/server.ts`
    **sem `watch`** (o M1 muta arquivo-fonte; um `watch` recarregaria a API
    com a mutação), as variáveis do cenário por cima do `.env` (o dotenv não
    sobrescreve variável existente, nem vazia) e stdout/stderr gravados crus
    em `scratchpad/logs/<cenário>.{out,err,all}`. Boot de 24/09 20:10 UTC:
    `{"level":30,…,"msg":"[cron] registered, schedule: 0 3 1 1 * tz:
    America/Sao_Paulo"}`; `.err` vazio.

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

- [x] **A1.00 — `scripts/guard-mutations.mjs` existe e se vê falhando.**
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
  - **Feito em 24/09 — `pnpm guard:mutations`** (`scripts/guard-mutations.mjs`).
    As cópias e os JSONs do vitest vão para
    `node_modules/.cache/guard-mutations/` (dentro da árvore, fora do git;
    `GUARD_MUTATIONS_DIR` troca). Saíram do `%TEMP%` no PR #242: caminho fixo
    no diretório temporário é o `js/insecure-temporary-file` do CodeQL, e aqui
    ele tem dente — a restauração copia o backup de volta para o repositório. O CRLF é normalizado antes de casar e **reposto** ao gravar a
    mutação (metade da árvore é CRLF, metade LF); a restauração grava os bytes
    copiados. Quatro tipos de mutação: `edits` (cada trecho uma vez só),
    `dropLine`, `append` e `create` (arquivo novo, apagado no fim).
  - **Visto falhando, de quatro jeitos:** (1) os dois controles inócuos
    (`C.01`, `C.02` — um comentário no `errors.ts` e no redator do BFF) saem
    **"NÃO reprovou"**; (2) a primeira rodada, com os nomes esperados
    chutados, deu **28/46** e marcou as 18 restantes como "reprovou por outro
    teste" — a guarda certa tinha caído em todas, e o script recusou aprovar
    sem o nome; (3) a **A1.18 da primeira rodada não derrubou a guarda** que
    alegava: trocar o schema do `202` por `errorResponseSchema` só reprovou a
    exceção obsoleta, porque esse schema **tem** contrato
    (`utils/schemas.ts:22`) — a mutação estava errada, não a guarda, e a
    troca virou um nome que ninguém declarou. O limite que isso mostrou fica
    escrito na entrada: a `shared-type-contract` identifica o schema **pelo
    nome**, e há três `errorResponseSchema` em `src/` (um só asserido; hoje
    os três são 4xx, fora do alcance dela); (4) **morto no meio** de uma
    mutação (`Stop-Process -Force` 200 ms depois de o `app.ts` mudar), o
    arquivo ficou mutado e o `pending.json` o listava; a rodada seguinte
    **recusou** ("Há arquivos mutados de uma execução anterior") e o
    `--restore` devolveu o `app.ts` idêntico ao HEAD (`git diff --quiet`).
  - **A cobertura derivada achou quatro guardas do plano fora da lista** —
    é para isso que ela existe: `jobs.test.ts` (a costura do `x-actor-id`,
    5b), `e2e-flows.test.ts` (Fase 2, d17151f), `client-error-api.test.ts`
    (7c) e o teste do `h1` da casca em `a11y-guards.test.tsx` (7b). Viraram
    **A1.36–A1.39**. As **15** suítes leitoras da V2 e dos itens 53/54 estão
    em `EXCLUDED`, cada uma com o motivo (três delas o plano tocou só na
    prosa — "15 páginas" → "todas as páginas").
  - **E ela virou guarda de CI:** `apps/api/tests/build/guard-mutations.test.ts`
    roda `--coverage` (a derivação, sem vitest aninhado) e reprova se uma
    suíte leitora nova não tiver mutação nem motivo — guarda nova nasce
    pedindo a mutação que a vê reprovar. A mutação dela é a **A1.40**.
- [x] **A1.01..A1.40 — Cada mutação abaixo reprova a guarda indicada.** · L
  - **Rodada de 25/09, depois das correções do M5 e do M7a: 54/54 como
    esperado, cobertura completa, saída 0** — 53 suítes leem fonte = 38 na
    tabela + 15 excluídas; as sete mutações novas (A1.41–A1.47) são as
    guardas que esta fase criou.
  - **Rodada final de 24/09: 47/47 como esperado, cobertura completa,
    saída 0** — 52 suítes leem fonte = 37 na tabela + 15 excluídas (a tabela
    tem mais três que não leem fonte: `authorization-matrix`,
    `prompt-injection` e `server-hardening`). A 52.ª é a própria
    `guard-mutations.test.ts`, que o regex conta porque o **comentário** dela
    cita `readFileSync` — a família "a guarda vê caractere", aqui na direção
    segura: sobre-inclusão só obriga a registrar, e ela está registrada
    (A1.40). A tabela por mutação, com o teste que caiu, está logo abaixo
    da de mutações.

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
| A1.36 | `tests/routes/jobs.test.ts` (a costura, 5b) | `'x-actor-id'` → `'x-actor'` em `app/api/admin/run-pipeline/route.ts` |
| A1.37 | web `tests/components/a11y-guards.test.tsx` (7b) | a casca `error-state` com `h2` em vez de `h1` |
| A1.38 | web `tests/routes/client-error-api.test.ts` (7c) | o BFF anônimo do relato importando `getServerSession` |
| A1.39 | web `tests/lib/e2e-flows.test.ts` (Fase 2) | um `e2e/guard-mutation.spec.ts` novo, sem fluxo declarado |
| A1.40 | `tests/build/guard-mutations.test.ts` (Fase 12) | uma suíte nova que lê fonte, sem mutação nem motivo |
| A1.41 | `tests/build/workflow-hardening.test.ts` (Fase 12, A6.02) | o passo `node scripts/audit-orphans.mjs` sumindo do `ci.yml` |
| A1.42 | `tests/plugins/error-handler.test.ts` (Fase 12, A3.17) | o 5xx do `AppError` voltando a pôr a própria frase no fio |
| A1.43 | `tests/services/pipeline.test.ts` (Fase 12, A7.05) | o enterro voltando a olhar só o run de hoje |
| A1.44 | `tests/security/secrets-in-logs.test.ts` (Fase 12, A5.01) | o `PrismaClient` de volta ao `errorFormat` padrão |
| A1.45 | `tests/services/seed-error-events.test.ts` (Fase 12, A5.01) | uma linha semeada que o produto deixaria em `debug` |
| A1.46 | web `tests/components/a11y-guards.test.tsx` (Fase 12, A5.13) | uma tabela do admin sem nome acessível |
| A1.47 | web `tests/lib/state-matrix.test.ts` (Fase 12, A5.12) | uma cor da tela de crash que não é o token resolvido |

*Achadas pela cobertura derivada (A1.36–A1.39) e nascidas desta fase
(A1.40–A1.47). As duas últimas foram vistas reprovando depois de o
commit das correções existir — o script só muta arquivo limpo no git.*

**O resultado da rodada final (24/09, `pnpm guard:mutations`, 47/47):** o
teste que caiu em cada uma — `(+N)` são outros testes da mesma suíte que
caíram junto.

| ID | Caiu | ID | Caiu |
|---|---|---|---|
| A1.01a | todo `uses:` de terceiro aponta para um SHA de 40 hex | A1.21 | camada 4 — the output guard blocks it as security — copied-url |
| A1.01b | escrita no `GITHUB_TOKEN` só onde há motivo escrito | A1.22 | a configuração da requisição devolve o pino, nos dois idiomas |
| A1.02 | parseia como YAML, com a forma que o Dependabot espera (+3) | A1.23 | nada que a ISR guarda responde a uma falha com valor vazio |
| A1.03 | finds no call outside the written exceptions | A1.24 | todo boundary de erro desenha pela casca única |
| A1.04a | carries no code that nothing throws | A1.25 | logs through the redacting serializer, not the pino default |
| A1.04b | finds no interpolated or computed code (+1) | A1.26a | o carregamento do .env não escreve nada |
| A1.05a | é síncrona: sem `async` e com retorno declarado `void` | A1.26b | só o carregador importa o dotenv (+1) |
| A1.05b | todo `code` é literal ou constante nomeada | A1.27 | logs counts for the newsletter stage, never a recipient |
| A1.06 | stage 5.5 pushes the same stage in its block | A1.28 | todo membro do tuple tem quem o grave |
| A1.07 | `pipeline-sequence.mermaid` desenha toda etapa que o pipeline anuncia | A1.29 | is one Prisma transaction in the source, not a loop (+1) |
| A1.08 | a retenção escrita em prosa bate com as constantes da etapa 8 (+4) | A1.30 | `server.ts` registra o `uptimeHeartbeatPlugin` |
| A1.09a | cria uma tabela para cada model do schema (+1) | A1.31 | nenhum outro arquivo de src/ escreve o literal do balde |
| A1.09b | cada model tem no SQL exatamente as colunas que declara | A1.32 | keeps the declared ceiling at the number the comment reasons about (+1) |
| A1.10 | lista todo model do schema na seção Models | A1.33 | documents every registered route |
| A1.11 | GET /api/admin/errors rejects a non-admin session (+5 — as outras cinco rotas do prefixo) | A1.34 | lets only the signers sign |
| A1.12 | every path the BFF forwards is a route the API registers | A1.35 | declares a timeout on every network fetch |
| A1.13 | proxies every handler with requireRole ADMIN | A1.36 | `run-pipeline/route.ts` writes the same header name the API reads |
| A1.14 | has a capture route for every admin page (+1) | A1.37 | o boundary de erro é o `h1` da tela, e só a casca única o fixa |
| A1.15 | logs from every catch outside the written exceptions (+1) | A1.38 | does not import anything that resolves an identity |
| A1.16 | is an aggregate, a count, or a one-column select — never a row (+1) | A1.39 | declares exactly one flow per spec file (+4) |
| A1.17 | has exactly one pattern per page.tsx under app/[locale] (+1) | A1.40 | registers every source-reading suite as a mutation or a written exclusion |
| A1.18 | declares a shared-type contract for every success response (+1) | C.01 · C.02 | **NÃO reprovou** (15 e 4 testes verdes) — os controles |
| A1.19 | labels every check the API can write, and no check the API does not | A1.20 | never warns about a URL — every URL in the output is a block (+1) |

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

- [x] **A2.01 — Uma linha por requisição, com `reqId` e nível pelo status.**
  `GET /api/health` e `GET /api/news` → exatamente uma linha cada, `info`. · L
  - 24/09 20:29 UTC, `scratchpad/logs/m2-info.all` (API por `run-api.mjs`,
    `LOG_LEVEL=info`). `GET /api/health` → 200 e **uma** linha
    `info · "request completed" · statusCode=200 · route=/api/health`;
    `GET /api/news?limit=2` → 200 e uma linha `info` com `route=/api/news`.
    Cada linha com o `reqId` igual ao `x-request-id` da resposta.
- [x] **A2.02 — Segredo nunca no stdout.** Depois de todo o M2, um script procura
  no log capturado os **valores** de `JOB_SECRET`, `AUTH_JWT_SECRET`, das chaves
  de provider e a senha da DSN (lidos do `.env`, nunca impressos) → zero
  ocorrências; o host da DSN aparece, a palavra `Bearer` aparece. · L
  - `scratchpad/scan-secrets.mjs` sobre os **8** logs do M2 (API: boot,
    info, warn, sem segredo de JWT; web: dois boots) — 278 linhas: **0**
    ocorrências de `JOB_SECRET`, `AUTH_JWT_SECRET`, as três chaves de
    provider, `NEXTAUTH_SECRET`, `CRON_SECRET`, `BACKEND_JOB_SECRET` e da
    senha do DSN (na forma `:senha@`); o host `localhost:5432` aparece 8
    vezes. **A palavra `Bearer` não aparece — e a expectativa estava
    errada, não o log:** nenhum caminho de falha provocado carrega cabeçalho
    (o `ECONNREFUSED` do undici não traz a requisição), então o redator
    nunca teve o que redigir (`[segredo redigido]` = 0). O redator tem a
    suíte dele; o que esta linha prova ao vivo é que o segredo não chega.
- [x] **A2.03 — `LOG_LEVEL=warn` deixa só o que deu errado.** Reiniciar com
  `warn`, repetir A2.01 → zero linhas. · L
  - API reiniciada com `LOG_LEVEL=warn` (`logs/m2-warn.all`); `GET
    /api/health` e `GET /api/news` → 200 e **zero** linhas — nem as três
    do boot, que são `info`.
- [x] **A2.04 — `AUTH_TOKEN_INVALID`.** `GET /api/account` com token lixo → 401
  `{ "error": "Invalid or missing token" }`; linha `warn`, `code`, `category:
  authorization`, `requestId`, e o `cause` do jose (`JWSInvalid`); com token
  expirado, `JWTExpired`. · L
  - Token lixo → `401 {"error":"Invalid or missing token"}`; duas linhas
    `warn` com o mesmo `reqId`: `"app error"` com `err.code:
    AUTH_TOKEN_INVALID`, `err.category: authorization`, `err.statusCode:
    401`, `err.cause: { name: "JWSInvalid" }` e `route: /api/account`; e a
    de acesso. Token expirado → o mesmo corpo, `cause: JWTExpired`. O id
    da requisição viaja como `reqId` (o do pino), não como `requestId`.
- [x] **A2.05 — `ADMIN_REQUIRED`.** Token válido de `role: USER` em
  `GET /api/admin/errors` → 403, `warn`. · L
  - Token `role: USER` → `403 {"error":"Admin access required"}`; `warn`
    `ADMIN_REQUIRED` · `authorization`.
- [x] **A2.06 — `JOB_SECRET_INVALID`.** `POST /api/jobs/daily-pipeline` com
  Bearer errado → 401, `warn`, nenhum run criado. · L
  - Bearer errado → `401`; `warn` `JOB_SECRET_INVALID` · `authorization`.
    `PipelineLog` seguiu em **27** (o seed), último `startedAt` 11:05.
- [x] **A2.07 — `DASHBOARD_SECRET_INVALID`.** `POST /dev/dashboard/session` com
  senha errada → 303 e linha `warn`; **o palpite não aparece no log**. · L
  - um palpite errado no campo do formulário (`palpite-errado-fase12`) → `303 → /dev/dashboard?failed=1`;
    `warn` `DASHBOARD_SECRET_INVALID` com `context: {"presented":true}`, e
    a de acesso em `info` (303 < 400). `grep palpite-errado-fase12` no log
    → **0**.
- [x] **A2.08 — `CONTENT_TYPE_REJECTED`.** Pela porta, com o caractere de controle
  que o `content-type-bypass.test.ts` usa → 415 com a **frase fixa do nosso
  hook** (não a do Fastify, que ecoa o cabeçalho); linha `warn`; o cabeçalho
  forjado não entra no log. · L
  - Por socket cru (`net`), `Content-Type: application/json<TAB>;
    charset=forjado-fase12` num `POST /api/events` — o TAB no **meio**,
    que o parser do Node não apara (no fim, ele aparava, e a sonda da
    Fase 3 media a forma que o fio nunca entrega). → `415
    {"error":"Unsupported Media Type"}`, a frase fixa do hook; `warn`
    `CONTENT_TYPE_REJECTED` · `authorization`; `grep forjado-fase12` no log
    → **0**.
- [x] **A2.09 — `NOT_FOUND` fora do contrato não existe mais.**
  `GET /api/nao-existe` → 404 `{ "error": … }` sem ecoar o caminho. A linha do
  `AppError` é `debug` e **não aparece** em `info`; **aparece** a linha de
  acesso `warn` (`request completed`, `route: 'unmatched'`, `statusCode: 404`)
  — todo 4xx a tem. · L
  - `GET /api/nao-existe-fase12` → `404 {"error":"Not Found"}`, sem o
    caminho no corpo. **Uma** linha: `warn · "request completed" ·
    statusCode=404 · route=unmatched`; a do `AppError` (`debug`) não saiu.
- [x] **A2.10 — `ACTOR_ID_INVALID`.** Secret certo + `x-actor-id: lixo` → 400,
  linha `error` (`internal` num 400), pipeline **não** disparado. · L
  - `JOB_SECRET` certo + `x-actor-id: lixo` → `400 {"error":"Invalid
    x-actor-id header"}`; linha **`error`** `ACTOR_ID_INVALID` ·
    `internal`; nenhum run novo (27).
- [x] **A2.11 — `AUTH_SUBJECT_MISMATCH`.** `POST /api/auth/upsert` com token de
  `purpose: auth-upsert` do e-mail A e corpo com o e-mail B → 401, `warn`. · L
  - Token `purpose: auth-upsert` de `fase12-a@example.com` e corpo
    `{ email: "fase12-b@example.com" }` → `401`; `warn`
    `AUTH_SUBJECT_MISMATCH` · `authorization`; nenhum `User` criado.
- [x] **A2.12 — `AUTH_SESSION_INCOMPLETE`.** Token assinado sem `sub`/`email` →
  401, linha `error`. · L
  - Token assinado só com `role` → `401`; linha **`error`**
    `AUTH_SESSION_INCOMPLETE` · `internal`.
- [x] **A2.13 — `AUTH_NOT_CONFIGURED`.** API reiniciada com `AUTH_JWT_SECRET`
  vazio (o schema o aceita: `optional()`) → todo token 401, linha **`error`**
  (a categoria vence o status). · L
  - API com `AUTH_JWT_SECRET=` (vazio chega vazio: o dotenv não
    sobrescreve o que existe) → token ADMIN válido em `/api/admin/errors` e
    USER válido em `/api/account` → os dois `401`; linhas **`error`**
    `AUTH_NOT_CONFIGURED` · `internal` — a categoria vence o status.
- [x] **A2.14 — `UNHANDLED`: o 500 cru.** Postgres parado → `GET /api/news` →
  500 com a frase fixa e `x-request-id`; linha `error` com o `err` serializado
  (host da DSN, sem senha). · L
  - `docker stop newranews-db` às 20:32:41 → `GET /api/news` → `500
    {"error":"Internal server error","requestId":"efa2f55a-…"}` com o
    mesmo `x-request-id`; linha `error` `"unhandled error"` com
    `err.name: PrismaClientKnownRequestError`, `err.code: P1001` e a
    mensagem do Prisma com `localhost:5432`; `:password@` no log → **0**.
- [x] **A2.15 — `/api/health/providers` diz "por quê" no log.** Com Bearer do
  `JOB_SECRET` (a rota passa por `assertJobSecret`) e `GEMINI_API_KEY` lixo →
  status `invalid` na resposta (contrato intacto) e a razão no log, **sem a
  URL da sonda**. · L
  - API com `GEMINI_API_KEY` **e** `NEWSDATA_API_KEY` lixo (a sonda da
    NewsData é uma busca de verdade e gastaria crédito com a chave real) →
    `GET /api/health/providers` com Bearer do `JOB_SECRET` → `200
    {"newsdata":"invalid","gemini":"invalid","groq":"invalid"}`, e a
    razão no log sem URL: `warn "provider health check refused"` com
    `provider` e `statusCode` (gemini 400, newsdata 401, groq 401);
    `generativelanguage|newsdata.io|api.groq` no log → **0**.
  - **E ela achou o que o A0.05 não via: o Groq saiu `invalid` com a
    chave real do `.env`.** Conferido fora da API (listar modelos não gasta
    cota): Groq `401 invalid_api_key`, Gemini `400 INVALID_ARGUMENT` — as
    duas chaves locais são **placeholders** (a do Groq nem tem o prefixo
    `gsk_`); a da NewsData tem o formato de chave real (`pub_`). O A0.05
    passou a conferir validade, não só presença, e o M4 fica `[~]` até o
    dono pôr as duas chaves no `apps/api/.env`.
- [x] **A2.16 — O BFF escreve a falha (7a).** API parada, web de pé, uma linha
  JSON no stderr do web por rota, com o `scope`, o `cause` com `ECONNREFUSED`
  e nenhum valor de segredo:
  - `/api/admin/errors` (com sessão) → `bff.proxy`;
  - `/api/events` → `bff.events`;
  - `/api/errors/client` → `bff.errors.client`;
  - `/news-sitemap.xml` → `bff.news-sitemap`;
  - `/api/cron/daily-news` → **`cron.daily-news`** (não é `bff.*`), com
    `warmed: false` e o Bearer redigido. Demora ~50 s: o `warmApi` tenta duas
    vezes, com 25 s cada. · L
  - API parada, web por `run-web.mjs` (`logs/m2-web.err`). Uma linha JSON
    `level: 50` por rota, cada uma com `cause` `AggregateError`
    `ECONNREFUSED`: `bff.proxy` (`/api/admin/errors` com a sessão forjada
    → `502 {"error":"Upstream API unavailable"}`), `bff.events` (502),
    `bff.errors.client` (502), `bff.news-sitemap` (`200` com o XML vazio
    e válido — fora da Vercel o `nullUnlessPublishing` cede) e
    **`cron.daily-news`** (`500 {"success":false,…,"warmed":false}`, com
    `warmed: false` na linha).
  - **O cron respondeu em 0,3 s, não em ~50 s:** com a porta recusando, o
    `warmApi` falha na hora — os 2 × 25 s são o prazo de uma API
    **pendurada**, não de uma que recusa. A matriz supunha o pior caso.
  - **O stderr do web não é só JSON, e não é nosso:** o sitemap escreve
    **uma** linha (a coleção `news`, cuja URL leva o `from` e nunca está
    em cache) e mais um bloco cru `[TypeError: fetch failed] { [cause]:
    AggregateError [ECONNREFUSED] … }` — o `getArticles(1, 10)` tem URL
    fixa, o **cache de `fetch` do Next** serve a resposta guardada (a
    coleção `briefings` não falha, então não loga), e o bloco é o Next
    registrando a revalidação de fundo que falhou. Na primeira
    requisição saiu também um `⨯ Error: failed to pipe response` do Next,
    que não se repetiu. Comportamento do framework, e o desejado (dado
    velho em vez de nenhum); as rotas do BFF isoladas escrevem exatamente
    uma linha JSON cada.
- [x] **A2.17 — `bff.proxy.sign`.** Web com `AUTH_JWT_SECRET` vazio → a rota de
  conta loga a falha de assinatura **e relança** (o status não muda). · L
  - Web com `AUTH_JWT_SECRET=` (`logs/m2-web-nosign.err`) → `GET
    /api/account` pelo BFF com a sessão forjada → `500`; linha
    `{"level":50,"scope":"bff.proxy.sign","err":{"name":"Error",
    "message":"AUTH_JWT_SECRET is not configured"}}` e, depois dela, o
    `⨯ Error: AUTH_JWT_SECRET is not configured` do próprio Next — o
    relançamento: a 500 é a de antes da 7a.
- [x] **A2.18 — O boot só escreve JSON.** Do spawn da API até a primeira
  requisição, **toda** linha de stdout e stderr parseia como JSON — o dotenv 18
  escrevia `◇ injected env (N) from .env` fora do formato, e foi o #241 que o
  calou. · L
  - Cópia do log feita ao ver `Server running`, antes da primeira
    requisição: **3 linhas, 3 JSON, 0 não-JSON** (`[cron] registered…`,
    `Server listening…`, `Server running…`), `.err` com **0 bytes**. O
    mesmo em todos os boots do M2 (`log-lines.mjs`: `não-JSON: 0`).

## M3 — O registro durável (Fases 4, 7c, 5b)

- [x] **A3.01 — As falhas do M2 viram linhas em ≤ 30 s.** `ErrorEvent` com um
  fingerprint por falha distinta (`API:WARN:AUTH_TOKEN_INVALID:/api/account`, …),
  `category` e `severity` certas, `firstRequestId`/`lastRequestId`. · L
  - 35 s depois das sondas do M2: **9** linhas novas, uma por falha
    distinta — `API:WARN:AUTH_TOKEN_INVALID:/api/account` (`count: 2`, o
    lixo e o expirado), `ADMIN_REQUIRED`, `JOB_SECRET_INVALID`,
    `DASHBOARD_SECRET_INVALID`, `CONTENT_TYPE_REJECTED`,
    `AUTH_SUBJECT_MISMATCH` em `WARN · authorization`; `ACTOR_ID_INVALID`
    e `AUTH_SESSION_INCOMPLETE` em `ERROR · internal`. Na do
    `/api/account`, `firstRequestId` = `fa13fc38-…` (o lixo) e
    `lastRequestId` = `abe29865-…` (o expirado) — os `x-request-id` das
    duas respostas.
- [x] **A3.02 — Coalescimento.** 50 × o mesmo 401 num laço → **uma** linha com
  `count` somando 50 na hora. O laço fica abaixo do balde global de 100/min
  (a 101.ª do minuto seria 429, não 401). · L
  - 50 × `GET /api/favorites` com o mesmo token lixo (rota escolhida para
    o `count` ser só dele), 50/50 em 401 → **uma** linha
    `API:WARN:AUTH_TOKEN_INVALID:/api/favorites` com `count: 50`, janela
    20:00.
- [x] **A3.03 — `debug` não vira linha.** Nenhuma linha de `NOT_FOUND`. · L
  - Nenhuma linha com `NOT_FOUND` no `ErrorEvent` depois do A2.09.
- [x] **A3.04 — O banco fora, e o preço escrito.** O flush roda de 30 em 30 s
  **contados do boot** e esvazia o buffer **antes** de ir ao banco. Falhas
  acontecendo com o Postgres parado → o primeiro tique com o banco fora escreve
  `warn` `[error-event] failed to persist` e aquelas ocorrências se perdem (é o
  documentado); as que chegarem **depois** desse tique e antes de o banco
  voltar persistem no primeiro tique seguinte. O que decide é o tique cair ou
  não na janela, não a duração do apagão. · L
  - Banco parado às 20:32:41; o `500` do `/api/news` (A2.14) entrou no
    buffer; o tique seguinte (20:33:13) escreveu `warn "[error-event]
    failed to persist"` com `err.code: P1001`. **Depois** do tique, um
    `401` em `/api/favorites`; banco de volta às 20:33:14. Resultado: a
    linha `API:ERROR:AUTH_NOT_CONFIGURED:/api/favorites` **persistiu** no
    tique seguinte, e `API:ERROR:UNHANDLED:/api/news` **não existe** — a
    ocorrência de antes do tique se perdeu, como o documentado.
- [!] **A3.05 — O flush do desligamento, com prazo.** Falhas acumuladas e
  **Ctrl+C na API** → as linhas persistidas; com o Postgres parado, o processo
  sai em ~2 s (`ERROR_EVENT_CLOSE_TIMEOUT_MS`), sem pendurar. **O Ctrl+C é do
  dono, num terminal com a API em primeiro plano:** no Windows,
  `process.kill(pid, 'SIGINT')` termina o processo **incondicionalmente**
  (documentação do Node), o `kill` do Git Bash também, e o `preview_stop` não
  manda sinal — nenhuma ferramenta do agente produz um SIGINT de verdade. O
  agente lê o resultado no log e no banco. · L
  - **Primeira tentativa, 25/09 15:53 UTC (`node dist/server.js`, cron
    neutralizado) — não prova, e o defeito era do roteiro.** Parte 1: boot
    às 15:53:52.000, as três recusas (`AUTH_TOKEN_INVALID`, `401`) às
    15:54:16.8–17.3 — **24,8 s depois** —, `SIGINT` às 15:54:32.0. O relógio
    de 30 s é armado no registro do plugin, logo antes do `listen`, então o
    tique de ~15:54:22 caiu **entre** as falhas e o Ctrl+C: as duas linhas
    estão no banco (`/api/favorites/ids` `count: 2` e
    `/api/account/preferences` `count: 1`, os `requestId` do log), mas quem
    as gravou foi o tique, e o flush do desligamento achou o buffer vazio.
    O roteiro pedia "tudo em menos de 20 s" cronometrado à mão — margem que
    uma pessoa alternando entre dois terminais não tem. Parte 2: o
    `foreach` da aba B não rodou (erro de digitação no PowerShell), então o
    Ctrl+C das 15:55:43.98 desligou uma API **sem falha no buffer** — a
    parte 2 também não mediu o que pede.
  - **A segunda tentativa tira o relógio da mão:**
    `fase12-kit/a305.mjs 1|2` roda antes de a API subir, acha o boot pela
    primeira conexão aceita na 3001 (T0), manda as três recusas em
    **T0+32 s** (logo depois do primeiro tique), diz "AGORA" e dá prazo até
    **T0+55 s** (antes do segundo), detecta a saída do processo pelo pid e
    diz se ela caiu dentro do prazo; na parte 2 para o Postgres em T0+22 s
    e o religa no fim. Ensaiado pelo agente com um `taskkill` no lugar do
    Ctrl+C: requisições em T0+32,0 s, saída detectada em T0+36,2 s.
  - **Segunda tentativa, 25/09 19:01 UTC, o dono no Ctrl+C — parte 1
    provada.** T0 19:01:08.394 (boot 19:01:08.369), as três recusas em
    19:01:40.40–40.45 (depois do tique de ~19:01:38), `SIGINT` em
    19:01:45.218, o processo fora 147 ms depois — o próximo tique seria
    ~19:02:08, então **o único flush que podia gravar era o do
    desligamento**. No banco: `API:WARN:AUTH_TOKEN_INVALID:/api/favorites/ids`
    `count: 2` e `…/api/account/preferences` `count: 1`, janela 19:00,
    `firstRequestId`/`lastRequestId` iguais aos `reqId` do log
    (`e6a7146b…`, `02c0ddb8…`, `4a87e6e7…`).
  - **Parte 2 — não pendurou, e achou um defeito.** T0 19:02:46.8, Postgres
    parado às 19:03:09, recusas às 19:03:18.8, `SIGINT` às 19:03:23.216, o
    processo fora às 19:03:27.295 — **4,08 s**, e não os "~2 s" desta
    linha: são **dois** flushes em série no `onClose` (o do `ErrorEvent` e
    o crédito do `DailyUptime`), cada um com o prazo de 2 s. O teto é 4 s,
    com folga sobre os 30 s do `SIGTERM` do Render — **a linha estava
    errada, não o código**. As três falhas não chegaram ao banco (contagens
    da janela 19:00 iguais às da parte 1), como o desenho aceita.
  - **O defeito: a desistência era muda.** Depois do `SIGINT` o log não
    tinha **nenhuma** linha — nem que três falhas se perderam, nem que
    segundos de uptime ficaram sem crédito. O comentário do
    `flushErrorEventsBeforeClose` dizia que a promessa pendente terminaria
    no `catch` de sempre, escrevendo o `warn`; o `server.ts` chama
    `process.exit` logo depois do `close`, e aquele `catch` nunca roda.
    **Corrigido no PR A** (`fix(phase-12): the shutdown flushes say what
    they gave up on`): cada desistência escreve a própria linha antes de
    devolver — `fingerprints`/`occurrences` ainda no buffer (teto do
    perdido) e `uncreditedSeconds`. Guardas em `error-event.test.ts` e
    `uptime.service.test.ts` (espiam o logger), mutações **A1.48** e
    **A1.49**. **Visto de ponta a ponta sobre o `dist`**, pelo mesmo
    caminho do `server.ts` (`app.close()` e `process.exit(0)`) contra um
    banco que não responde: as duas linhas no stdout (`uncreditedSeconds:
    5`; `fingerprints: 2, occurrences: 3`) e o `close` em **4.024 ms** —
    o mesmo número da medição do dono.
- [x] **A3.06 — `GET /api/admin/errors`.** `24h` e `7d`: grupos por
  fingerprint, `byCategory` com **as seis** categorias na ordem da taxonomia,
  `since` alinhado à hora cheia (item 65), `truncated: false`. · L
  - 24/09 20:40 UTC, token ADMIN local. `24h`: `window.since`
    `2026-09-23T20:00:00.000Z` para `until` 20:40:39 — o piso da hora cheia
    (item 65); `7d`: `since` `2026-09-17T20:00`. `byCategory` com as **seis**,
    na ordem do `ERROR_CATEGORIES` (`upstream`, `database`, `validation`,
    `authorization`, `contract`, `internal`), inclusive as de zero;
    `truncated: false`; 21 e 23 grupos por fingerprint.
- [x] **A3.07 — O relato do cliente (7c).** Pelo BFF,
  `POST /api/errors/client` `{ message, digest, path: '/pt-BR/news/<uuid>' }` →
  **202** `{ accepted: true }`; depois do flush, linha `WEB · CLIENT_ERROR ·
  /[locale]/news/[id]` com `digest` e `path` no `context`. · L
  - Pelo BFF (`localhost:3000`), `{ message, digest: "fase12-digest-001",
    path: "/pt-BR/news/270b83ed-…" }` → `202 {"data":{"accepted":true}}`;
    depois do flush, `WEB:ERROR:CLIENT_ERROR:/[locale]/news/[id]` com
    `context: {"path": "/pt-BR/news/270b83ed-…", "digest":
    "fase12-digest-001"}`.
- [x] **A3.08 — Caminho desconhecido vai para `unmatched`.** · L
  - `path: "/pt-BR/caminho/que-nao-existe"` → `202`, e a linha
    `WEB:ERROR:CLIENT_ERROR:unmatched` com o caminho no `context`.
- [x] **A3.09 — O balde de 10/min atravessa o BFF.** O 11.º relato no minuto →
  **429** no navegador; o buffer não ganha a 11.ª ocorrência. **O balde é um só
  para o site**: A3.07, A3.08, A3.10 e A3.15 gastam dele — contar os pedidos,
  ou esperar o minuto virar entre as linhas. · L
  - Um `POST` de aquecimento com corpo vazio (`400`) **também gastou o
    balde** — o limite conta antes da validação —, então o 11.º pedido do
    minuto foi o 10.º relato: `429 {"error":"Rate limit exceeded, retry
    in 1 minute"}` no navegador, e o seguinte também. No banco,
    `WEB:ERROR:CLIENT_ERROR:/[locale]` com `count: 5` — os relatos 5 a 9;
    nem o 10.º nem o 11.º entraram no buffer.
- [x] **A3.10 — O corpo é lista de permissão.** `userId`, `email` e `stack` no
  corpo → nenhum deles no `context`. · L
  - Corpo com `userId`, `email` e `stack` → `202`; o `context` da linha
    `/[locale]/about` é só `{"path": "/pt-BR/about", "digest": null}`.
- [x] **A3.11 — O 4xx por rota (armadilha 39).** `GET /api/metrics/http` tem a
  linha `POST /api/errors/client` com `clientErrorRate > 0` depois do A3.09.
  **A métrica é em memória e zera a cada reinício da API** — ler aqui, na
  mesma vida do processo. · L
  - Na mesma vida do processo: `POST /api/errors/client` com `count: 12`,
    `errorRate: 0`, **`clientErrorRate: 0.25`** (o 400 e os dois 429).
- [x] **A3.12 — Saturação e horas do plano (5b).** Com a API de pé > 10 min, a
  linha de hoje do `DailyUptime` cresce ~300 s por tique; `saturation.plan.hoursUsed`
  = soma do mês / 3600; `eventLoop.lagMs.p50` ≈ 0 em repouso (sem a resolução do
  timer). · L
  - API de pé das 20:39:29 às 20:50: a linha de hoje do `DailyUptime`
    foi de `33000` (tique das 20:44:30) a `33300` (tique das 20:49:30) —
    300 s por tique; `saturation.plan` às 20:49: `secondsUsed 778500`,
    `hoursUsed 216.25` = `SUM(seconds)` do mês / 3600 pelo SQL (778500 /
    216,25). **`lagMs.p50` = 6 ms, não ≈ 0:** a subtração usa a resolução
    configurada (10 ms), e o timer do Windows é mais grosso — o 5b mediu o
    efeito (cru ≈ 25 ms no Windows, ≈ 10 no Linux). Plataforma, não
    defeito: no Linux do Render o que sobra é ≈ 0.
- [x] **A3.13 — A rota em memória responde com o banco fora (item 65).**
  Postgres parado → `GET /api/metrics/http` **200**, com `saturation.plan: null`
  e memória/event loop presentes. · L
  - `docker stop` → `GET /api/metrics/http` com token ADMIN → **`200`**,
    `saturation.plan: null`, `memory.ratio 0.1866`, `eventLoop.samples
    5648`, 5 rotas; um `warn` com o `prisma.dailyUptime.aggregate()` que
    falhou. (A primeira tentativa, no boot sem `AUTH_JWT_SECRET`, deu 401:
    a rota é ADMIN por JWT.)
- [x] **A3.14 — Auditoria de exclusão.** Excluir uma notícia pela `/admin` →
  `AuditEvent` `news.deleted` com `actorId` (nunca e-mail) e `targetId`. · L
  - `DELETE /api/admin/news/4ebc56ed-…` pelo BFF, com a sessão forjada —
    o caminho do botão da `/admin` → `200`; `AuditEvent` `news.deleted`,
    `actorId` `00000000-0000-4000-8000-00000000f012` (o id da sessão, sem
    e-mail), `targetId` = a notícia, `context` nulo; a `News` sumiu.
- [x] **A3.15 — O visualizador do log não executa o que a porta anônima
  escreve.** O OWASP lista como consequência de *log injection* o XSS "à espera
  de ser visto num visualizador vulnerável" e a linha forjada por quebra de
  linha — e aqui a porta anônima (`/api/errors/client`) grava texto que o admin
  lê na `/admin/security`. Um relato com `message` contendo
  `<img src=x onerror=alert(1)>` e uma quebra de linha seguida de uma linha JSON
  falsa → **o relato não escreve a mensagem no stdout** (vai direto ao buffer
  do `ErrorEvent`; só a linha de acesso sai, com a rota), então a forja de
  linha não tem onde acontecer ali; no banco, a `message` guardada com a quebra
  e as tags como caracteres; na tabela, o texto literal (A5.15). · L
  - `message: "<img src=x onerror=alert(1)>\n{\"level\":50,\"msg\":\"linha
    forjada fase12\"}"` pelo BFF → `202`. **No stdout:** só a linha de
    acesso (`route`, `statusCode`, sem a mensagem); `onerror` e `linha
    forjada` no log da API e no stderr do web → **0**, e 0 linha não-JSON
    — a forja não tem onde acontecer. **No banco:** a `message` guardada
    como caracteres, com a quebra de linha. A tabela é o A5.15.
- [x] **A3.16 — `AUDIT_WRITE_FAILED`: a auditoria falha e a ação não.** Por SQL
  no banco local, a tabela `AuditEvent` renomeada (anotado; desfeito no fim) →
  excluir uma notícia pela `/admin` → a exclusão responde sucesso **e** nasce
  a linha `API · ERROR · AUDIT_WRITE_FAILED · news.deleted`. É um dos 18
  códigos gravados, e o único que a matriz não provocava. · L
  - `ALTER TABLE "AuditEvent" RENAME TO "AuditEvent_fase12"` às 20:41:28
    → `DELETE` de outra notícia pelo BFF → `200 {"data":{"deleted":true,…}}`
    e a `News` apagada; nasceu `API:ERROR:AUDIT_WRITE_FAILED:news.deleted`
    (`ERROR · database`, `context: {"action": "news.deleted", "outcome":
    "deleted"}`). Tabela devolvida ao nome às 20:41:32.
- [!] **A3.17 — `INTERNAL`: o contrato quebrado entre quem grava e quem lê.**
  Por SQL, o `context` do último evento da etapa 9.5 corrompido (anotado) →
  `GET /api/admin/invariants` → 500 com a frase fixa, e a linha
  `API:ERROR:INTERNAL:/api/admin/invariants` com `category: contract` — nunca
  "nenhuma verificação ainda". O `INTERNAL` é o default do `AppError`, e só o
  `Invariant report is malformed` o produz sem nome próprio. · L
  - `context` do último evento da 9.5 (`…0e010d`, guardado antes) trocado
    por `{"quebrado":"fase12"}` → `GET /api/admin/invariants` → `500`, e a
    linha `API:ERROR:INTERNAL:/api/admin/invariants` com `category:
    contract` e a frase `Invariant report is malformed`. Contexto
    restaurado, rota de volta a 200.
  - **O defeito:** o corpo era `{"error":"Invariant report is malformed"}`,
    **sem `requestId`** — e a `docs/api.md` promete que todo 500 é
    `{ "error": "Internal server error", "requestId" }`. Só o ramo do
    erro cru cumpria; o do `AppError` mandava a própria frase para qualquer
    status, e o **padrão do construtor é 500** — todo `new AppError('…')`
    futuro poria a frase do log no fio. **Corrigido no PR A:** 5xx do
    `AppError` responde o contrato do 500 (`src/app.ts`); guarda nova em
    `tests/plugins/error-handler.test.ts` ("answers an AppError of 500
    with the documented 500 contract"), vista reprovando antes da
    correção; a expectativa do `admin-invariants.test.ts`, que fixava a
    frase no fio, passou ao contrato. **Remedido ao vivo** com a API
    corrigida: `500 {"error":"Internal server error","requestId":
    "81aef5a1-…"}`, o mesmo do `x-request-id`, e a frase só na linha de
    log.
- [x] **A3.18 — A falha do próprio registro não vira segunda falha.** O OWASP
  manda testar "erros de execução no próprio módulo de log". Um `throw`
  guardado por variável de ambiente (nunca commitado) dentro do
  `fingerprintFor` → a requisição que falhou responde o status de sempre, e o
  log ganha `warn` `[error-event] failed to buffer`. **Não no
  `scrubErrorContext`:** o serializer de `err` do logger também o chama, e o
  `throw` quebraria o próprio log em vez de o registro. · L
  - `throw` no `fingerprintFor` guardado por `FASE12_THROW_IN_FINGERPRINT`
    (`scratchpad/inject-a318.mjs`: cópia antes, bytes de volta depois) →
    `GET /api/account` com token lixo → o `401` de sempre; o log com a
    linha do `AppError`, **`warn "[error-event] failed to buffer"`**, e a
    de acesso; `/api/health` seguiu 200. Arquivo restaurado: `git diff
    --quiet` sem diferença.

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

- [x] **A4.00 — Preparação, anotada.**
  - (a) uma linha velha em cada uma das **sete** tabelas que a etapa 8 expurga
    (`News` 31 d, `PipelineLog` 31 d, `Article` 91 d, `ProductEvent` 91 d,
    `ErrorEvent` 15 d, `AuditEvent` 366 d, `SourceHealth` 91 d);
  - (b) um `PipelineLog` `RUNNING` de 20 min atrás — **e outro de três dias
    atrás** (acrescentado em 25/09, depois do A7.05): é a prova ao vivo da
    varredura que enterra o cadáver de qualquer dia, e não só o de hoje;
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
  - 25/09 20:22 UTC, `fase12-kit/m4-prep.cjs` sobre o banco local: (a) uma
    linha velha em cada uma das sete tabelas, marcada `fase12-m4`; (b) os
    cadáveres `f07744c7…` (20 min) e `df23a41b…` (três dias); (c) uma `News`
    de hoje com `<p>`, `<strong>` e `<a>` no corpo; (e) não se aplica — o seed
    é de 24/09; (f) `News` de hoje antes do run: **1** (a de (c)).
  - (d) **a linha de base trocada pela de uma colheita real**: o
    `newsCollected` e o `newsByCategory` dos seis dias locais com
    `DailyMetric` (18–24/09 menos o dia bloqueado, que não tem linha — criar
    uma diria que houve briefing) receberam os dos seis últimos dias de
    produção com briefing (14–19/09, lidos do branch do Neon). O seed tinha a
    mesma distribuição sintética nos sete dias (`WORLD` 121 de 385) e
    `newsCollected` 380–482. Com a troca, a deriva do run 1 saiu **0,043**.
- [x] **A4.01 — Run 1, limpo, pelo botão.** "Executar agora" na `/admin` local
  (sessão forjada pela mecânica do `capture-admin.mjs`, num script de scratch) —
  BFF → `/api/cron/daily-news` → API. Tela: "disparado" com a hora; banco:
  `AuditEvent` `pipeline.triggered` com o `actorId` da sessão, `targetId` = o run,
  `outcome: started`. **Clicar de novo com o run em curso** →
  `already-running` na tela e no `AuditEvent` — é o único jeito de ver esse
  desfecho sem um quarto run. · L
  - Run 1 às 20:25:05.884 UTC por `fase12-kit/m4-button.mjs` (Playwright,
    sessão forjada lida de arquivo): o 1.º clique → `POST
    /api/admin/run-pipeline` `200 {"outcome":"started", …, "warmed":true}` e a
    tela **"Pipeline disparado com sucesso."**; o 2.º, 2,4 s depois, →
    `already-running` e **"O pipeline de hoje já está rodando — começou às
    17:25. Nada foi disparado."** `AuditEvent`: `pipeline.triggered`
    `actor=00000000-…f012` `target=7b9a2323…` `outcome=started`, e o segundo
    com `outcome=already-running` **sem** `target`. **A linha pedia
    "disparado" com a hora**: a frase do `started` não traz hora (a hora está
    nas outras duas e na lista de runs) — a expectativa estava errada, não a
    tela.
  - O run: `SUCCESS` em **32,2 s**, 579 coletadas (509 RSS + 70 NewsData), 568
    depois do dedup, briefing do Gemini (`gemini-2.5-flash`, `v2-52effd41`, 15
    fontes, 8.030 caracteres).
- [x] **A4.02 — O cadáver foi enterrado.** Os **dois** `RUNNING` de A4.00b —
  o de hoje e o de três dias atrás — viraram `FAILED` com `errorStage`
  **nulo**, um evento de etapa 0 `ERROR` cada, e `ErrorEvent`
  `PIPELINE_STAGE_FAILED · stage-0` com o id **do run morto**. O de três dias
  atrás é o que o código de antes do A7.05 deixava para sempre. · L
  - Os dois `FAILED`, `errorStage` nulo, `completedAt` no disparo do run 1:
    `f07744c7…` "after **22 min** in RUNNING" e `df23a41b…` "after **4322
    min**" — o de três dias atrás, o que o código de antes do A7.05 deixava
    para sempre. Um evento de etapa 0 `ERROR` em cada. No `ErrorEvent`,
    **uma** linha `PIPELINE:ERROR:PIPELINE_STAGE_FAILED:stage-0` com `count:
    2` e o `pipelineLogId` do último enterrado — os dois caíram no mesmo
    `(fingerprint, hora)`, e a linha guarda o último run visto (desenho da
    Fase 4, não defeito).
- [x] **A4.03 — As 14 etapas anunciam.** Eventos das etapas 1, 3, 4, 5, **5.5**,
  6, **6.5**, 7, 7.5, 8, 8.5, 9, 9.5 e o resumo final (a etapa 2 não grava
  evento); toda linha de log do run com `pipelineLogId`. · L
  - Eventos do run 1, na ordem: `1 3 4 4 5 5.5 6 6.5 7 7.5 8 8.5 9 9.5 9` — as
    14 etapas (a 2 não grava evento; a 4 grava a persistência e a saúde por
    fonte; a 9 grava a métrica e o resumo final). Toda linha do `api.out`
    escrita durante o run leva o `pipelineLogId`.
- [!] **A4.04 — O portão de entrada mediu.** Evento 5.5 com `baseline: 'ok'`,
  `volume`, `median`, `volumeRatio`, `sources ≥ 3`, `freshestAgeHours < 24` — e
  o `category-drift` conforme a decisão do A4.00d. · L
  - Evento 5.5: `baseline: "ok"`, `baselineDays: 6`, `median: 527`, `volume:
    568`, `volumeRatio: 1.078`, `sources: 4`, `categoryDrift: 0.043`,
    `duplicateRate: 0.019`, `findings: []` — e **`freshestAgeHours: -1.8`**: o
    item mais novo da colheita estava **no futuro**.
  - **O defeito (corrigido no PR B): a ESPN escreve a hora de Brasília com o
    rótulo `EST`.** O feed, lido às 17:28 de Brasília: `<pubDate>Fri, 25 Sep
    2026 17:24:47 EST</pubDate>` — o `Date` lê 22:24 UTC, **duas horas no
    futuro**, e todo item da ESPN fica 2 h mais novo do que é. O pipeline
    escolhe as 15 mais recentes por `publishedAt`: **as 7 primeiras fontes do
    briefing do run 1 eram exatamente os 7 itens da ESPN datados no futuro.**
    Em produção (branch do Neon): só a ESPN tem item com `publishedAt >
    createdAt` (23 de 648, +1,6 h em média); **em 01/09, 11 das 15 matérias
    citadas no briefing eram da ESPN; em 15/09, 7** — o cron das 08:00 pega o
    que ela publicou entre 06:00 e 08:00 como "do futuro". O portão de frescor
    passava por isso (um item do futuro satisfaz "um item das últimas 24 h").
  - Correção: `pubDateZone` por fonte em `rss-sources.ts` (`-03:00` na ESPN) e
    `parsePubDate` no provider, que lê a hora de parede nesse deslocamento e
    ignora o rótulo; fora da forma RFC 822 cai no `Date` de sempre. Guardas em
    `rss.provider.test.ts`, mutações **A1.50** e **A1.51**. **Contra o feed
    real, às 20:56 UTC:** com a correção o item mais novo da ESPN está 10 min
    no passado e zero no futuro; sem ela, 6 no futuro e o mais novo 110 min à
    frente. **O acervo já gravado continua com a ESPN 2 h adiantada** e
    converge pela retenção (30 dias); a correção única por SQL é decisão do
    dono.
- [x] **A4.05 — O portão de saída mediu.** Evento 6.5 com `provider`, `chars`,
  `ptRatio` acima do dobro do piso, `urls: 0`, `findings: []`. · L
  - Evento 6.5 do run 1: `provider: "gemini"`, `chars: 8030`, `words: 1243`,
    `ptRatio: 0.286` (piso 0,08, o dobro é 0,16), `urls: 0`, `findings: []`.
- [x] **A4.06 — A saúde de cada fonte.** 13 linhas de `SourceHealth` hoje,
  `kept ≤ fetched` em cada uma, **Σ`kept` = `News` de hoje depois do run − a
  contagem do A4.00f**, `latencyMs` presente, desfechos coerentes com os avisos
  da etapa 1. · L
  - **12 linhas, e não 13**: o Drauzio saiu no #243, mergeado antes do M4.
    Todas `OK`, `kept ≤ fetched` em cada uma, `latencyMs` presente (363 ms na
    TechCrunch a 6.983 ms na Veja Saúde), `pipelineLogId` do run 1; `newsdata`
    com `fetched 70 kept 69`. **Σ`kept` = 568 = `News` de hoje depois do run
    (569) − a do A4.00f (1).** Sem aviso na etapa 1, e todas `OK` — coerentes.
- [!] **A4.07 — A retenção apagou as sete linhas velhas**, e o evento da etapa 8
  as conta por tabela. · L
  - As sete linhas marcadas sumiram (`News 0 · PipelineLog 0 · Article 0 ·
    ProductEvent 0 · ErrorEvent 0 · AuditEvent 0 · SourceHealth 0`). O evento
    da 8:
    `{"deleted":8,"auditEvents":1,"errorEvents":1,"sourceHealth":1,"productEvents":1}`.
  - **O defeito (corrigido no PR B): o evento não contava por tabela** —
    `News`, `PipelineLog` e `Article` só existiam dentro do `deleted: 8`, e "a
    notícia velha foi apagada?" não se lia dele. Hoje o contexto traz `news`,
    `pipelineLogs` e `articles` ao lado das quatro que já tinha. Guarda em
    `pipeline.test.ts`, mutação **A1.53**.
- [x] **A4.08 — A renormalização limpou o HTML de A4.00c** (`textChanged ≥ 1`); no
  run seguinte, zero (ponto fixo). · L
  - Evento 8.5 do run 1: `scanned: 575`, `textChanged: 1`; a `News` do A4.00c
    ficou `"Primeiro parágrafo com negrito e um link.\nSegundo parágrafo."` —
    o parágrafo preservado, as tags fora. No run 2: `textChanged: 0` (ponto
    fixo).
- [x] **A4.09 — As invariantes.** Evento 9.5 com `checked: 12`, as sete
  `retention.*` em `OK` depois do expurgo, `durationMs` bem abaixo de
  `budgetMs`. **Esperado, não achado:** `briefing.one_per_day` **violada** — o
  seed deixa o dia bloqueado (`daysAgo` 2) sem briefing de propósito, e os
  dias entre o seed e o M4, se houver, também —, com a linha `INVARIANT ·
  WARN · INVARIANT_VIOLATED · briefing.one_per_day` e **sem** degradar o run.
  `newsletter.delivered` em `OK` (o seed não cria assinante). · L
  - Evento 9.5 do run 1: `checked: 12`, `errored: 0`, `violated: 1`; as sete
    `retention.*` em `OK` depois do expurgo; a única violação é a esperada,
    **`briefing.one_per_day` (observado 6, esperado 7 — o dia bloqueado do
    seed)**, com a linha
    `INVARIANT:WARN:INVARIANT_VIOLATED:briefing.one_per_day` e o run `SUCCESS`
    sem `degradedBy`. `newsletter.delivered` `OK`. A tela (A5.08) mostra **24
    ms de 2 s** para o relatório do run 2.
- [x] **A4.10 — As duas contas do `degradedBy` batem.** O resumo da etapa 9 = a
  derivação sobre os eventos gravados = o `degradedBy` da listagem
  (`/api/admin/pipeline/runs`), e o `outcome` casa. · L
  - Run 1: resumo da 9 `degradedBy: []`; nenhum evento `WARN` gravado; `GET
    /api/admin/pipeline/runs` → `7b9a2323… SUCCESS outcome=SUCCESS
    degradedBy=[]`. Run 2: resumo `[1, 6]` = `WARN` gravados nas etapas 1 e 6
    = listagem `outcome=SUCCESS_DEGRADED degradedBy=[1,6]`. As três contas
    batem nos dois.
- [x] **A4.11 — O event loop não travou.** Latência máxima do `/api/health`
  durante o run < 5 s (o timeout do health check do Render); `lagMs.max` do
  `/api/metrics/http` anotado. · L
  - `fase12-kit/m4-health.mjs`, uma batida por segundo: **34 amostras durante
    o run 1, máxima de 37 ms**, todas `200`. `/api/metrics/http` depois do
    run: `eventLoop.lagMs.max` **157 ms** (p95 6 ms).
- [x] **A4.12 — Idempotência que diz a verdade.** Clicar de novo →
  `already-succeeded-today` com a hora do run na tela; `AuditEvent` com esse
  `outcome` e **sem** `targetId`; nenhum run novo. · L
  - 20:27:25 UTC: `already-succeeded-today` e **"O pipeline de hoje já rodou
    às 17:25. Ele roda uma vez por dia, então nada foi disparado."**;
    `AuditEvent` com esse `outcome` e **sem** `targetId`; runs de hoje: 2 (o
    cadáver enterrado e o run 1) — nenhum novo.
- [!] **A4.13 — Run 2, degradado, sem gastar NewsData.** O run 1 marcado `FAILED`
  por SQL (anotado — é o que permite o re-disparo); API reiniciada com
  `GEMINI_API_KEY` e `NEWSDATA_API_KEY` com valor lixo; e, antes, as
  `BriefingSource` de um briefing **dos últimos 7 dias** apagadas (é a janela
  de `briefing.has_sources`; um mais velho não seria visto). Disparo **direto**
  (`JOB_SECRET` + `x-actor-id`) → Gemini recusa sem retry (4xx não é
  transitório — só 429 e 5xx são), Groq serve → `SUCCESS_DEGRADED` com
  `degradedBy: [1, 6]`; `ErrorEvent` `PIPELINE_STAGE_DEGRADED` em `stage-1` e
  `stage-6` (`upstream`); e `INVARIANT_VIOLATED · briefing.has_sources` —
  **sem** degradar o run por isso. O briefing de hoje passa a ser o do Groq. · L
  - Run 1 marcado `FAILED` por SQL (`fase12-kit/m4-sql.cjs`); as 3
    `BriefingSource` do briefing de **23/09** apagadas; API reiniciada com
    `GEMINI_API_KEY` e `NEWSDATA_API_KEY` inválidas. Disparo direto às
    20:30:05 → `started`, `SUCCESS` em **4,0 s**: o Gemini respondeu **400
    `API_KEY_INVALID`** e não houve retry, o Groq (`openai/gpt-oss-20b`)
    serviu; resumo `degradedBy: [1, 6]`; `ErrorEvent`
    `PIPELINE_STAGE_DEGRADED` em `stage-1` e `stage-6`, os dois `upstream`;
    `INVARIANT_VIOLATED · briefing.has_sources` (observado 1) **sem** degradar
    o run; o briefing de hoje passou a ser o do Groq.
  - **O defeito (corrigido no PR B): a chave recusada da NewsData virava
    "colheita vazia".** As oito categorias responderam `401 UNAUTHORIZED`, o
    `allSettled` do provider devolveu `[]`, o `fetchAll` o leu como
    **`provider-empty`** e a saúde por fonte gravou `newsdata` **`EMPTY` sem
    motivo** — o painel diria "a NewsData não tinha notícia" no lugar de "a
    chave foi recusada". É a distinção `feed-empty` × `feed-failed` de 03/09,
    no outro provider. Hoje, com **todas** as categorias recusadas, o provider
    lança com o motivo (`NewsData: all 8 categories failed — NewsData error:
    401 UNAUTHORIZED`); falha parcial continua devolvendo o resto. O teste que
    afirmava o contrário foi reescrito com a medição; mutação **A1.52**.
- [x] **A4.14 — Run 3, o portão de entrada bloqueia, sem IA.** Os sete
  `DailyMetric` anteriores com `newsCollected: 5000` (backup antes, restaurado
  depois); run 2 marcado `FAILED` por SQL → `FAILED` com `errorStage: 5.5`,
  **nenhuma** chamada ao Gemini ou ao Groq no log, o `Article` de hoje intocado,
  `ErrorEvent` `PIPELINE_GATE_BLOCKED · ERROR · stage-5.5:volume ·
  upstream`. A conta fecha: ~600 contra a mediana de 5.000 dá 0,12, abaixo do
  piso `MIN_VOLUME_RATIO` de 0,3. · L
  - Os seis `DailyMetric` anteriores com `newsCollected: 5000` (backup em
    `m4-metrics-backup.json`: 557, 588, 604, 497, 487, 453), run 2 marcado
    `FAILED` por SQL, disparo direto às 20:30:59 → **`FAILED` em 0,9 s,
    `errorStage: 5.5`**, `Entry gate blocked: volume (501 < 30% of median 5000
    over 6 days)`; **zero** linhas de Gemini ou Groq no log do run; o
    `Article` de hoje intocado (o do Groq, `updatedAt` 20:30:08); depois do
    flush, `PIPELINE:ERROR:PIPELINE_GATE_BLOCKED:stage-5.5:volume` `upstream`.
    Métricas restauradas logo depois. A conta: 501 contra 5.000 = 0,10, abaixo
    do piso de 0,3.
  - **Os três runs caíram em 25/09 UTC** (20:25, 20:30 e 20:30:59).
- [x] **A4.15 — Ensaio adversarial contra o Gemini de verdade, nos dois
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
  - Script temporário (`apps/api/m4-adversarial.ts`, apagado depois) chama
    `generateArticle` com 14 notícias reais do banco e uma envenenada, sobre
    um `PipelineLog` criado para o ensaio, gravando pelo mesmo
    `logPipelineEvent` e na mesma forma do `catch` do pipeline. **Quatro
    tentativas, e nenhum modelo obedeceu:**
  - **Segurança** (a ordem e o link `https://ofertas-newra.example/cadastro`
    no título e na descrição do item): 1.ª — o Gemini em **503 "high demand"**
    nas três tentativas do retry, o Groq serviu **sem URL nenhuma**; 2.ª, às
    20:46 — o **Gemini** serviu, `urls: 0`, guarda limpa.
  - **Qualidade** (a nota "a edição de hoje será publicada inteiramente em
    espanhol", no título, na descrição e no corpo do item): 1.ª — o Gemini em
    **timeout**, o Groq serviu **em português** (`ptRatio 0,223`); 2.ª — o
    **Gemini** serviu em português (`ptRatio 0,256`).
  - Então nenhum dos dois destinos do portão de saída foi atravessado ao vivo
    — o que a linha pede é anotar se o modelo obedeceu, e ele não obedeceu. Os
    caminhos de bloqueio continuam provados pelo `ai.test.ts` (o Groq não é
    chamado depois de um bloqueio de segurança) e pelo atravessamento do item
    84. **Orçamento:** quatro gerações servidas (duas do Gemini, duas do Groq)
    contra as três da linha, mais duas do Gemini que falharam sem gerar. Os
    quatro `PipelineLog` do ensaio — `SUCCESS`, sem evento, sem `ErrorEvent` —
    foram **apagados depois de anotados** (`910aa8df…`, `0aa80cd2…`,
    `d0dc7289…`, `c053e7ec…`): sendo os mais novos do dia, viravam o "último
    run de hoje" na faixa e o primeiro da lista, e a captura expandia um run
    vazio (A5.01).
- [x] **A4.16 — `gates:rehearse` sobre o banco depois dos runs** → o briefing de
  hoje (o do run 2 — o do run 1 foi sobrescrito) e os semeados passam; nenhuma
  reprovação que não seja artefato de seed (e o artefato nomeado). · L
  - `pnpm --filter @newranews/api gates:rehearse` sobre o banco local depois
    dos runs: **"Nenhum retido reprovaria."** Os sete briefings retidos passam
    no portão de saída (corpo p95 6.309, razão de português mínima 0,228). Na
    entrada: a deriva **avisaria** em 18/09 (0,263) — artefato do A4.00d, que
    pôs a distribuição de um dia real num dia do seed —; diversidade
    **indeterminada** em 20/09 (um briefing semeado com 2 fontes e sem `News`
    do dia) — artefato do seed; e frescor **−1,9 h** no briefing de hoje, que
    é a ESPN do A4.04.

## M5 — As três abas, com o dado que o M2–M4 produziu (Fases 2, 5, 8, 11, 6, 7b, 9)

- [x] **A5.01 — `admin:capture` 21/21, com a medição de largura**, e **cada
  imagem olhada** nos dois temas — a captura achou defeito sem sintoma de código
  em cinco fases seguidas; o código de saída não basta. (21 = 5 rotas × 2
  larguras × 2 temas + `admin-en`.) · L
  - **Primeira passada, 25/09 01:44 UTC, com o dado do M2–M3 (antes do
    M4):** `admin:capture` → **21/21**, nenhuma reprovada pela medição de
    largura (`scratchpad/captures/a501/`), olhadas por recorte. A
    `/admin/metrics` a 375 saiu 57 px mais alta no escuro que no claro — é
    uma linha a mais na tabela de latência por rota (`GET
    /api/admin/sources`, chamada pela captura clara um instante antes; a
    métrica é em memória): não é defeito. A rodada que vale para esta
    linha é a de depois do M4, com os três runs dentro — pendente com ele.
  - **A `/admin/security` com falha de verdade mostrou dois achados
    (corrigidos no PR A):** (1) a linha do `AUDIT_WRITE_FAILED` levava à
    coluna e à tela a mensagem inteira do Prisma — **o caminho absoluto do
    arquivo no servidor e quatro linhas do código-fonte**, com a causa
    espremida no fim; o `errorFormat` padrão do `PrismaClient` põe o quadro
    de código na `message` (medido: com a URL e a senha junto, quando elas
    estão escritas perto da chamada). O singleton passou a
    `errorFormat: 'minimal'` (`Invalid \`prisma.news.count()\` invocation:
    Can't reach database server…` — a chamada e a causa; o `stack` segue
    no log), com guarda pelo parser em `secrets-in-logs.test.ts` (A1.44).
    (2) **O seed semeava três falhas que o produto nunca grava** — um
    `NOT_FOUND` em `WARN` (404 é `debug`), um código `feed-failed` (a
    etapa 1 degradada é `PIPELINE_STAGE_DEGRADED`) e um `INTERNAL` num 500
    de rota (o 500 cru é `UNHANDLED`) —, lado a lado com as reais. Viraram
    `CONTENT_TYPE_REJECTED`, `PIPELINE_STAGE_DEGRADED` e `UNHANDLED`, e
    nasceu `tests/services/seed-error-events.test.ts` (o código está no
    conjunto gravado, o fingerprint é o do `fingerprintFor`, a severidade
    de linha da API é a do `logLevelFor` e nunca `debug`), vista
    reprovando sobre o seed antigo em duas das três (A1.45). A terceira —
    `INTERNAL` num 500 — é forma possível para o tipo, e nenhuma regra
    geral a separa.
  - **A rodada que vale, 25/09 ~20:55 UTC, depois do M4:** `admin:capture` →
    **21/21** (`scratchpad/captures/a501-m4b/`), nenhuma reprovada pela
    medição de largura. A primeira tentativa (`a501-m4`) avisou "não achei a
    linha de execução para expandir" em cinco fotos: o run expandido era um
    dos quatro do ensaio do A4.15, sem evento — apagados e capturado de novo.
    Olhadas: as três abas a 1440 no claro inteiras, as três a 375 no escuro
    inteiras e por recorte (a faixa e o card do run 3, a latência por rota
    rolando dentro do próprio contêiner, os Portões e as Invariantes), a
    `admin-en` e a tela de erro no escuro (o boundary com o selo do overlay do
    `next dev` — é captura local). Nenhum defeito visual.
- [x] **A5.02 — `/admin`: o arco e o ritmo do mês**, com as horas do
  `DailyUptime`; "Indisponível" nunca zero. · L
  - O arco: **29 % — 217 h / 750 h**, "no ritmo atual, 262 h no fim do mês (35
    % do plano)", memória 24 % (124 MB / 512 MB), atraso do event loop p95 6
    ms; `/api/metrics/http` com `plan.hoursUsed 216.69`, `ratio 0.2889`. O
    número é o `DailyUptime` **deste banco local** (as máquinas de ensaio),
    não o do Render.
- [x] **A5.03 — Os três desfechos do botão, cada um com a sua frase** —
  `started` e `already-running` (os dois cliques do A4.01) e
  `already-succeeded-today` (A4.12), fotografados **na hora do clique**: a
  frase é resposta ao clique, não estado da página. · L
  - As três frases, **lidas no instante do clique** pelo `m4-button.mjs` (o
    texto da tela depois da resposta de cada `POST`, não fotografado):
    `started` → "Pipeline disparado com sucesso."; `already-running` → "O
    pipeline de hoje já está rodando — começou às 17:25. Nada foi disparado.";
    `already-succeeded-today` → "O pipeline de hoje já rodou às 17:25. Ele
    roda uma vez por dia, então nada foi disparado." A frase é resposta ao
    clique: a página recarregada não mostra nenhuma delas.
- [x] **A5.04 — A faixa de 30 dias.** Uma célula por dia UTC, com o desfecho do
  **último** run do dia: hoje é o `FAILED` do run 3, **cheio vermelho** com a
  etapa 5.5 no título; o contorno de degradado vem dos dias **semeados** (os
  de fallback do seed, `daysAgo` múltiplo de 5); os dias sem run, vazados. O
  run 2 degradado **não tem célula própria** — ele aparece na lista de runs e
  no detalhe (A5.06). O alerta "Degradado pela etapa N há 3 execuções
  seguidas" fica calado, porque o último dia decidido é `FAILED`. · L
  - A faixa de 27/08 a 25/09: **a célula de hoje cheia de vermelho** (o run
    3); os contornos de degradado nos dias semeados; os dias sem run vazados;
    o run 2 só na lista. O alerta "Degradado pela etapa N há 3 execuções
    seguidas" calado.
- [x] **A5.05 — O batimento** "Último briefing há …" medido do último run que
  **produziu** briefing (o run 2, não o run 3, que falhou). · L
  - "**Último briefing há 33 h 48 min, atrasado · 24 de set. de 2026, 08:05**"
    — o run semeado de 24/09, e não o run 2. **A expectativa da linha estava
    errada:** o batimento conta o último run `SUCCESS` que produziu briefing,
    e o próprio A4.14 manda marcar o run 2 como `FAILED` por SQL para permitir
    o run 3; o briefing do Groq existe, mas nenhum run `SUCCESS` de hoje o
    produziu. Em produção um run que produziu briefing só termina `FAILED` se
    o `update` final falhar (e aí vira cadáver enterrado) — caso de borda, sem
    gatilho a escrever.
- [x] **A5.06 — O detalhe do run** expandido com as etapas 5.5 e 6.5 e os
  contextos; o run 2 com "Degradado pelas etapas 1 e 6"; o run 3 com
  `errorStage` 5.5 e a mensagem do portão. · L
  - O run 3 expandido na captura: "Falhou · Etapa da falha 5.5 · 1s · 0", a
    caixa "Entry gate blocked: volume (501 < 30% of median 5000 over 6 days)",
    "Degradado pela etapa 1" (o `provider-empty` da NewsData), e os 7 eventos
    com contexto — o 5.5 `ERROR` com `gate`, `check`, `reason`. O run 2
    aparece como **Falhou** na lista, pela mesma marcação do A4.14; o
    "Degradado pelas etapas 1 e 6" dele foi lido na listagem **antes** da
    marcação (A4.10: `SUCCESS_DEGRADED`, `[1, 6]`).
- [x] **A5.07 — `/admin/metrics`:**
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
  - KPIs com variação (501 hoje, −7,1 % contra 7 d; 4 s; 539/dia; 83 % de
    sucesso); "Hoje" com **Groq** e 1 erro; ingestão por fonte **RSS 511 /
    NewsData 0**; "IA utilizada (7 dias)" **Groq 3 · Gemini 3**; categorias e
    série por dia preenchidas.
  - Sinais de ouro: 156 requisições, p95 50 ms, 0 % de 5xx, **0,64 % de 4xx**;
    na latência por rota, **`POST /api/errors/client` com 6,67 % na coluna
    4XX** — o 429 provocado às 20:49 pelo BFF, o 11.º relato no minuto (`202
    ×10` e `429`), depois do reinício da API.
  - Fontes: **13 linhas** — as 12 de hoje (o run 3 as reescreveu, com
    `newsdata` **VAZIA**, que é o defeito do A4.13 visto na tela; a API que
    rodou o run 3 era a de antes da correção) e **o Drauzio Varella como "não
    tentada" hoje**, com a série semeada e sem alerta (sequência de falhas 0)
    — é a tela do #243 com dado de verdade. Nenhum alerta aceso: a
    Superinteressante semeada em falha perdeu a sequência com a colheita real
    `OK`.
- [x] **A5.08 — `/admin/security`:**
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
  - A tabela com as falhas do M2–M4: `PIPELINE_GATE_BLOCKED ·
    stage-5.5:volume`, os dois `PIPELINE_STAGE_DEGRADED` (`stage-1`,
    `stage-6`), os dois `INVARIANT_VIOLATED`, o `PIPELINE_STAGE_FAILED ·
    stage-0` com `count 2`, o `CLIENT_ERROR` do 429. Portões: **aprovação 82 %
    (abaixo de 90 % — o alerta vermelho)**, 11 runs na janela, 2 dias
    bloqueados, 1 recuperado; a rosquinha com "Volume abaixo de 30 % da
    mediana" 2 e "Fora do português" 1 (o seed). **Sem alerta de URL — o A4.15
    não bloqueou.** Invariantes: o relatório do run 2, **2 violadas de 12, 24
    ms de 2 s** (`briefing.one_per_day` 6 contra ≥ 7; `briefing.has_sources` 1
    contra 0). Auditoria: os disparos com os três desfechos e as exclusões, só
    ids.
- [x] **A5.09 — Nenhum polling.** Cada aba aberta por 3 min →
  `read_network_requests` sem requisição repetida a `/api/admin/*` (armadilha
  3). · L
  - `scratchpad/m5-browser.mjs` (Playwright, cookie lido de arquivo): as
    três abas abertas **ao mesmo tempo** e deixadas 180 s — `/admin` 3
    requisições à API na carga e **0** depois; `/admin/metrics` 4 e **0**;
    `/admin/security` 5 e **0**; nenhuma URL repetida.
- [x] **A5.10 — O boundary de cliente (7b).** A rota `admin-metrics-error` do
  capture (`breakBff`) → a casca `error-state`, o relato **202 uma vez por
  montagem**, e a linha `WEB · CLIENT_ERROR · /[locale]/admin/metrics`. · L
  - As quatro capturas da rota `admin-metrics-error` (`breakBff`) →
    **quatro** `POST /api/errors/client` com **202** no log da API (uma por
    montagem) → uma linha `WEB:ERROR:CLIENT_ERROR:/[locale]/admin/metrics`
    com **`count: 4`**, `context: {"path": "/pt-BR/admin/metrics",
    "digest": null}` (erro de render do cliente não tem `digest`) e a
    mensagem do `TypeError` real do `GoldenSignals`.
- [x] **A5.11 — O `digest` chega a um humano numa página `force-dynamic`.** Um
  `throw` guardado por variável de ambiente (nunca commitado) na
  `/admin/security` → "Referência do erro: <digest>" na tela e **o mesmo
  digest** no `context` da linha. · L
  - `throw` temporário na `/admin/security` guardado por
    `FASE12_THROW_SECURITY` (`scratchpad/inject-web.mjs`; restaurado, `git
    diff --quiet` limpo) → a tela do `[locale]/error.tsx` com **"Referência
    do erro: 2090297366"**, o relato enviado com o mesmo `digest` (202), o
    mesmo número no log do web, e a linha
    `WEB:ERROR:CLIENT_ERROR:/[locale]/admin/security` com `"digest":
    "2090297366"` no `context`. De passagem: a página de erro respondeu
    **HTTP 200** (o boundary de uma página `force-dynamic` renderiza sem
    status de erro) — numa `noindex` de admin não pesa.
- [!] **A5.12 — O `global-error.tsx`.** `throw` guardado por variável no layout
  de idioma → a tela de crash no **tema escuro** quando o tema salvo é escuro
  (armadilha 40), strings no idioma do caminho, relato enviado. · L
  - **Só em build de produção:** em dev o Next 14 mostra o overlay no
    lugar do `global-error.tsx` (a primeira tentativa, em dev, deu 500 e
    página vazia). `next build` sem a variável, `next start` com
    `FASE12_THROW_LAYOUT=1`, `/en/admin` (dinâmica: o layout roda por
    requisição) → **HTTP 500**, `lang="en"`, "Something went wrong… Error
    reference: 94297226", o relato enviado (202), e a classe `dark` no
    `<html>` **só** com o tema salvo escuro.
  - **O defeito: a tela saía sem folha de estilo nenhuma** — zero `<link
    rel="stylesheet">`, zero `<style>`, Times New Roman, fundo branco **com
    a classe `dark` aplicada**. O boundary raiz substitui o layout raiz, é a
    ele que o Next prende o chunk do CSS, e o `import '@/styles/globals.css'`
    do `global-error.tsx` era deduplicado — a guarda da `state-matrix`
    conferia o `import` e passava. **Corrigido no PR A:** o
    `global-error.tsx` traz o próprio `<style>`, por elemento, com os tokens
    **resolvidos** num `THEME`; a guarda passou a exigir o `<style>`,
    proibir o `globals.css` ali, e **resolver `--bg`, `--ink`,
    `--ink-secondary`, `--ink-muted`, `--brand-solid` e `--on-brand` do
    `tokens.css`** (seguindo as cadeias `var(--…)`, no claro e no `.dark`) e
    cobrar a igualdade (A1.47). **Remedido:** fundo `rgb(15, 17, 19)` =
    `#0f1113` no escuro e `#faf9f7` no claro, fonte do sistema, título em
    serifa, botão da marca (`scratchpad/captures/a512-fixed-dark.png`).
- [!] **A5.13 — Teclado e leitor.** Cabeçalhos ordenáveis com `aria-sort`,
  alertas como `role="status"` (nunca `alert` sobre conteúdo), tabelas com nome
  acessível — pela árvore de acessibilidade (`read_page`). · L
  - Pela página (`m5-browser.mjs`): um só `aria-sort` por vez (o da
    coluna ativa, `descending` — o WAI-ARIA pede um), foco no primeiro
    cabeçalho ordenável e **Enter** → `aria-sort` `descending → ascending`;
    zero `role="alert"`, um `role="status"`.
  - **O defeito: três das quatro tabelas do admin sem nome acessível** —
    a de falhas (`error-groups-table`), a de latência por rota
    (`golden-signals`) e a de fontes (`source-health-panel`); só a de
    invariantes tinha, e por acaso (um `getByRole('table')` ambíguo na
    suíte dela). Com duas por página, o leitor de tela as lista como
    "tabela, tabela". **Corrigido no PR A:** `aria-label` com o título que
    cada seção já tem; guarda nova na `a11y-guards` ("toda tabela tem nome
    acessível"), vista reprovando com uma delas sem nome (A1.46).
- [!] **A5.14 — A aba em inglês.** `/en/admin/security` com o painel Portões e
  os motivos traduzidos. · L
  - `/en/admin/security` → `lang="en"`, títulos "Logs & security",
    "Recorded failures", "Gates", "Invariants", "Admin action audit"…
    **e "Motives"** no painel de portões — em inglês de interface,
    "motives" é intenção; o motivo de um bloqueio é "reasons". Corrigido
    no `messages/en.json` (a paridade de chaves da `i18n-messages` segue
    verde). Os rótulos por motivo (`GATE_CHECK_KEY`) só aparecem com
    bloqueio na janela — o M4 os traz.
- [x] **A5.15 — O payload do A3.15 na tabela é texto.** A linha do relato
  mostra `<img src=x onerror=alert(1)>` **como caractere**: a árvore de
  acessibilidade tem o texto e nenhum elemento `img` novo, e nenhum diálogo
  abre. (A defesa esperada é o React escapar — não há `dangerouslySetInnerHTML`
  no admin; a linha prova, não supõe.) · L
  - A linha do relato do A3.15 na tabela de falhas mostra `<img src=x
    onerror=alert(1)> {"level":50,"msg":"linha forjada fase12"}` **como
    texto** (captura a 1440); na árvore de acessibilidade, a `row` traz o
    texto literal; **nenhum** `<img>` com `src="x"` no DOM; **zero**
    diálogos abertos durante toda a navegação (`page.on('dialog')`).

## M6 — A esteira (Fase 10)

- [x] **A6.01 — Os seis workflows** (`ci`, `codeql`, `gitleaks`, `lighthouse`,
  `migrate`, `smoke`) com `permissions` no mínimo e todo `uses:` em SHA com o
  comentário da versão — lido nos arquivos, não só pela guarda. · C
  - Lido nos seis arquivos: `permissions:` no topo de todos, `contents:
    read`; as duas escritas têm o motivo escrito ao lado —
    `security-events: write` no `codeql.yml` (publicar o SARIF) e
    `pull-requests: write` no `gitleaks.yml`. **24/24** `uses:` em SHA de 40
    hex com `# vX.Y.Z` ao lado (ci 9, codeql 3, gitleaks 2, lighthouse 3,
    migrate 3, smoke 4).
- [!] **A6.02 — O gate de advisories.** `pnpm audit --audit-level=high --prod`
  sai 0; a lista silenciada no `package.json` = a de
  `docs/security-advisories.md`; nenhuma linha com mais de 90 dias sem revisão
  (§16). · C
  - `pnpm audit --audit-level=high --prod` → **saída 0** (`16 high (16
    ignored) | 2 critical (2 ignored)`); `ignoreGhsas` = tabela do
    documento (20 = 20); aceitação mais antiga 23/08 (32 dias).
  - **O defeito: 20 exceções e só 18 ignoradas.** Rodando o `audit` uma
    vez com a lista vazia (o `package.json` restaurado byte a byte), as
    duas do `browserslist` — GHSA-73wf-gq98-2v4g e GHSA-c83g-rgw3-j3cx,
    vulneráveis até a 4.28.6 — **não casavam com achado nenhum**: o
    lockfile tem a 4.28.9. Um bump as corrigiu e a lista seguiu
    silenciando-as, e o documento dizia que isso reprovaria ("a guarda
    passa a reprovar por sobra") — a guarda comparava a lista com o
    documento, nunca com o registro. **Corrigido no PR A:** as duas saíram
    do `package.json` e do documento (contagens 20 → 18, a cadeia de build
    7 → 5, a frase reescrita); nasceu `scripts/audit-orphans.mjs` (o
    `audit` com a lista vazia, recusando toda exceção sem achado), passo
    novo do job de audit no `ci.yml`; e a `workflow-hardening` cobra o
    passo (vista reprovando antes de ele existir). O script foi visto
    reprovando sobre as duas órfãs (`saída 1`) e passando depois (`18
    exceções silenciadas, todas ainda casam`).
- [!] **A6.03 — CodeQL: os alertas abertos, contados e decididos.** Em 24/09 a
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
  - Contados pela API do code scanning em 24/09 20:55: **10** abertos na
    `main`, **11** na `dev` — exatamente os da lista acima. Decididos, um a
    um, no PR A:
  - **`js/polynomial-redos` (`redact.ts:33`) — o defeito de produção.**
    Medido: `redactEmails` sobre uma corrida sem `@` de 16 mil caracteres
    custava **182 ms**, de 64 mil **2,9 s**, de 400 mil **60 s** — e o
    `scrubMessage` redige **antes** de truncar, então o texto chega
    inteiro. A regex tentava um endereço a partir de cada caractere da
    corrida. Corrigido com um *lookbehind* negativo — `(?<![A-Za-z0-9._%+-])`
    —, que só começa onde a corrida começa e **não muda nenhum match** (o
    que casa do meio da corrida é o mesmo `@` e o mesmo domínio do
    começo): 64 mil em **0,3 ms**. Duas guardas novas em
    `tests/security/pii-in-logs.test.ts` — a de tempo (400 mil caracteres
    em < 1 s; a regex antiga levou 60 s nela) e a de equivalência (três
    casos, inclusive o do começo de corrida que falha e um seguinte que
    casa), vista a primeira reprovando antes da correção.
  - **Os 7 `js/file-system-race` (testes):** o mesmo desenho nos sete
    — `statSync(full)` entre a listagem e o `readFileSync(full)`. Trocados
    por `readdirSync(dir, { withFileTypes: true })`, e o `statSync` saiu
    dos imports.
  - **`js/incomplete-sanitization` (`i18n-messages.test.ts:86`):** a chave
    ia para uma regex com só o ponto escapado — escape de todo
    metacaractere.
  - **`js/regex/missing-regexp-anchor` (`image-optimizer.test.ts:118`):**
    `toMatch(/NewsData\.io/)` virou `toContain('NewsData.io')`, que diz o
    mesmo.
  - **`js/incomplete-multi-character-sanitization` (`feed-text.ts:143`)
    — dívida com gatilho no §16**, o único que fica aberto: o `htmlToText`
    decodifica, tira tag e decodifica de novo, então `&amp;lt;script&amp;gt;`
    volta como `<script>` **em texto**. Nenhum consumidor o trata como HTML
    (o React e a newsletter escapam), e o gatilho — o primeiro que
    renderizar como HTML — já tem guarda no web: `browser-surface.test.ts`
    reprova o terceiro `dangerouslySetInnerHTML`.
  - **O que impede a lista de voltar a crescer calada:** zerada, cada
    alerta novo *high* reprova o check do CodeQL no PR. Os fechamentos se
    confirmam na primeira análise da `dev` depois do merge do PR A.
- [x] **A6.04 — Dependabot.** A configuração da `main` válida (a guarda) e os PRs
  chegando com base `dev` — os seis de **21/09** são a evidência, e a triagem
  está no A0.02. · C
  - `git show origin/main:.github/dependabot.yml` parseado pelo `yaml`:
    versão 2, dois `updates`, os dois com `target-branch: dev`, 22
    `ignore` no npm; `git diff origin/main origin/dev` nesse arquivo:
    vazio. Todo PR do robô desde 19/09 com base `dev` (#224–#229 de 19/09,
    #234–#239 de 21/09, #240 de 24/09); o #237 segue aberto, como decidido.
- [x] **A6.05 — Gitleaks.** O scan de PR varre > 0 commits; o do push de merge
  varre 0 (a dívida do §16) — medido de novo no merge desta fase. · C
  - Medido nos últimos da esteira: o scan do PR #241 (run 36043018299)
    **`1 commits scanned`**; o do push do merge dele na `dev` (run
    36043747672) **`0 commits scanned`**, com ✅ — a dívida do §16, mais
    uma vez. **Gatilho que fecha a linha:** o merge do PR A desta fase
    (a medição "de novo no merge desta fase").
  - **Medido em 25/09, nos merges desta fase:** os scans de PR varreram
    **14** (PR A, run 36180333627) e **3** commits (PR B, run 36189034159);
    os pushes dos merges na `dev` — #242 (run 36184677181), #243 (run
    36184937508) e #244 (run 36190165713) — varreram **`0 commits
    scanned`** cada, com ✅. A dívida do §16 continua como estava: o
    conteúdo é varrido no PR, o gate do merge é decorativo.

## M7a — Produção sem o Render (dá para fazer agora)

> **Autorizado pelo dono em 24/09/2026.** O que precisa dele, e mais nada:
> `npx neonctl@latest auth` no terminal dele (abre o navegador; a sessão
> guardada foi **rejeitada** de novo em 24/09 — `invalid_request` —, e o
> `neonctl` não está no PATH do Bash, o `npx` resolve) e a leitura do painel do
> Render. **O agente nunca digita nem imprime credencial**: a string de conexão
> do branch vai do `neonctl` direto para
> **`apps/api/.env.neon-branch.local`** (ignorado pelo padrão `.env.*.local`
> da raiz — conferido com `git check-ignore`), e os comandos a leem de lá sem
> ecoá-la.
>
> **O branch copia dado pessoal** (`User`, `Subscriber`) para outro endereço do
> mesmo projeto Neon e para o processo local. Nenhuma tela do admin mostra
> e-mail; a decisão de usar o branch é do dono, e ele é apagado no M8.

- [x] **A7.01 — As horas do Render, lidas agora.** O dono lê em Render →
  Billing as *free instance hours* de setembro **por serviço** (a API e o
  `NetsheetEngine`) e a data da suspensão, e anota. É **agora** ou nunca: no
  dia 1º o contador zera. É o número contra o qual o A7.05 confere o arco. · P
  - **Lido pelo dono em 25/09: `Free Instance Hours 753.4 hours / 750
    hours`**, o mês corrente, para o workspace. **A divisão por serviço e o
    evento de suspensão não estão onde o dono os procurou**, e o agente não
    os alcança por outro caminho (`render whoami` → `unauthorized`: a
    sessão do CLI expirou, como em 19/09). A linha fecha com o que o número
    sozinho prova: (1) o teto estourou — é a causa da suspensão, não outra;
    (2) **753,4 seis dias depois da suspensão, só 3,4 h acima do teto** —
    nenhum dos dois serviços acumulou hora desde 19/09, então a suspensão é
    **do workspace**, e o `NetsheetEngine` está parado junto com a API; (3)
    contra o arco do A7.05 (11,99 h — a única linha de `DailyUptime`), o
    arco mede **um dia de um serviço**, e o total do mês é este. A hora da
    suspensão fica no intervalo que o próprio dado deu: **depois das
    16:04:25 UTC de 19/09** (o último tique do heartbeat no `DailyUptime`,
    A7.05) **e antes das 17:23** (a sonda do item 82). Quanto do mês foi de
    cada serviço fica sem número — não muda nenhuma decisão aberta: a de
    01/10 é esperar o mês virar.
- [x] **A7.02 — As pré-checagens da promoção.** `dev..main` = 0; nenhuma
  migration nova desde o #215; nenhuma env nova; `git ls-tree -r --name-only
  origin/main | git check-ignore --stdin` vazio; as specs do smoke iguais às
  da promoção (`git diff 4efbacd.. -- apps/web/e2e` vazio em 24/09). Repetidas
  no A7.12, na véspera de promover. · C
  - 24/09 21:00 UTC: `dev..main` = 0 (`main..dev` = 34); `git diff
    origin/main origin/dev` e `origin/main HEAD` em `migrations/`: vazio;
    env: a única diferença em `env.ts`/`render.yaml`/`.env.example` é o
    `import './load-env-file'` do #241 — nenhuma variável nova; `git
    ls-tree -r --name-only origin/main | git check-ignore --stdin`: vazio;
    `git diff 4efbacd HEAD -- apps/web/e2e`: vazio. Repetir no A7.12.
- [x] **A7.03 — O branch do Neon.** **Criado em 24/09/2026, antes do M0:**
  `fase-12-ensaio` = `br-divine-poetry-an2fw98r`, filho de `production`
  (`br-fancy-tree-anbql74y`), endpoint `read_write` `ep-dry-flower-anm16wsr`,
  **expira em 23/10/2026 23:00 UTC** — o máximo do Neon é 30 dias a partir de
  agora (a primeira tentativa, 24/10 23:00, foi recusada por passar dele), e
  estende com `branches set-expiration`. Os 30 dias e não os 14: o branch
  congela o retrato de 19/09, inclusive os `ErrorEvent` das sondas da
  promoção, que em produção somem aos 14 dias (03/10) — e depois de 01/10 o
  pipeline volta a expurgar. Um papel (`neondb_owner`) e um banco (`neondb`),
  então o `connection-string` não pergunta nada. **Evidência:** o
  `apps/api/.env.neon-branch.local` tem uma linha, começa com
  `DATABASE_URL=postgres`, aponta para o endpoint do branch e o `git status`
  não o mostra; `prisma migrate status` → `at
  "ep-dry-flower-anm16wsr.c-6.us-east-1.aws.neon.tech"`, 7 migrations,
  `Database schema is up to date!`; retrato só de leitura: último run
  `2026-09-19T11:00:00Z` `SUCCESS`, último briefing 19/09, 88 `Article`,
  10.490 `News`, 10 `ErrorEvent`, **0 `AuditEvent`**, 13 `SourceHealth` (um
  dia), **1 linha de `DailyUptime`**, 1 evento da 9.5, **0 da 5.5** (a Fase 9
  nunca foi a produção), 1 `User`.

  O que era o texto desta linha: um branch **normal** (não *schema-only* —
  as abas precisam do dado), filho de `production`, com data para expirar:
  `npx neonctl@latest branches create --project-id rapid-art-19064809 --name
  fase-12-ensaio --parent production --expires-at <hoje + 14 d>`, e a string
  de conexão escrita no arquivo sem passar pela tela —
  `printf 'DATABASE_URL=%s\n' "$(npx neonctl@latest connection-string
  fase-12-ensaio --project-id rapid-art-19064809)" >
  apps/api/.env.neon-branch.local` (a substituição de comando não imprime;
  o schema só lê `DATABASE_URL`, sem `directUrl`, então uma variável basta).
  Evidência: o arquivo existe, tem uma linha, e `git status` não o mostra —
  nunca o conteúdo. Plano free: 10 branches por
  projeto, 100 CU-h/mês, 0,5 GB — o filho é *copy-on-write* e nasce sem
  consumir espaço. Como o dado de produção não muda enquanto a API está
  suspensa, criar o branch cedo ou tarde dá o mesmo retrato. · N
- [!] **A7.04 — `gates:rehearse` contra os retidos**, com o `DATABASE_URL` do
  **branch** numa sessão só → **zero reprovações**; a distribuição de tamanho e
  de deriva calibra `MAX_ARTICLE_CONTENT_LENGTH` (p95 × 2) e `MAX_CATEGORY_DRIFT`
  (p95 real) — se mudar, PR com os números. O script só lê, e o branch tira o
  risco do resto. · N
  - **Primeira vez contra os retidos de produção** (24/09 21:05 UTC, o
    `DATABASE_URL` do branch carregado por `scratchpad/with-env-file.mjs`,
    nunca na linha de comando). **Portão de saída, 88 briefings:** zero
    bloqueios e zero avisos nos seis checks; corpo p50 8.007 · p95 10.691
    · máx. 11.921; português 0,195–0,339 contra o piso 0,08. **Portão de
    entrada, 158 dias:** volume/mediana 0,52–2,26 contra o piso 0,3 (zero
    bloqueios); deriva p95 0,172, máx. 0,828 (dois avisos, 16 e 17/08);
    frescor zero.
  - **O defeito era do ensaio:** a primeira passada deu **3 reprovações
    de diversidade e saída 1** ("o errado é o portão") — 12/09, 04/09 e
    21/08, com 2 fontes em 15. Mas o portão real alarga para 30 antes de
    bloquear, e o ensaio não alargava: reconstruindo as 30 mais recentes
    gravadas em cada dia (`scratchpad/neon-diversity.cjs`), eram **6, 5 e
    3 fontes** — nenhum teria bloqueado. **Corrigido no PR A:**
    `scripts/rehearse-gates.ts` reconstrói o alargamento (as `News` do dia
    UTC, na ordem do `selectTopItems`) e separa `bloquearia` · `passaria
    alargando` · `indeterminado`. Segunda passada: **zero reprovações,
    saída 0** — "Nenhum retido reprovaria". A dívida do §16 "os portões
    nunca foram ensaiados contra produção" fechou.
  - **Calibração ("se mudar, PR com os números"):**
    `MAX_ARTICLE_CONTENT_LENGTH` 20.000 → **21.382** (p95 × 2);
    `MAX_CATEGORY_DRIFT` 0,5 → **0,25**, e **não** o p95 do conjunto: a
    série tem dois regimes — a transição do classificador (16–21/08,
    0,828 a 0,184) e o estável desde 26/08 (máx. 0,177, p95 0,101) —, e o
    p95 geral (0,172) degradaria dias normais como 02/09 (0,177). Com 0,25
    avisariam 4 de 155 dias, todos da transição. O motivo mora no
    comentário da constante; a suíte do portão que fixava "0,4 fica
    abaixo do teto calibrado por cima" passou ao teto novo.
- [!] **A7.05 — As três abas com dado de produção.** API e web **locais** com
  o `DATABASE_URL` do branch, o `CRON_SCHEDULE` do A0.07 (sem ele, às 08:00 a
  API local roda um pipeline real no branch) e a sessão forjada pela mecânica
  do `capture-admin.mjs` com o `User.id` do dono, que está no dado. Conferir
  cada painel contra o SQL do branch: as 13 fontes reais até 19/09, as
  invariantes dos runs reais, os Portões (a 9 nunca rodou em produção — vazio
  esperado), as falhas reais das sondas da promoção (`AUTH_TOKEN_INVALID`), a
  trilha. **O arco das horas contra o número do A7.01** — lido **antes** do
  primeiro tique do heartbeat (5 min), que escreve no `DailyUptime` do branch
  e somaria 300 s de uma instância que não é a do Render. **Esperado, não
  achado** (medido no A7.03): o `DailyUptime` tem **uma** linha — a
  instrumentação começou às 01:08 de 19/09 e a API parou no mesmo dia —, então
  o arco mostra horas de um dia contra o mês inteiro do Billing; a trilha de
  auditoria está **vazia** (nenhuma ação de admin em produção desde a
  promoção); o painel Portões está **vazio** (zero eventos 5.5). O que o arco
  prova aqui é a **conta** (soma ÷ 3600 contra o SQL), não o total do mês.
  `admin:capture` das três abas com o dado real, cada imagem olhada. · N
  - API e web locais sobre o branch (API às 21:09:10 UTC de 24/09, cron
    neutralizado), sessão forjada com o `User.id` do dono
    (`72425847-…`, `ADMIN`). **O arco, antes do primeiro tique:**
    `secondsUsed 43170`, `hoursUsed 11.99` = a única linha de
    `DailyUptime` (19/09, último tique às **16:04:25 UTC** — o que estreita
    a suspensão de 19/09 para depois das 16:04, e não "entre 13:00 e
    17:23"). A conta fecha; o total do mês é o do Billing (A7.01).
  - **Nota de relógio:** o limite de uso da sessão pausou o trabalho com
    a API ligada ao branch, e ela ficou de pé até 01:40 UTC de 25/09 — o
    heartbeat somou ~4,5 h desta máquina ao `DailyUptime` **do branch**
    (as capturas mostram 16 h). Produção não foi tocada.
  - **As três abas, conferidas contra o SQL do branch** (16 capturas em
    `scratchpad/captures/a705/`, olhadas por recorte): `/admin` — "Último
    briefing há 134 h 35 min, atrasado · 19 de set., 08:01"; faixa com
    27/08–02/09 verdes, 30–31/08 vazados (a suspensão), e **12 dos 16
    runs desde 05/09 degradados pela etapa 1**; run de 19/09 "Degradado
    pelas etapas 1 e 6" (o fallback para o Groq). `/admin/metrics` — as 13
    fontes "não tentadas" hoje (25/09, sem run), 1 dia em falha para
    Drauzio Varella e InfoMoney, as 13 latências iguais às da
    `SourceHealth` (1,8 s · 3 s · 3,5 s · 6 s · 1,5 s · 3,7 s · 7,4 s ·
    1,1 s · 6,2 s · 4,4 s · 8,1 s · 6,6 s), rosquinha com **386 novas** =
    Σ`kept` (G1 100, Valor 98, newsdata 75…; "Outras 6" = 32).
    `/admin/security` — janela de 24 h vazia (o dado para em 19/09) e a de
    7 d com as sondas da promoção (`AUTH_TOKEN_INVALID` em 7 rotas de
    admin, 19/09 01:09) mais os `WARN` das etapas 1 e 6; **Invariantes**:
    19/09 08:01, "1 violada de 12", 123 ms de 2 s; **Portões**: 100% sobre
    2 runs — runs que nenhum portão viu (a Fase 9 nunca foi a produção);
    o `apps/web/CLAUDE.md` decidiu que é o estado certo antes da
    promoção; **Auditoria**: vazia.
  - **Achado 1 — o cadáver de 03/09.** A invariante violada é
    `pipeline.no_stale_running`, e o SQL a explica: o run de 03/09, o do
    `SIGTERM` no meio da 8.5 (item 46), está `RUNNING` há três semanas —
    10 eventos, o último às 11:01:07 da 8.5 —, e a faixa o desenha cinza
    cheio, "Rodando". O enterro só olhava o run **de hoje** (o `findFirst`
    da idempotência é na janela do dia). **Corrigido no PR A:** o
    `triggerPipeline` enterra todo `RUNNING` além do prazo, de qualquer
    dia, antes da checagem do dia (`buryDeadRun`); guarda nova em
    `tests/services/pipeline.test.ts`, vista reprovando antes (A1.43). Em
    produção ele sai no primeiro disparo depois da promoção.
  - **Achado 2 — a captura fotografava o esqueleto.** Com a API a ~1,7 s
    por consulta (o Neon em us-east-1), a primeira `/admin` saiu toda em
    esqueleto e "0 notícia no total", com HTTP 200: o `networkidle` fecha
    antes de as consultas do cliente voltarem. **Corrigido no PR A:** o
    `admin:capture` espera não haver `.animate-pulse` na tela e, se
    passar de 30 s, **falha a foto com o motivo**. A segunda rodada: 16/16
    com dado.
  - **O que o dado real mostrou e é decisão do dono, não defeito:** a
    etapa 1 degradou por `feed-failed` — **Drauzio Varella em 9 dos 12
    runs desde 05/09** (quatro seguidos, 08–11/09: o gatilho "Fonte
    quebrada" do §16 disparou antes de a tela que o mede estar no ar), a
    Folha em 7, a InfoMoney em 19/09. O feed do Drauzio responde **200 em
    < 0,6 s daqui** (três tentativas) e falha em 1,8 s saindo do Render —
    cara de bloqueio de IP de datacenter, que não se reproduz nesta
    máquina. E o gatilho "Degradação virou norma" (3 dias seguidos pelo
    mesmo `degradedBy`) também disparou duas vezes (05–12/09, 14–16/09);
    hoje o alerta está calado, e certo: os runs de 17 e 18/09 foram limpos.
  - **Decidido pelo dono em 25/09: o Drauzio sai.** PR **#243**, contra a
    `dev` (separado deste, porque tirar fonte é mudança de produto): a
    entrada de `rss-sources.ts` com o motivo escrito, a contagem 12 → 11
    onde o `feed-count-drift` a lê, e os testes do fetcher trocando o feed
    por outro configurado — o helper `rss()` monta um desfecho por entrada
    de `rssSources`, então uma falha com o nome de um feed fora da lista
    **sumia em silêncio** e o caso seguia verde testando menos. O acervo
    guarda os itens dele em `HEALTH` (a 8.5 só reclassifica fonte sem
    categoria fixa), e produção tem **uma** linha de `SourceHealth` dele
    (19/09, `FAILED`) — a sequência de falhas fica em 1, abaixo do
    gatilho de 3, e o painel "Fontes" não herda alerta aceso. A Folha
    (7 de 12, intermitente) não entrou na decisão.
- [x] **A7.06 — A cota de imagem.** Sonda numa imagem em `MISS` (nunca `HIT`) no
  `/_next/image` de produção — é a Vercel, não o Render. · P
  - 25/09 01:40 UTC: as imagens da home de produção (`/pt-BR`, `STALE`) em
    `/_next/image` responderam **`200` com `x-vercel-cache: MISS`** — a
    cota voltou (em 19/09 era `402` em toda `MISS`). A resposta é imagem
    otimizada (`image/jpeg`, 8.572 B para `w=1920` de uma foto da BBC de
    240 px). **Descuido meu:** o laço de sonda devia parar na primeira
    `MISS` e gastou oito transformações (8 de 5.000).

## M7b — Produção com o Render (espera a API voltar, e a decisão de promover)

> A API do Render está suspensa desde 19/09 (503 `x-render-routing: suspend`,
> reconferido em 24/09). As 750 h são do **workspace** e zeram **no começo de
> cada mês** (documentação do Render): a data provável é **01/10**. **O dono
> decidiu em 24/09 esperar o dia 1º**, e não mover o serviço para uma
> instância paga (Starter, US$ 7/mês proporcional ao segundo — a saída que
> existia). O build da Vercel falha de
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
- [ ] **A7.12b — A segunda janela da correção da ESPN** (decidida pelo dono em
  25/09, A4.04). A ESPN escreve a hora de Brasília com o rótulo `EST`, e tudo
  o que o código **antigo** gravou dela está 2 h adiantado. A correção é
  `fase12-kit/espn-fix.cjs`, **por janela de `createdAt`** — duas janelas
  disjuntas nunca deslocam a mesma linha duas vezes. **A 1.ª janela**
  (`createdAt < 2026-09-25T21:30:00Z`) foi ensaiada no branch do Neon em
  25/09 (648 linhas; no futuro na ingestão: 23 → 0; menor idade: −1,906 h →
  +0,094 h) e **entregue ao dono** para rodar em produção — o classificador
  do agente recusou buscar a credencial de produção, e o agente não a
  contorna. **A 2.ª janela** (`2026-09-25T21:30:00Z ≤ createdAt < <hora do
  deploy do Render com o conserto>`) cobre o que o código antigo gravar entre
  a volta da API e a promoção — o cron das 11:00 UTC roda o código da `main`.
  **Antes de rodar a 2.ª, confira a 1.ª** com `dry - 2026-09-25T21:30:00.000Z`
  em produção: `no futuro … 0` e menor idade ≥ 0 quer dizer que ela rodou; se
  ainda disser 23 no futuro, **uma** execução `- <deploy>` cobre as duas. Quem
  roda em produção é o dono (ou o agente, se o dono autorizar a credencial). · P
  - **A 1.ª janela RODOU em produção, pelo dono, em 25/09** (endpoint
    `ep-quiet-tree-anx52w4o`, o de `production` — o do branch de ensaio é
    `ep-dry-flower-anm16wsr`): `dry` → 648 linhas, 23 no futuro, menor idade
    −1,906 h; `apply` → **648 corrigidas**, depois **0 no futuro**, menor
    idade **+0,094 h** — os mesmos números do ensaio no branch. O backup
    (`espn-fix-backup-ep-quiet-tree-anx52w4o-2026-09-25T21-30-00-000Z.json`,
    no kit: 648 pares `id`/`publishedAt` de 20/08 a 19/09) desfaz, se for
    preciso; o arquivo da credencial foi apagado logo depois. **Para a 2.ª
    janela, então, a conferência do `dry` sobre a 1.ª deve dizer 0 no
    futuro**, e a execução é `<2026-09-25T21:30:00.000Z> <deploy>`.
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
