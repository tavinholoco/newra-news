# Newra News — Monorepo

## Estrutura
- Monorepo com Turborepo + pnpm workspaces
- apps/web → Frontend Next.js 14+ (App Router)
- apps/api → Backend Fastify + TypeScript
- packages/database → Prisma ORM (schema + client)
- packages/types → Types TypeScript compartilhados
- packages/eslint-config → ESLint configs
- packages/tsconfig → TSConfigs base

## Comandos
- `./scripts/dev-bootstrap.sh` — **ambiente pronto do zero**: Postgres, envs locais, migrations, imagens de placeholder e seed (idempotente; não sobrescreve `.env` existente). Use em container novo antes de rodar o app ou capturar screenshots
- `pnpm install` — instalar dependências
- `pnpm dev` — rodar todos os apps em dev. **O postgres sobe e para junto com o dev server da API** (`scripts/dev-with-db.mjs`); o vigia `scripts/docker-idle-stop.ps1 -Install` para o que escapou por kill forçado. `docs/setup.md` §4.1
- `pnpm build` — build de produção
- `pnpm lint` — ESLint em todo o monorepo
- `pnpm test` — Vitest (backend + frontend). **Não precisa de banco** — assim como `lint`, `typecheck` e `build`
- `pnpm --filter @newranews/web visual:baseline` — capturas das rotas públicas (§30 do plano V2); exige app no ar. Em ambiente com Chromium pré-instalado, exportar `CHROMIUM_PATH`. **O conjunto versionado é capturado de produção**, não do local — ver "Fechar uma fase" abaixo
- `pnpm --filter @newranews/web admin:capture` — fotografa as telas de **admin**
  (as três abas — `/admin`, com um run expandido, `/admin/metrics` e
  `/admin/security`) em 375 e 1440, claro e escuro, com uma sessão forjada
  localmente. A baseline visual exclui essa área
  porque exige sessão, então até 07/09 ela **nunca esteve em captura nenhuma** —
  e é onde as fases 5, 6, 8, 9 e 11 do plano de observabilidade trabalham. Só
  aceita localhost, e exige `NEXTAUTH_SECRET` local diferente do de produção.
  Detalhe em `apps/web/CLAUDE.md`
- `pnpm --filter @newranews/api archive:hygiene` — **mede a higiene de texto do
  acervo contra produção** (§12.D). Varre `/api/news` e conta as seis classes de
  defeito que a Fase 12 zerou; sai 1 se alguma tiver linha, 2 se a API não
  responder. A correção alcança o que já está gravado pela **etapa 8.5**, que
  roda uma vez por dia — então o acervo só converge no dia seguinte ao deploy, e
  é este comando que diz se convergiu
- `pnpm db:migrate` — rodar migrations Prisma
- `pnpm db:generate` — gerar Prisma Client
- `pnpm db:studio` — abrir Prisma Studio

## Onde o trabalho integra: `dev`, e a `main` só por promoção

**Decidido em 05/09/2026.** O trabalho entra por PR na **`dev`**; a `main` recebe
`dev → main` quando **você decide**, e é esse merge que publica. O motivo é
direto: a `main` é o que está no ar, e mergear fase a fase nela é convidar
janela de site quebrado por mudança que ainda não precisava estar em produção.

A `dev` foi alinhada à `main` em 05/09 (era 217 commits atrás, zero à frente —
fast-forward limpo). **Se ela voltar a ficar para trás, alinhe antes de abrir
qualquer PR**, senão a fase é desenvolvida contra código velho:

```bash
git fetch origin && git push origin origin/main:refs/heads/dev
```

> **E há um terceiro estado, que o par de comandos acima não cobre: as duas
> à frente uma da outra.** Aconteceu em 14/09/2026 com o #193 — um PR **só de
> configuração na `main`** (o `dependabot.yml`, que a plataforma lê da branch
> padrão) enquanto a `dev` carregava 30 commits do plano. O `push` acima é
> recusado (não é fast-forward), forçar apagaria a `dev`, e abrir `dev → main`
> seria promover para sincronizar. **O certo é o inverso: mergear a `main` na
> `dev` por um PR** (`git checkout -B chore/sync origin/dev && git merge
> origin/main`) — o diff de conteúdo é vazio quando os dois lados já têm o
> mesmo arquivo, e é assim que `git rev-list --count origin/dev..origin/main`
> volta a zero. Só configuração que a plataforma lê da branch padrão justifica
> um PR direto na `main` no meio do plano; tudo o mais espera a promoção.

**O que roda em cada base — confira antes de assumir:**

| Workflow | Base `dev` | Base `main` |
|---|---|---|
| CI (Lint, Test, Build, `pnpm audit`) | ✅ | ✅ |
| CodeQL | ✅ | ✅ |
| Gitleaks | ✅ | ✅ |
| Smoke E2E | ❌ | ✅ (push) |
| Migrate (Prisma) | ❌ | ✅ (push) |

As duas últimas ficam **só na `main` de propósito**: o smoke mede o site no ar, e
migration se aplica a produção uma vez. A consequência prática é que **um lote
de fases com schema aplica todas as migrations juntas na promoção** — o que é
uma janela controlada, mas é uma janela: promova com isso em mente.

**A promoção dispara sozinha o que precisa disparar.** `dev → main` é um push na
`main`, então Smoke E2E e Migrate rodam sem ninguém lembrar; o Lighthouse e a
baseline continuam manuais, e estão logo abaixo.

> **O Dependabot furava esta política até 09/09/2026.** Sem `target-branch`, ele
> abre contra o branch **padrão** do repositório — a `main` —, e foi o que
> aconteceu: quatro PRs de bump (#174, #169, #171, #170) entraram direto na
> branch que publica, pulando a `dev` e o preview, cada um disparando Smoke E2E e
> um deploy. Um deles subiu `@base-ui/react` e `@tanstack/react-query`, que são
> **dependências de produção**. Hoje as duas entradas do
> `.github/dependabot.yml` declaram `target-branch: dev`. **E o campo só vale
> na branch padrão** — o Dependabot lê a configuração da `main`, e a correção
> de 09/09 tinha ficado só na `dev`: em **14/09** ele abriu **seis** PRs contra
> a `main` de novo (#186–#191, cinco majors que não podem entrar), fechados no
> mesmo dia. Mudança no `dependabot.yml` vai para a `main` num PR só com ele,
> sem esperar a promoção. **Se voltar a aparecer PR de bump com base `main`, é
> a versão da `main` que está velha.**
>
> **Terceira rodada, 19/09/2026 — três minutos depois de a promoção (#215)
> levar a configuração à `main`:** cinco PRs contra a `dev`, três majors
> reprovando que a lista não previa (`zod` 4 — produção da API, 258 testes;
> `vitest` 5, que exige o vite 7; `@typescript-eslint` 8, que exige o ESLint
> 9). Entraram no #222, direto na `main`. **E o arquivo ganhou guarda**
> (`apps/api/tests/build/dependabot-config.test.ts`): um YAML inválido ali
> passava por todo o CI e desligava o Dependabot em silêncio — quase
> aconteceu, por um `@` sem aspas. Item 81.

**As duas plataformas publicam pela `main`, e isso foi conferido.** A Vercel por
padrão; o **Render também — confirmado no painel em 05/09/2026**. Vale registrar
porque o `render.yaml` **não declara `branch:`**: a configuração vive no painel,
então nenhum arquivo deste repositório prova onde ela está. Se a API um dia
passar a publicar de outra branch, é lá que a resposta está — e a política de
promoção estaria invertida sem nada aqui acusar.

A `dev` ganha deploy de preview na Vercel, que é onde dá para olhar o lote antes
de promover.

### A promoção espera o plano de observabilidade terminar — 07/09/2026

> **Promovido em 19/09/2026 (#215, `4efbacd`) — o lote das Fases 4, 5, 8,
> 11, 6, 7c e 7b, com as três migrations juntas.** A seção abaixo é a
> política que valeu de 07/09 a 19/09 e o que ela custou; a medição da
> promoção está no item **81** do `docs/progress.md` (a janela dos deploys
> durou ~1 min; smoke 31/6 pulados; Lighthouse verde; Gitleaks `0 commits`
> sobre 68). **O que sobra do plano é a Fase 9**, que vai sozinha, por
> decisão. A `dev` foi realinhada por fast-forward no mesmo dia.

**Decidido depois da Fase 2.** As onze fases do plano integram na `dev` e a
`main` recebe **uma promoção só, no fim**. O argumento é o mesmo que criou a
política: a `main` é o que está no ar, e o plano é trabalho de instrumentação
que não precisa ir a produção fase a fase.

**O que isso custa, e é preciso ter na mão:**

- **Nenhuma fase é medida contra produção até a promoção.** O ritual é do lote,
  e o lote passou a ser o plano inteiro. O que sobra medindo no caminho é o CI
  de PR (lint, testes, build, `pnpm audit`, CodeQL, Gitleaks), o preview da
  Vercel na `dev` — e, desde 07/09, a **captura de admin local**, que alcança
  justamente a área onde cinco das fases restantes trabalham.
- **As migrations das fases 4 e 11 aplicam juntas**, porque o `migrate.yml`
  dispara no push da `main`. Já era "janela controlada"; agora a janela é o
  plano inteiro.
- **O Smoke E2E não roda em nenhum PR de fase** — ele é da `main`.
- **A `main` roda com um `.gitignore` mais velho que o da `dev`, e isso já
  mordeu.** Regra de ignore criada durante o plano só chega à `main` na
  promoção — então **toda branch cortada da `main` fica sem ela**. Em 08/09 o
  commit `b94ec6c`, que mudava duas linhas de README, levou junto **13 PNGs
  (3,5 MB)** de `apps/web/.admin-captures/`, um caminho que a `dev` ignora desde
  o PR #158 e que o `capture-admin.mjs` declara não versionar. Item **55**.

> ⚠️ **`.gitignore` não desversiona o que já está versionado — e a
> sincronização `main → dev` do #200 trouxe os 13 PNGs para a `dev`, ainda
> rastreados.** O `git rm --cached -r apps/web/.admin-captures` que este aviso
> pedia para a promoção **foi feito no PR 5c (14/09)**, quando a captura os
> marcou todos como modificados; a remoção viaja para a `main` na promoção
> como qualquer outro commit. O que continua valendo é a conferência: antes de
> promover, `git ls-tree -r --name-only origin/main | git check-ignore --stdin`
> diz se outro artefato ignorado na `dev` entrou na `main` pelo mesmo caminho.

> ⚠️ **O gatilho para promover antes do fim é a Fase 9.** Ela é a única que pode
> **deixar o site sem briefing** (§13: portão de saída que bloqueia e não cai
> para o provider de reserva), e o próprio plano manda rodá-la em modo
> observador contra os briefings retidos antes de ligar o bloqueio. Levá-la a
> produção dentro de um lote de nove fases é o oposto disso. **Promova antes de
> mergear a 9**, ou aceite que a primeira medição real dela será junto com tudo
> o mais.


## Fechar uma fase (o ritual, contra produção)

Roda **depois da promoção `dev → main` e do deploy** — as duas medições são
contra o site no ar, e cada uma pega o que a outra não pega. Nas Fases 4 e 5 as
duas acharam defeito.

> **O merge na `dev` não fecha fase nenhuma.** Ele passa o CI e para aí; nada do
> que está abaixo mede uma branch que não foi publicada. Rodar o ritual depois
> de um merge na `dev` mede a produção **anterior** e devolve verde sobre
> mudança que não está lá — que é o defeito mais caro que este projeto sabe
> produzir. O ritual é do lote promovido, não da fase.

**1. Lighthouse por rota.** Não espere a execução de segunda:

```bash
gh workflow run "Lighthouse CI" --ref main
```

Quando terminar, os scores saem no passo "Print scores" do log. Se alguma
categoria cair, o relatório completo vem por
`gh run download <run-id> -D <dir>` e o audit reprovado está em
`lhr-*.json` → `categories.<cat>.auditRefs` com `score < 1`.

> **O workflow aquece sozinho desde 23/08 — não aqueça à mão.** O passo "Warm
> production before measuring" bate duas vezes em cada URL do
> `.lighthouserc.json` antes do collect.
>
> **Medido em 24/08: a API não estava hibernando.** O `uptime` do `/api/health`
> cresceu 1.878 s ao longo de uma janela de relógio de 1.881 s **sem uma única
> requisição minha nos últimos 17 min**, e a primeira resposta depois disso saiu
> em **0,29 s**. O aquecimento fica — agendamento de terceiro não é garantia, e
> já falhou —, mas **"deve ser a API dormindo" precisa de sonda antes de virar
> conclusão.**
>
> ⚠️ **E aquela medição era a conta chegando, lida ao contrário.** Uptime
> crescendo 1:1 com o relógio **é** a definição de 24/7, e 24/7 são 744 h no mês
> contra as **750 h** que o plano free do Render dá — 0,8% de folga. Em
> **29/08/2026** as horas acabaram e a API foi **suspensa até o dia 1º**, com
> três briefings perdidos.
>
> **Desde 01/09 não há keep-alive nenhum, e é decisão medida.** A API dorme, e
> quem precisava dela quente acorda sozinho: a rota do cron aquece antes de
> disparar, e este workflow aquece antes de medir. O custo que sobra é ~5 s de
> esqueleto na primeira matéria aberta em cada sessão. Ver `docs/setup.md` §9.0
> — os números, as duas tentativas que falharam, e o que conferir se a API for
> suspensa de novo.
>
> **A causa é a API dormir, e só ficou clara na auditoria da Fase 8.** O plano
> free do Render hiberna com ~15 min sem tráfego; `/pt-BR` e `/en` chamam
> `getHome`, então a requisição que dispara a regeneração da ISR espera a API
> acordar — medido: **4,9 s na primeira passada contra 0,22 s na terceira**, e a
> performance cai para ~81. **O sintoma migra**: em duas execuções seguidas o 81
> saiu primeiro na `/en` e depois na `/pt-BR`, sempre na que estava fria. A
> `/pt-BR/about`, única rota medida que não chama a API, ficou em 97 nas duas.
>
> Com o aquecimento no workflow: **92 · 90 · 97 · 97 · 91**, gate verde.
>
> **A `/news` caiu, o audit foi lido, e não era o aquecimento** (24/08, run
> [32679047022](https://github.com/tavinholoco/newra-news/actions/runs/32679047022)).
> Medido na execução ruim: **56 requisições na página, zero para a API**, e a
> mais lenta é o próprio documento em **214 ms** — nenhuma chamada de API
> participa do carregamento da `/news`. O que a derruba é o **LCP de uma `<img>`
> de card, em 4.390 ms**, servida por `/_next/image` a partir de
> `s2-valor.glbimg.com`; os audits que caem são `uses-responsive-images` e
> `image-delivery-insight`. É **entrega de imagem** (§10.6), não hibernação.
>
> A lição de fluxo: o aquecimento resolveu o problema *dele*, e a partir daí
> vira a explicação preguiçosa para qualquer queda. As rotas que **não** chamam
> a API (`/about`, `/article`) medem 96–98 com variância de 2 pontos; as que
> chamam variam muito mais — mas variância não é a mesma coisa que causa, e o
> audit é quem diz qual das duas está em jogo.

> **O gate mede sete rotas desde 24/08, e as duas novas são de detalhe.** O
> passo "Resolve the two detail routes" monta uma URL viva de `/news/[id]` e de
> `/article/[date]` a partir da API antes do collect — o motivo antigo de
> excluí-las (URL fixa apodrece) valia para a URL, não para a rota. Se a
> resolução falhar, o passo avisa e as cinco estáveis seguem sozinhas; ele
> **nunca** reprova o gate.
>
> **Medido em 24/08, medianas de 3 execuções:** `/pt-BR` 94 · `/news` 92 ·
> `/article` 96 · `/about` 97 · `/en` 95 · **`/news/[id]` 97** ·
> **`/article/[date]` 97**. As duas de detalhe são as melhores do produto — é o
> efeito de a Fase 11 tê-las tirado do render por requisição —, e o briefing tem
> **o único LCP abaixo de 2,5 s do conjunto (2,42 s)**, que é o alvo da §31.
>
> **A tabela impressa não é a mediana.** O passo "Print scores" imprime a
> execução *representativa*; o gate confere a mediana. Em 24/08 a `/article`
> saiu **92** na tabela com execuções `[96, 96, 96]` — mediana 96. Para o número
> que vale, baixe o artefato e calcule, ou leia o assert.
>
> **O gate confere a mediana desde 24/08, e antes conferia a melhor amostra.**
> O padrão do LHCI é otimista: com 3 execuções por URL ele assertava a **melhor**
> delas, enquanto o passo "Print scores" imprime a **representativa**. Os dois
> números discordaram na cara — `/news` em `[89, 90, 81]`, relatório dizendo 81,
> gate passando verde com o 90. `aggregationMethod: median` no
> `.lighthouserc.json`. Se o gate voltar a passar com um número ruim impresso,
> é este campo que sumiu.

**2. Baseline visual** (§30) — de produção, com as mesmas larguras do conjunto
versionado, senão o diff vira ruído:

```bash
BASE_URL=https://newra-news-web.vercel.app NEXT_PUBLIC_API_URL=https://newra-news-api.onrender.com/api OUT_DIR=../../docs/v2/baseline-v2 WIDTHS=375,768,1440 FORMAT=jpeg node scripts/capture-visual-baseline.mjs
```

(a partir de `apps/web/`). A captura é determinística: **só as telas que mudaram
aparecem no `git status`** — se aparecer imagem que você não mexeu, ou o conteúdo
do dia mudou, ou há algo errado.

> **O deploy da Vercel e o do Render disparam juntos no merge, e não terminam
> juntos.** Se o build do web correr antes de a API subir uma rota nova, o
> prefetch falha e a página estática nasce sem o dado. Conferir que a mudança
> está no ar **antes** de medir — foi assim que a `/news` foi para produção com
> as oito categorias zeradas.

**3. Smoke E2E** (§11.T) — desde a Fase 11, e ele **roda sozinho em todo push na
`main`**, esperando 7 min pelos dois deploys. Para disparar à mão:

```bash
gh workflow run "Smoke E2E" --ref main
```

Os fluxos da §25 — **visitante, acervo, conta e newsletter** — mais os casos
negativos de **autorização**, medidos contra produção. É o passo que pega a classe de defeito que os outros dois não
pegam — o desencontro entre os dois deploys. Localmente,
`pnpm --filter @newranews/web test:e2e` mede o mesmo alvo; `SMOKE_BASE_URL`
troca para um build local. **Ele não faz parte do `pnpm test`**: `turbo test` é
a suíte de unidade, que roda sem rede.

## Convenções de Código
- TypeScript estrito: sem `any`, sem `@ts-ignore`
- Imports absolutos com alias: `@newranews/database`, `@newranews/types`
- Validação com Zod em todas as rotas do backend
- Nomes de arquivo: kebab-case (news-card.tsx, pipeline.service.ts)
- Nomes de componentes: PascalCase
- Funções e variáveis: camelCase
- Enums: UPPER_SNAKE_CASE

## Regras Gerais
- Nunca instalar dependências com npm. Sempre usar pnpm.
- Nunca duplicar tipos entre apps — usar packages/types.
- Sempre adicionar testes ao implementar services no backend.
- Commits em inglês, seguindo Conventional Commits (feat:, fix:, chore:).
- Sempre validar schemas Zod antes de persistir dados.

## Stack de Testes
- Backend: Vitest + fastify.inject()
- Frontend: Vitest + React Testing Library (jsdom)

## Referência
- PRD completo: docs/PRD-NewraNews_V1.1.md (local-only, gitignored)
- Plano V2.0 (redesign editorial): docs/Newra-News-V2-Frontend-Redesign-Plan.md
- **Plano de observabilidade e painel do admin (à parte da linha das fases):**
  `docs/Newra-News-Observability-Plan.md` — log estruturado, taxonomia de erro,
  `ErrorEvent`, invariantes e as três abas do admin. **As Fases 10 (segurança do
  CI/CD) e 1 (o logger) fecharam em 05/09; a 2 (pipeline no admin) e a 7a (os
  `catch` do BFF) em 07/09, fechando o bloco 1; e a 3 (a taxonomia de erro) em
  09/09, abrindo a espinha; e a **4 (o `ErrorEvent`) fechou em 10/09, nos dois
  PRs**; e a **5 fechou em 14/09, em três PRs** — o **5a (a migration) e o 5b
  (a API) em 12/09, o 5c (o web) em 14/09**, fechando a espinha; e a **8 (o
  log de sucesso) fechou em 15/09**, abrindo o bloco 3; e a **11 (saúde por
  fonte) fechou em 15/09, em três PRs** — 11a (migration), 11b (API) e 11c
  (web); e a **6 (invariantes) fechou em 16/09, num PR só**; e a **7c (o
  caminho de ingestão do erro do cliente) fechou em 16/09, num PR só**; e a
  **7b (os boundaries e o reporter) fechou em 17/09, num PR só — com ela a
  Fase 7 inteira**; e **a promoção `dev → main` aconteceu em 19/09 (#215)**,
  com o ritual medido (item 81); e a **9 (os dois portões) fechou em 20/09,
  num PR só — a última do plano**, com o ensaio contra os retidos pendente
  da API voltar (item 83).** **Aberta desde 24/09: a Fase 12 — o ensaio de
  aceitação (§22)**, só de teste, sobre a matriz
  `docs/observability-acceptance.md`: cada coisa que as onze fases
  entregaram provocada ao vivo, com evidência observável; só a metade de
  produção publicada (M7b) espera a API voltar e a promoção.
  O **§19** é o ponto de entrada: traz o ritual, a ordem das 11 fases e o que uma
  sessão fria erra. Traz também a pesquisa de quais métricas e eventos de segurança um
  painel deve ter (OWASP A09 e vocabulário de log, quatro sinais de ouro do
  SRE, dimensões de qualidade de dado)
- **Advisories aceitas, com motivo, data e gatilho:**
  `docs/security-advisories.md` — o que `pnpm audit --audit-level=high --prod`
  não reprova, e por quê. A lista silenciada mora em
  `pnpm.auditConfig.ignoreGhsas` no `package.json` da raiz, e os dois não podem
  divergir
- Discovery da V2 (Fase 0 — tokens, sitemap, contratos, baseline visual): docs/v2/
- **Regras de uso dos tokens da V2 no código: `apps/web/CLAUDE.md`** — tabela papel → classe, o que a suíte proíbe e por quê
- Diagramas: `docs/diagrams/` — **seis**, reescritos em 01/09 contra o código:
  arquitetura, mapa de rotas do frontend, fluxo de sessão, ER, sequência do
  pipeline e fluxo de dados. Guarda de deriva em
  `apps/api/tests/docs/diagram-drift.test.ts`

## Status Atual

- **Plano de observabilidade (2026-09-24): aberta a Fase 12 — o ensaio de
  aceitação —, revisada e com o terreno pronto para o M0.** §22 do plano; a
  matriz linha a linha em **`docs/observability-acceptance.md`**; branch
  `observability/fase-12-acceptance` (cortada de `a0ae0fc`, com a `dev`
  trazida pelo merge `00f046b`). **Só teste — nada novo entra no produto**:
  as onze fases têm ~1.100 testes de unidade e nenhuma coisa que entregaram
  foi provada **em conjunto, com dado real, de ponta a ponta**. Dez marcos:
  **M0** terreno (commit fixo; suíte em **1.389/904**; o "antes" do banco; o
  **cron interno neutralizado** — o `server.ts` o registra sempre, às 08:00)
  · **M1** as **35** guardas vistas reprovando por um script versionado
  (`scripts/guard-mutations.mjs`, com a cobertura derivada, não digitada) ·
  **M2** cada um dos **18** `code` gravados provocado **pela porta real** ·
  **M3** as falhas virando `ErrorEvent`, o relato do cliente, a saturação, o
  visualizador do log contra texto da porta anônima · **M4** o pipeline com
  provedores reais (três runs, **todos no mesmo dia UTC**) e o ensaio
  adversarial nos dois destinos do portão de saída · **M5** as três abas ·
  **M6** a esteira (o CodeQL tem **10** alertas na `main` e **11** na `dev`,
  dois em código de produção) · **M7a** produção **sem o Render**: o Billing
  (antes de o mês virar), o `gates:rehearse` e **as três abas com dado real,
  sobre um branch do Neon** (**criado em 24/09**: `fase-12-ensaio`, expira
  em 23/10, conexão em `apps/api/.env.neon-branch.local` — A7.03) ·
  **M7b** produção **com o Render** (**01/10** — decidido em 24/09, sem
  instância paga):
  o `ignore` do #237 na `main`, a promoção, o ritual, o primeiro run real ·
  **M8** fechamento. **Dois PRs**: A (M0–M7a) pode mergear com o Render
  suspenso; B (M7b–M8) depois da promoção.

  > **A revisão da proposta (24/09, antes do M0) achou 25 inconsistências**
  > conferindo a matriz linha a linha contra o código — §22, "A revisão da
  > proposta". Sete linhas não podiam sair como escritas (o seed tem um run
  > `SUCCESS` hoje e o botão diria `already-succeeded-today`; um briefing e um
  > desfecho por dia com três runs no mesmo dia; a métrica em memória que o
  > reinício zera; o SIGINT que nenhuma ferramenta do agente produz no
  > Windows — o Ctrl+C é seu; a `/about` que nunca regenera). **A triagem do
  > Dependabot está feita** (os PRs são de 21/09, não 24/09): #234, #235,
  > #239 e #240 na `dev`; o #238 virou o **#241** (o dotenv 18 escrevia fora
  > do JSON a cada boot); o **#237 fica aberto até a API voltar**, porque
  > push na `main` dispara o Smoke. **Esperado, não achado:** todo run local
  > viola `briefing.one_per_day` (o dia bloqueado do seed), e o primeiro run
  > de produção dirá `baseline: 'insufficient'`. **Prompt de abertura** no
  > fim da §22.

- **Fora da linha das fases (2026-09-20): a Fase 9 fechou na `dev` — os
  dois portões, e com ela o plano de observabilidade inteiro.** §13, item
  **83**. A **etapa 5.5** mede a colheita antes de gastar a chamada de IA
  (volume contra a mediana de `newsCollected` dos 7 dias anteriores — sem 3
  dias de linha de base o portão **não opina**, e diz —, três fontes
  distintas alargando para 30 antes de bloquear, um item das últimas 24 h;
  duplicata e deriva só avisam). A **etapa 6.5** examina o candidato **por
  tentativa, dentro de `generateArticle`**: URL que não está no texto do
  material e envelope do prompt ecoado **falham o dia sem chamar o Groq**
  (segurança — repetir o material envenenado no segundo modelo é repetir o
  ataque); idioma e teto de tamanho caem para o Groq uma vez (qualidade).
  Bloqueio é `FAILED` na etapa do portão e `PIPELINE_GATE_BLOCKED` com **o
  motivo no `route`** (`stage-6.5:unanchored-url`; `FATAL` para segurança,
  escrito na hora). **Duas decisões mudaram o plano:** o conjunto de URLs
  ancoradas que a §13.2 descrevia é **vazio** (o `formatNewsItems` não manda
  URL) — ancora-se no texto do material; e a lista de *stopwords* do idioma
  é de **exclusão** (a de frequência dava espanhol 0,195 contra um piso de
  0,2; a de exclusão dá 0,018 contra 0,08). O **ensaio virou comando**
  (`pnpm --filter @newranews/api gates:rehearse`): contra o banco local,
  zero reprovações reais; **contra produção ainda não rodou** — a API segue
  suspensa — e é a primeira coisa a fazer quando ela voltar. O painel
  "Portões" na `/admin/security` (taxa de aprovação de 7 d, rosquinha de
  motivos, os dois gatilhos do §16 como alerta) é derivação sem rota nova.
  **A captura achou um defeito de duas fases atrás**: os `sr-only` da tabela
  de falhas escapavam do contêiner que rola e a página inteira rolava na
  horizontal a 375 px — `relative` nos três contêineres, e o `admin:capture`
  passou a **medir a largura do documento**. **1.299 → 1.377 na API, 881 →
  904 no web.** Falta a promoção `dev → main` — decidir antes se a 9 sobe
  sozinha ou com o que a `dev` acumulou desde o #215 — e nada disso anda
  com a API suspensa.

  > **A verificação pós-merge (item 84, 21/09) achou o aviso que publicava
  > o link injetado.** `copied-url` — URL que está no **texto** do material
  > — só avisava, e o atravessamento que a §13 pedia (a ordem e o link no
  > título do item, a saída que obedeceu) mostrou o `WARN` deixando o
  > briefing com o link ir ao ar. **Toda URL na saída bloqueia, por
  > segurança**; o material só distingue a procedência (motivo). Mais: o
  > briefing real de 18/09 virou fixture e guarda; o `gates:rehearse` não
  > era tipado (`scripts/**/*.ts` no `tsconfig.tests.json`); oito frases
  > envelhecidas fora do diff; o seed passou a contar a história inteira
  > (o dia bloqueado não tem briefing, e `briefing.one_per_day` sai violada
  > nos dois runs seguintes); a captura completa com a medição de largura
  > deu 21/21. **1.384 na API.**

- **Fora da linha das fases (2026-09-19): dois e-mails de cota, e toda
  regeneração da ISR era cobrada por um `new Date()` que ninguém lia.** Item
  **82**. O Render avisou **629 de 750 h** — e o e-mail nomeia o "segundo
  serviço" que o §9.0 do `docs/setup.md` suspeitava: **`NetsheetEngine`**, no
  mesmo workspace; a suspensão de 19/09 foi **entre 13:00 e 17:23 UTC** (a
  Home regenerou às 13:00:06 com a API respondendo). A Vercel avisou **75% de
  ISR Writes** (150 mil de 200 mil) e 100% de imagem. **ISR Write é unidade
  de 8 KB e conteúdo idêntico não cobra** — mas o `NextIntlClientProvider`
  serializava `now` = `new Date()` de cada render no payload RSC, então
  nenhuma regeneração era idêntica: Home 53 unidades, matéria 36, `/news` 28,
  de hora em hora nos dois idiomas ≈ **5.100 unidades/dia ≈ 150 mil em 30
  dias**, sem um visitante. Entrou `STATIC_NOW` (`lib/i18n.ts`), o
  `sitemap.ts` sem `lastModified: new Date()`, e — achado ao vivo — **os dois
  sitemaps deixaram de regenerar vazios com a API fora** (`sitemap.xml` tinha
  caído de 386 para 10 URLs e o news sitemap de 612 para 0, com 200 e
  `HIT`): `nullUnlessPublishing` neles, porque 5xx na revalidação mantém o
  documento anterior e 200 vazio o substitui. Guarda nova
  (`isr-determinism.test.ts`) e a `api-failure` varrendo toda a superfície
  com `revalidate`. **866 → 881 no web.** O que o PR **não** resolve: as
  horas do Render (fixar `now` não muda quantas vezes a API acorda — o
  `revalidate = 3600` das listagens e o `news-sitemap` a 900 s são os
  despertadores, §16 do plano), a partilha com o NetsheetEngine e a cota de
  imagem. **A promoção não deve acontecer com a API suspensa**: o build da
  Vercel a chama e falha de propósito. **Só o painel diz:** Render → Billing
  → horas por serviço; Vercel → Usage → ISR Writes *by project* (o time tem
  **cinco** projetos) e o gráfico diário de imagem (o Hobby não tem ciclo —
  "30 dias", sem a doc dizer se janela móvel ou a partir do estouro).

- 🔴 **A API do Render está suspensa (2026-09-19, medido às 17:23 UTC):
  `503` com `x-render-routing: suspend` em `/api/health`.** O briefing de
  19/09 existe na home, então o cron das 11:00 UTC rodou — e a Home ainda
  regenerou às 13:00:06 com a API respondendo, então a suspensão é de **entre
  13:00 e 17:23 UTC** (item 82). **O que o leitor vê:** as páginas já geradas continuam
  no ar pela ISR (`/pt-BR`, `/news` em 200), mas **toda página ainda não
  gerada responde a 500 estática do Next** — inclusive
  `/pt-BR/article/2026-09-19`, o briefing do dia, que a home linka
  (armadilha 41, ao vivo). Filtro do acervo, conta, favoritos e admin não
  respondem; **o cron de amanhã vai falhar** (`warmApi` recebe 503 e devolve
  "não acordou"), como em 01/09. **A conta que não batia com o §9.0 do
  `docs/setup.md` fechou pelo e-mail do Render (item 82):** as 750 h são do
  workspace, e ele tem **dois** serviços free — a API e o `NetsheetEngine`.
  Quanto é de cada um só Billing → free instance hours diz; é a **segunda
  vez** (29/08), e a `DailyUptime` da Fase 5 começou a contar às 01:08 de
  19/09 — cedo demais para ter ajudado. ~~A primeira leitura das três abas de
  admin e o ensaio da Fase 9 contra os briefings retidos ficam bloqueados
  até ela voltar.~~ **Revisto em 24/09: não ficam.** Os dois leem o banco, não
  a API — um branch do Neon filho de `production`, com a API e o web locais,
  os alcança agora sem tocar produção (M7a da Fase 12). O que espera o Render
  é só o que mede o site publicado: a promoção, o ritual e o primeiro run
  real. As horas zeram no dia 1º (documentação do Render), e **a decisão de
  24/09 é esperar** — sem instância paga.

- **Onde estamos no plano de observabilidade (2026-09-20): as onze fases
  estão na `dev`** — e, desde 24/09, a **Fase 12 (o ensaio de aceitação)**
  está aberta (topo deste bloco). A Fase 9 fechou em 20/09 (acima; item 83). O que a
  `dev` carrega desde a promoção #215: os pós-merges (#221, #227, #230), os
  bumps do Dependabot, o #231 (ISR determinística) e a 9. **O que falta é
  seu:** a promoção `dev → main` — a política de 07/09 mandava a 9 subir
  sozinha, e hoje ela sobe junto com o #231, que também é correção que
  produção precisa —, e depois o ritual dos três; o **`gates:rehearse`
  contra os briefings retidos** (se algum reprovar, o errado é o portão); e
  a primeira leitura das três abas com dado de produção. **A promoção e o
  ritual esperam a API; os outros dois, não** — desde a revisão da Fase 12
  (24/09) eles rodam sobre um branch do Neon (M7a), e só exigem você
  reautenticar o `neonctl`.

- **Promoção `dev → main` (2026-09-19, #215, `4efbacd`): as sete fases do
  plano de observabilidade estão no ar, e cada rodada do CI foi lida.**
  Item **81**. 68 commits / 29 PRs, três migrations aplicadas em 01:07:02
  (30 s depois do merge, 0,2 s), API nova de pé ~1 min depois — **a janela
  do `DROP COLUMN` durou um minuto**, e as rotas públicas responderam 200
  em toda sonda. **Smoke: 31 passed, 6 skipped** (conta e admin sem os
  segredos), com as seis rotas de admin novas em 401 e o gêmeo anônimo do
  `/api/errors/client`. **Lighthouse (medianas):** 94 · 91 · 94 · 96 · 95 ·
  96 · 95, a11y e SEO 100 nas sete, gate verde — e **best practices em 96
  nas quatro rotas com foto por `errors-in-console: 402`: a cota de imagem
  NÃO virou** (12/12 imagens em `MISS` → 402; o 200 que eu tinha visto era
  `HIT` da borda, e o corpo do #215 disse o contrário — corrigido no item
  81). Gitleaks `0 commits scanned` sobre 68 — a décima segunda medição, a
  maior. Matriz de autorização conferida no ar (13 rotas em 401, 404 no
  contrato da Fase 3, `x-request-id` ecoado). **A `dev` está realinhada.**
  **O que falta é seu: a primeira leitura das três abas de admin com a
  credencial de produção** (o `AUTH_TOKEN_INVALID` das minhas sondas deve
  ser a primeira linha da `/admin/security`; `SourceHealth` e as
  invariantes só ganham dado no run das 11:00 UTC). **Depois: a Fase 9,
  sozinha.**

- **Verificação pós-merge da 7b (2026-09-19): a Fase 7 não deve nada, e o
  lote da promoção foi medido.** Item **80**. Sobre `79655d1` (#213):
  nenhuma prosa envelhecida sobre os boundaries fora do registro histórico,
  suíte verde, Gitleaks `0 commits`, décima. **Achados:** o §18 não tinha
  linha para "error boundary novo" (entrou, com o que nenhuma guarda cobre
  — armadilha 41, que também entrou na lista da raiz abaixo); **três frases
  do plano diziam que o lote "começa na Fase 3"** — a 3 está no ar desde o
  #168 de 09/09, o lote começa no #175. **O lote, medido:** `dev..main` = 0,
  **66 commits / 30 PRs** (Fases 4, 5, 8, 11, 6, 7c, 7b + pós-merges +
  `fastify-plugin` 5 → 6), **três migrations juntas** (4, 5a, 11a — uma com
  `DROP COLUMN`), **nenhuma env nova**, os 13 PNGs saindo da `main`, e sete
  `ignore` do Dependabot que só passam a valer quando chegarem à `main`.
  **Nada da Fase 7 a fazer antes de promover** — o que sobra (o erro de
  servidor nas páginas ISR) é decisão, com gatilho no §16. Depois do
  deploy: o ritual dos três, mais a primeira leitura das três abas contra
  produção.

- **Fora da linha das fases (2026-09-17): a Fase 7b fechou na `dev` — o
  `digest` chega a um humano, e com ela a Fase 7 inteira.** §11.2, item
  **79**. Os quatro `error.tsx` declaravam `error` e nunca o liam; hoje os
  **cinco** boundaries (os quatro mais o `app/global-error.tsx`, que não
  existia) passam pela casca única `components/errors/error-state` —
  tudo por prop e sem next-intl, porque o raiz renderiza fora do provider
  —, que desenha o `digest` em texto pequeno selecionável e chama
  `useReportClientError` **uma vez por montagem** (`lib/report-client-error.ts`:
  `keepalive`, nunca lança, segunda exceção do `bff-seam`). O
  `global-error.tsx` tem o `not-found.tsx` de modelo **menos o
  `<ThemeInit />`** — `<script>` inline não executa quando é o React quem o
  insere (armadilha 40); o tema é `applyStoredTheme()` num efeito, e as
  strings saem dos JSONs lidos direto, no idioma do pathname (cópia fixa
  derivaria em silêncio). O `admin:capture` fotografa o boundary
  como rota permanente (`admin-metrics-error`, `breakBff`). **Ensaio em
  build de produção, os três saltos**: quatro capturas → quatro `202` →
  a linha `WEB · CLIENT_ERROR · /[locale]/admin/metrics` com `count: 4` na
  `/admin/security`; e o erro de servidor com "Referência do erro:
  1475300246" na tela e o mesmo digest no `context` da linha. **O ensaio
  corrigiu o inventário (armadilha 41): erro de servidor nas duas páginas
  ISR de detalhe é a 500 estática do Next em qualquer navegação** — o
  boundary de segmento só entra no erro de render do cliente; o digest
  chega a um humano nas páginas `force-dynamic`. Dívida com gatilho no
  §16. **840 → 866 no web; 1.295 na API.** **Próximo passo: a promoção
  `dev → main`** e o ritual; depois, a 9.

- **Verificação pós-merge da 7c (2026-09-17): o fluxo anônimo que nenhum
  diagrama desenhava, e o `<script>` que não executa.** Item **78**. Quatro
  enumerações sobre a árvore mergeada (`d38fb5e`, #211): quem lê `origin` e
  `route` do `ErrorEvent` (crus, sem mapa), a prosa do "única" (nenhuma
  sobrou), contagens de rota (nenhuma), e os diagramas — **os dois com o BFF
  diziam "assina um JWT por requisição" e o fluxo anônimo (analytics e
  relato de erro) nunca foi desenhado**; rótulos e aresta corrigidos, os
  seis parseiam pelo parser do Mermaid em Node. Gitleaks `0 commits`, nona.
  **O terreno da 7b está no fim da §11 ("Inventário da 7b, reconferido
  depois da 7c"), e corrige o inventário de 16/09 num ponto:** o
  `<ThemeInit />` copiado para o `global-error.tsx` **não executa** — o
  React DOM cria `<script>` de client component via `innerHTML` de
  propósito (armadilha 40); tema em boundary raiz é `useEffect` +
  `applyStoredTheme()`. Mais: o `<main>` do layout de idioma não dá
  contêiner (só o `error.tsx` de admin duplica a casca), os quatro
  `error.tsx` são o mesmo componente, o `message` de erro de servidor é a
  frase genérica do Next (261 chars — o `digest` é a identidade), o idioma
  da string fixa sai do pathname, e o ensaio real vai por `page.route`
  devolvendo `routes: null` na aba de métricas. Branch
  `observability/fase-7b-error-boundaries`, cortada de `d38fb5e`.

- **Fora da linha das fases (2026-09-16): a Fase 7c fechou na `dev` — o
  caminho de ingestão do erro do cliente, a segunda porta anônima.** §11.3,
  item **77**. `origin: WEB` estava no enum do `ErrorEvent` desde a Fase 4
  sem produtor; hoje `POST /api/errors/client` (**pública e anônima** como o
  `/api/events`, balde próprio de **10/min — um só para o site, decidido**)
  recebe `{ message ≤ 300, digest? ≤ 64, path }` e vira uma linha com
  `CLIENT_ERROR`, `severity: ERROR`, e **o `route` como padrão da página**
  (`/[locale]/news/[id]`) — a API normaliza (`utils/web-route.ts`) contra um
  conjunto com guarda derivada de toda `page.tsx` do web; o que não casa vai
  para `unmatched`. `202 { accepted: true }` porque o relato entra no
  buffer, não no banco. O BFF `app/api/errors/client/route.ts` repassa só
  corpo e content type, e o 429 atravessa. **Dois achados fora do
  inventário:** o `shared-type-contract` varria só `200|201|204` e o `202`
  passou verde (armadilha 38 — hoje `2\d\d`); e o gatilho "429 dentro de
  `/api/metrics/http`", escrito desde a Fase 9 para o `/api/events`, **não
  era observável por rota** — o 4xx por rota era contado e nunca servido
  (armadilha 39 — entrou `clientErrorRate` por rota, com a coluna "4xx" na
  `/admin/metrics`, desenhando "—" até a promoção). O `bff-route-seam` lê o
  `fetch` cru e nomeia as duas portas anônimas. Ensaio local de ponta a
  ponta (BFF → API → flush → `/admin/security` com três linhas de `WEB`) e
  captura das duas abas sem defeito visual. **1.252 → 1.295 na API, 829 →
  840 no web.** Fica a **7b** (os boundaries e o reporter, usando esta
  porta), depois a promoção, e a **9** por último.

- **Verificação pós-merge da Fase 6 (2026-09-16): três frases que sobraram,
  a guarda de compilação vista reprovando, e o terreno da 7.** Item **76**.
  Quatro enumerações sobre a árvore mergeada (`1152ca0`, #209): quem lê etapa
  por número, quem lê o `route` do `ErrorEvent`, quem lê o resumo da 9 por
  nome (ninguém no web — o campo novo não tem leitor a quebrar), e o que a
  costura tipo ↔ schema garante. **"Stage 1–9" sobrevivia em três lugares**
  (as duas portas de detalhe do run na `docs/api.md` e o JSDoc de
  `logPipelineEvent`) — velho desde a 7.5, sem guarda que alcance; e a
  `docs/api.md` não dizia que o `route` de um `ErrorEvent` tem **três
  formas** desde a Fase 6. Tirar um id do `z.enum` de propósito fez o `tsc`
  acusar em dois lugares — a fiação e a peça estão guardadas. Gitleaks em
  `0 commits scanned` no push do merge, oitava medição. **O terreno da Fase
  7 está no fim da §11**, e a ordem é **7c antes de 7b**: o "10/min" seria
  um balde único para o site (o BFF não repassa o IP do leitor), nada no web
  sabe o padrão da rota atual (a API normaliza, com conjunto derivado do
  `app/`), o BFF anônimo nasce fora do `bff-route-seam`, e o `digest` só
  existe em erro de servidor. Branch
  `observability/fase-7c-client-error-ingest`.

- **Fora da linha das fases (2026-09-16): a Fase 6 fechou na `dev` — as
  invariantes, "o que deveria ter acontecido aconteceu?", perguntado uma vez
  por run.** §10, item **75**. As etapas 7.5, 8, 8.5 e 9 engolem a própria
  falha para o run terminar, e nada perguntava depois: a retenção podia parar
  por um mês e o primeiro sintoma seria a conta do Neon. Entrou a **etapa
  9.5** com **doze** consultas agregadas cedendo o event loop antes de cada
  uma — a retenção das **sete** tabelas que a 8 expurga (a lista da §10
  tinha seis: faltava `retention.article`, e a guarda deriva a contagem do
  `Promise.all` do cleanup), um briefing por dia, todo briefing com fontes,
  nenhum run morto, todo dia com run com métrica, a newsletter chegando a
  alguém. **Violação não degrada o run**: o relatório é o `context` de um
  `INFO` e cada violação é um `ErrorEvent` com `origin: INVARIANT` e o id no
  fingerprint (uma linha por invariante por run); o que degrada é a consulta
  que **lança** (`status: ERROR`, `WARN` da 9.5). `GET /api/admin/invariants`
  lê o último evento e nunca roda a suíte; o painel na `/admin/security`
  desenha três estados por linha com a forma carregando o estado. **Ensaio
  contra o banco local antes de ligar: quatro reprovaram, nenhuma pela
  invariante** — duas pelo acervo local nunca expurgado (como a §10 previu),
  duas pelo seed, que se ajustou (sete briefings com fontes, 9.5 em todo run
  semeado); segunda passada em **65 ms**. Os três exports que a §10 pedia
  vieram por **mudança de módulo** (`services/retention.ts`,
  `run-outcome.ts`, `utils/event-loop.ts`) — exportar do lugar antigo
  fecharia um ciclo. **1.197 → 1.252 na API, 822 → 829 no web.** Fica a
  **9**, por último e por decisão; 7b e 7c abertas.

- **Verificação pós-merge da Fase 11 (2026-09-16): a coleta real, o nome
  que sobrou, e o terreno da 6.** Item **74**. Três enumerações e um ensaio
  sobre a árvore mergeada (`4fb0127`, #205–#207). **A coleta de verdade**
  contra os 12 feeds e a NewsData: 609 itens de 13 fontes em 2,3 s, todas
  `OK`, latências de 1,2 a 2,0 s, `kept ≤ fetched` nas 13 e Σ`kept` =
  deduplicados — e a **BBC traz 41 itens com 10 URLs repetidas no próprio
  feed**, a primeira divergência entre `fetched` e `kept` por motivo interno
  ao feed. **Dois achados de prosa:** `fetchFromRssWithFailures` mentia desde
  o 11b (devolve `outcomes`) — hoje `fetchFromRssWithOutcomes`; e o
  `apps/api/CLAUDE.md` dizia "10 etapas" listando 11 e "três subgrupos" com
  quatro. Gitleaks em `0 commits scanned` no push do merge, sétima medição.
  **O terreno da Fase 6 está no fim da §10**: as nove invariantes viraram
  onze (o `AuditEvent` e a `SourceHealth` entraram no expurgo depois da
  lista), `STALE_RUN_MS` e `yieldToEventLoop` não são exportados,
  `metrics.day_recorded` não é agregado em Prisma, e "violação degrada o
  run?" se decide antes do `WARN`. Branch `observability/fase-6-invariants`.

- **Fora da linha das fases (2026-09-15): a Fase 11 fechou na `dev` — PR
  11c, o web.** §15, item **73**. O painel "Fontes" na `/admin/metrics`:
  a tabela por fonte (estado de hoje, novas/coletadas, médias de 7 e 30 dias,
  variação, dias em falha, latência e a faixa de 30 dias por linha),
  ordenável, os **dois gatilhos da §15 como alerta** ("Superinteressante está
  em falha há 3 dias seguidos"; "Trivela está definhando: as novas por dia
  dos últimos 7 dias são 25 % da média de 30") e a rosquinha de contribuição
  por `kept`. **Tudo o que não é linha é derivado no web**
  (`lib/source-days.ts`): o dia "não tentada" pela ausência, as médias
  **sobre os dias tentados** (o dia sem run não penaliza a fonte), a
  sequência de falhas que um dia sem linha não quebra. Duas peças extraídas
  antes de copiar — `admin/day-strip` (a casca da faixa da Fase 8) e
  `admin/sortable-header` (o cabeçalho da tabela do 5c). **A captura pagou
  pela quarta fase seguida:** "Outras" saía em primeiro na rosquinha, e a
  legenda do centro cortava no anel. "Indisponível" sobre 404 até a
  promoção. **792 → 822 no web** (78 → 80 suítes), 1.197 na API. Continuam abertas **duas
  fases inteiras** (6 e 9) e as subfases 7b e 7c.

- **Fora da linha das fases (2026-09-15): a Fase 11 ganhou a API — PR 11b.**
  §15, item **72**. Os quatro números que o inventário tinha medido como
  inexistentes, cada um de um lugar decidido: **`latencyMs`** por feed e por
  provider, medido também na rejeição (um timeout sai com 30 s — "demora
  28 s" é o dia anterior ao `ETIMEDOUT`); **`fetched` por feed** porque o
  provider de RSS passou a devolver `outcomes`, um por fonte configurada, e
  `failures` deixou de existir — `fetchAll` devolve `sources` e **deriva os
  `warnings` daí**; **`kept`** por um `findMany` do `createdAt` **depois** do
  `createMany`, com atribuição **por identidade do objeto** (o `source` de um
  item da NewsData é o nome do veículo, que pode ser "G1"); e **a escrita
  depois da etapa 4**, uma transação de duas instruções num `try` cujo
  `catch` é `WARN` da 4. Retenção de 90 d na etapa 8 e `GET
  /api/admin/sources` devolvendo a série crua — médias, variação e o dia
  "não tentado" são do web (11c). **Dois achados:** a fixture do
  `pipeline.test.ts` duplicava os literais em vez de reusar os objetos, e a
  atribuição por identidade a expôs; e o `Math.min(fetched, kept)` saiu,
  porque um clamp esconderia o erro que a guarda `kept ≤ fetched` existe
  para achar. **1.141 → 1.196 na API** (80 → 82 suítes).

- **Fora da linha das fases (2026-09-15): a Fase 11 abriu pelo schema — PR
  11a.** §15, item **71**. `SourceHealth`: uma linha por `(source, dia)` com
  `fetched`, `kept`, `outcome`, `failureReason`, `latencyMs` e o
  `pipelineLogId` sem FK — a memória que a etapa 1 não tinha ("há quantos
  dias a Superinteressante está fora?" exigia cruzar eventos à mão). **Três
  decisões mudaram o desenho da §15:** `SourceOutcome` tem **três** valores
  (`NOT_ATTEMPTED` é ausência de linha, derivada no web como o `NEVER_RAN` —
  a escrita é depois da etapa 4, e o pipeline nunca o emitiria); `kept` é "a
  URL entrou em `News` **naquele dia**", e não "antes deste run", para o
  re-disparo depois de um `FAILED` na 6 não sobrescrever números honestos com
  zeros; e o `@@index([source, day])` saiu pela armadilha 12. SQL por
  `migrate diff` entre os dois schemas, sem banco; replay no Postgres local.
  O seed semeia 27 dias × 13 fontes com as duas histórias dos gatilhos (a
  Superinteressante em `FAILED` há 3 dias; a Trivela com `kept` de 7 dias em
  25 % do de 30). **Nenhum teste novo, nenhuma mudança em `src/`** — as
  guardas derivadas do schema fizeram o trabalho, vistas reprovando nove
  vezes. **São três PRs** (11a migration · 11b API · 11c web), como na Fase 5.

- **Verificação pós-merge da Fase 8 (2026-09-15): a linha `feed-empty` tinha
  um terceiro consumidor, e o preview lia uma API que não sabe o desfecho.**
  Item **70**. Três enumerações sobre a árvore mergeada. **O `ErrorEvent`
  gravava todo `WARN` como `PIPELINE_STAGE_DEGRADED`**, inclusive o da etapa
  1 só com feeds vazios — a tabela de falhas dizia "degradado" no domingo de
  um feed de saúde enquanto o desfecho do mesmo run dizia `SUCCESS`; hoje os
  três consumidores chamam `isDegradingWarn`. **O `/dev/dashboard` ainda
  imprimia `SUCCESS`** (segunda porta, mesmo contrato). **O preview da `dev`
  quebrava a `/admin`**: o web da `dev` lê a API de **produção**, que não tem
  `outcome`/`degradedBy`, e `run.degradedBy.length` morria — `withOutcome`
  em `lib/api.ts` preenche na fronteira, e a lição virou a armadilha 37 do
  plano (vale para toda fase que acrescentar campo que o web lê). Duas
  guardas novas — `janela ≤ retenção` no `retention-drift`, e a fiação do
  `degradedBy` pelo parser — e o **gatilho da fase medido**: "Degradado pela
  etapa 6 há 3 execuções seguidas" (`degradedStreak`). **1.129 → 1.141 na
  API, 781 → 792 no web.** O terreno da **Fase 11** está no fim da §15 — a
  fase com mais desvio do inventário até aqui.

- **Fora da linha das fases (2026-09-15): a Fase 8 fechou — `SUCCESS` deixou
  de mentir, e o dia que não rodou virou estado.** §12, item **69**. O
  `PipelineLog.status` é binário e o pipeline não é: quatro etapas engolem a
  própria falha com `WARN` e o run segue `SUCCESS`, o fallback para o Groq é
  `WARN` da etapa 6, a colheita degradada é `WARN` da etapa 1 — seis coisas
  erradas cabiam num "Sucesso". Entrou o **`outcome` derivado** (`SUCCESS` ·
  `SUCCESS_DEGRADED` · `FAILED`, `null` em `RUNNING`) com **`degradedBy`** (as
  etapas), função pura em `services/run-outcome.ts` sobre o run e seus `WARN`
  — **sem coluna, sem migration, sem rota nova** —, nas duas portas da
  listagem; o **resumo no evento final da etapa 9** (colheita, modelo,
  briefing, newsletter, `degradedBy`, duração); a **faixa de 30 dias** na
  `/admin`, com o **`NEVER_RAN` vazado** derivado no web pela ausência de run
  num dia UTC; e o **batimento** "Último briefing há 3 h 12 min", medido do
  último run que produziu briefing, "atrasado" acima de 24 h. O seed semeia
  27 runs em 30 dias, com o buraco de 29–31/08. **1.103 → 1.129 na API, 762 →
  781 no web.**

  > **A linha `feed-empty` mora num lugar só** (`isDegradingFetchWarning`):
  > o `pipelineErrors` da etapa 1 e o desfecho a chamam. Com "zero `WARN`",
  > como a §12 escrevia em 23/08, o fim de semana de um feed de saúde seria
  > dia degradado e o estado deixaria de informar. E o `degradedBy` tem
  > **duas contas que têm de bater** — o pipeline o monta enquanto corre, a
  > API o deriva dos eventos gravados —, com teste cobrando a concordância.
  >
  > **A captura pagou na estreia, pela segunda fase seguida:** no tema
  > escuro o laranja do degradado e o vermelho do falhou eram a mesma cor a
  > olho num quadrado de 20 px. O degradado é contorno com miolo fraco — a
  > forma carrega o estado (armadilha 35). **`pii-in-logs` reprovou uma
  > renomeação inocente**, e está certo em fixar a forma literal do contexto
  > da 7.5. **Gatilho que nasce, agora medível:** três dias seguidos de
  > `SUCCESS_DEGRADED` pelo mesmo `degradedBy`.

- **Verificação pós-merge do 5c (2026-09-15): nada ligava o caminho que o
  BFF repassa à rota que a API registra.** Item **68**. Web e API eram
  autoconsistentes e nenhum lia o outro — um `'/admin/error'` passaria nos
  dois CIs e falharia só em produção, com 404, na classe de defeito que só o
  smoke da `main` mede. Entrou `bff-route-seam.test.ts` na API (lê os
  `route.ts` do web pelo parser e cobra uma linha do roteador para cada
  `proxyToApi`, caminho como padrão e método), vista reprovando com um
  caractere trocado. Junto: as **duas listas escritas à mão** que o 5c
  alimentou — a de 401 do smoke e o `ALL_ROUTES` do `admin:capture` —
  ganharam guarda derivada do `app/` (`hand-written-lists.test.ts`); e
  **quatro campos que a API mandava e a tela descartava** (`firstSeenAt`,
  `pipelineLogId`, `requestId`, o run do `context`) passaram a aparecer.
  Gitleaks em `0 commits scanned` no push do merge, sexta medição. **1.099 →
  1.103 na API, 754 → 762 no web.**

- **Fora da linha das fases (2026-09-14): a Fase 5 fechou — PR 5c, o web.**
  §9, item **67**. A `/admin/security` nasceu (a décima sexta página, e a única
  que o plano inteiro abre) e a faixa passou a ter as **três abas do §4.1**.
  Entraram: o **arco das horas do plano** na `/admin` — o medidor que faltava
  em 29/08 —, com o **ritmo do mês** projetado (`hoursUsed / horas decorridas ×
  horas do mês`, calado antes de 24 h de amostra) e `plan: null` desenhando
  "Indisponível", nunca zero; **os quatro sinais** na `/admin/metrics`, com
  latência por rota em tabela; a **linha de KPI com variação** (três chips de
  quatro — a taxa de sucesso não tem par honesto no contrato de 30 dias, e um
  cartão sem chip é melhor que um chip inventado); **rosquinhas** em SVG para
  categoria, provider, ingestão por fonte (as duas colunas gravadas desde a V1
  e nunca desenhadas) e erro por categoria com seis fatias fixas; o
  `series-bars` para o `byDay` que voltava desde a Fase 8 sem leitor; a
  **tabela de falhas** com busca, filtros, colunas ordenáveis e o
  `lastRequestId` selecionável; a **trilha de auditoria**; e o lugar das
  invariantes, vazio até a Fase 6. Três rotas novas no BFF, todas por
  `proxyToApi` com `requireRole: 'ADMIN'` — cobrado pelo parser em
  `admin-surface.test.ts`, visto reprovando sobre as três antes de ganharem o
  papel. O `admin:capture` fotografa as três abas e o **seed passou a popular
  `ErrorEvent`, `AuditEvent` e `DailyUptime`**. **685 → 754 testes no web.**

  > **A captura achou três defeitos sem sintoma de código, na estreia da aba**
  > — o padrão do item 50: legenda da rosquinha atravessando a página, oito
  > categorias sobre cinco cores com Mundo e Saúde no mesmo vermelho (a
  > repetição agora sai esmaecida), e a série por dia como um retângulo de
  > largura inteira porque a API só devolve os dias com evento
  > (`fillCalendarDays` preenche a janela). E os **13 PNGs do item 55 tinham
  > chegado à `dev` pelo #200**, rastreados — desrastreados aqui.

  > **Duas coisas que a §9 pedia e o 5c decidiu diferente, com o motivo no
  > plano:** os "quatro cartões com variação" são três, porque `lastMonth` não
  > diz quantos dias têm linha e `failureDays / 30` mentiria para o otimista
  > nos meses com dia sem `DailyMetric`; e a "tabela de eventos de segurança"
  > e a "lista de erros por fingerprint" são **uma** tabela, porque os eventos
  > da §3.2 vivem no `ErrorEvent` e não há segunda tabela de onde ler.
  >
  > **O `byDay` é dia UTC, e a série teria lido no fuso local** —
  > `2026-09-01` viraria 31/08 no Brasil, a série inteira um dia para trás. É
  > a armadilha do `Article.date` em outro campo; `formatCalendarDay` lê em
  > UTC, com teste.

- 🟡 **A cota de otimização de imagem da Vercel estourou em 09/09/2026, e o
  corte que a faz caber já entrou — falta o mês virar.** Confirmado no painel:
  **5.119 transformações** contra as **5.000/mês** do plano Hobby, e todo
  `/_next/image` respondendo **402**, com o site no ar exibindo o placeholder de
  marca no lugar das fotos. Como o `SafeImage` **degrada sem gritar**, não houve
  erro em lugar nenhum — foi achado de raspão, medindo uma advisory (item
  **53**).

  **O multiplicador não era tráfego, era a escada de larguras:** 29 imagens de
  origem na home gerando **279 alvos distintos** (~9,6 larguras cada). O item
  **54** cortou `deviceSizes` de 6 para 4 e `imageSizes` de 6 para 5, conferindo
  degrau a degrau contra os `sizes` que existem — só o mobile 2x mudou, e em 10%
  de bytes. **Decisão: continuar no Hobby**, que é legítimo (o plano só proíbe
  uso comercial, e isto é portfólio).

  > **O que ainda depende de você:** a cota só zera na virada do período de
  > faturamento — até lá o site segue sem foto, e não há o que mergear que mude
  > isso. E vale conferir em **Settings → Notifications** que o aviso de cota vai
  > para um endereço que você lê: **é a terceira vez** que este projeto descobre
  > um teto de plano gratuito pelo produto quebrado (keep-alive, suspensão de
  > 29/08, agora a imagem).
  >
  > **Remedido em 19/09/2026, na promoção: ainda estourada.** O Lighthouse
  > acusou `errors-in-console: 402` nas quatro rotas com foto (best
  > practices em 96), e 12 de 12 imagens da home em `MISS` respondem 402.
  > **Uma imagem em `HIT` da borda responde 200 e engana** — foi assim que o
  > corpo do #215 disse "a cota virou". Sonda de cota é numa imagem em
  > `MISS`. Item 81.
  >
  > **Se estourar de novo depois do corte, a resposta honesta é o Pro** — espremer
  > mais começa a estragar a imagem. A outra saída, o proxy próprio, ficou mais
  > cara desde 09/09: traz `sharp`/`libheif` para a árvore e **reabre a
  > GHSA-2xp9-vwfh-vxw4**.

- **Onde estamos:** V2.0 com as **Fases 0 a 12 concluídas**. A **Fase 13
  (ajustes finos e release final)** é a próxima e pode abrir — ela dependia da
  12, que fechou. §28 do plano.

  > **A numeração mudou em 25/08.** A antiga Fase 12 (release) virou a **13**, e
  > a **12** passou a ser o *refinamento visual e de leitura*. Ela entrou porque
  > as três revisões olharam **camadas** — servidor, navegador, costura — e
  > nenhuma olhou uma tela com dado de produção dentro. §28, "As cinco fases
  > finais".
- **Fora da linha das fases (2026-09-12): a Fase 5 ganhou a API — PR 5b.**
  §9, item **64**. Quem escreve as duas tabelas do 5a, quem lê o `ErrorEvent`
  que a Fase 4 gravava e ninguém lia, e o **quarto sinal de ouro**. Entraram
  `GET /api/admin/errors` (agrupado por fingerprint, seis fatias fixas por
  categoria) e `GET /api/admin/audit` — **este não estava no plano**, e sem ele
  a tabela nasceria sem leitor —, a saturação no `/api/metrics/http` (memória
  / 512 MB, atraso do event loop já sem a resolução do timer, horas do mês /
  750), o heartbeat do `DailyUptime` **registrado no `server.ts`** (no
  `buildApp` custaria uma ida ao banco por suíte), as três colunas no
  dashboard com o `response-schema-contract` no `DailyMetric`, e os 365 dias
  do `AuditEvent` na etapa 8. **1.018 → 1.098 na API, 683 → 685 no web.**

  > **O ator atravessa por cabeçalho (`x-actor-id`), e o motivo é medido.** O
  > BFF é o único ponto da cadeia que sabe quem clicou; o primeiro salto é
  > `GET`, um `body` no `POST` quebraria todo chamador sem corpo (o Fastify
  > entrega `null`, e `.default({})` só cobre `undefined`), e schema de
  > `headers` do type provider **substitui `request.headers`** — apagaria o
  > `authorization`. Lido à mão, depois do `assertJobSecret`; malformado é 400.
  >
  > **A retenção em prosa ganhou guarda** (`retention-drift.test.ts`, sobre os
  > dois diagramas, os dois `CLAUDE.md` e os dois READMEs) e as retenções de
  > notícia, log e artigo viraram constantes — eram literais na etapa 8.
  >
  > **O script que verificava as guardas reprovando disse "verde" para quatro
  > que estavam vermelhas.** ANSI do vitest no regex de `failed`, e CRLF no
  > `server.ts`. Guarda que mede guarda também se vê falhando.
  >
  > **A verificação pós-merge (item 65, 13/09) achou dois defeitos na leitura
  > nova:** a saturação tinha posto o banco no caminho do `/api/metrics/http`
  > — a rota que é em memória justamente para responder quando o banco é o
  > suspeito — e banco fora derrubava os quatro sinais de uma vez (hoje
  > `saturation.plan` é `null` com `warn`); e a janela do
  > `/api/admin/errors` cortava o balde da hora parcial, até 59 min de "24h"
  > (piso na hora cheia). **1.099 na API.**

- **Fora da linha das fases (2026-09-12): a Fase 5 abriu pelo schema — PR 5a.**
  §9, item **62**. As duas decisões que o inventário deixava *"antes de
  desenhar"* eram schema, e foram tomadas: a auditoria de admin é tabela
  (`AuditEvent`, uma linha por ocorrência, `actorId` sem FK e sem e-mail,
  `action` texto com conjunto no código, 365 dias) e as horas do plano do
  Render são acumulador (`DailyUptime`, uma linha por dia UTC incrementada por
  heartbeat — `process.uptime()` zera a cada acordada desde 01/09, e o arco de
  saturação que faltava em 29/08 não tinha de onde sair). O `aiTokensUsed` saiu
  dos três lugares. **1.015 → 1.018 na API**, nenhuma mudança em `src/`.

  > **Nenhuma guarda alcançava coluna, e agora duas alcançam.** Tirar uma
  > coluna do schema e esquecer o `DROP COLUMN` deixava a suíte inteira verde e
  > produção com coluna morta para sempre. `migrations.test.ts` ganhou um
  > **replay estático** (`CREATE`/`ADD`/`DROP`/`RENAME COLUMN` na ordem do
  > deploy, contra o schema, nas duas direções) e o `diagram-drift` compara o ER
  > **coluna a coluna** — as 13 entidades de 01/09 bateram até no atributo.
  >
  > **O inventário errava um fato que muda o 5b:** a API **não** vê quem
  > disparou o pipeline — a cadeia BFF → cron → API chega com `JOB_SECRET` e
  > usuário nenhum. O ator tem de ser encaminhado; a tabela nasceu com
  > `actorId` obrigatório de propósito.
  >
  > **O SQL saiu de replay real** (`migrate diff --from-migrations` num shadow
  > DB — o único caminho que produz `DROP COLUMN`), aplicou sobre as 30 linhas
  > seedadas do banco local, e as seis migrations do zero dão *"No difference
  > detected"*.
  >
  > **O pós-merge (item 63) achou que o seed não era tipado por ninguém:** o
  > `packages/database` não tinha `typecheck`, o `build` tipa só `src/`, e o
  > `tsx` não tipa — coluna removida do schema e esquecida no seed passava por
  > lint, typecheck e suíte, e morria em runtime no `dev-bootstrap.sh`. Hoje há
  > `tsconfig.typecheck.json` cobrindo `prisma/*.ts`, e o `turbo typecheck` tem
  > 6 tarefas em vez de 5.
- **Verificação pós-merge da Fase 4 (2026-09-12): quatro falhas ainda morriam
  com a linha de log.** Item **61**. A pergunta dos itens 39, 52 e 57 — *o que
  ficou de fora?* — respondida enumerando todo `warn`/`error` escrito fora dos
  dois pontos únicos: 22 linhas, **quatro lacunas**. A maior é a degradação mais
  frequente medida neste projeto — **o Gemini falhando com o Groq entregando**,
  que deixava só uma linha de stdout — e hoje é `WARN` da etapa 6, sem tocar em
  `pipelineErrors`. Junto: o `catch` final do pipeline gravava o `ERROR`
  **depois** do `update` que falha quando o banco é o problema; o disparo
  interno do cron não tinha registro; e a coleta degradada saía como `internal`
  quando é `upstream`. **1.003 → 1.015 testes na API.**

  > **Três inconsistências eram minhas, e nenhuma tinha sintoma.** O
  > `authPlugin` — a porta de maior volume — era a única sem `requestId`; o
  > enterro do run morto gravava `pipelineLogId: null` sobre um id que estava na
  > mão (`recordError` lia só o `AsyncLocalStorage`, e o enterro roda fora do
  > contexto); e a contagem "três portas", corrigida no código, ficou errada em
  > **quatro documentos**. O `'unmatched'` estava escrito seis vezes; hoje mora
  > em `routePatternOf`, com guarda. E o teto do `code` virou **tipo**
  > (`RecordedErrorCode`): interpolar deixa de compilar.

- **Fora da linha das fases (2026-09-10): a falha parou de morrer junto com a
  linha de log.** A **Fase 4** (§8), nos dois PRs da ordem do §19 — **6a** só o
  schema, **6b** o código. `ErrorEvent` grava **uma linha por
  `(fingerprint, hora)`**, e não por ocorrência: um 500 que dispara 10.000 vezes
  numa hora é uma linha com `count: 10000`, o que dá à tabela um teto de *falhas
  distintas × 24* qualquer que seja o tráfego. `recordError` é **síncrona,
  coalescente e nunca lança**; quem persiste é um intervalo de 30 s mais o
  `onClose`, e a etapa 8 apaga aos 14 dias. Junto vieram os **dois índices que o
  `PipelineLog` nunca teve** — zero `@@index` em nove fases, com `getDevLogs`
  ordenando por `startedAt desc`. **967 → 1.003 testes na API.** Itens **59** e
  **60** do `docs/progress.md`.

  > **Quem escreve são dois pontos únicos, e uma exceção declarada.**
  > `logAppError` (toda porta da API que responde erro) e `logPipelineEvent` (toda etapa) — e
  > **não** os `catch`, porque enumerar `catch` à mão é a forma de guarda que a
  > Fase 7a viu falhar por omissão. A exceção é o ramo do **500 cru**, que não é
  > `AppError` e é justamente a falha que menos se sabe explicar depois.
  >
  > **O flush do desligamento precisou de prazo, e o teste deu o preço.** Sem
  > limite, a suíte que não mocka o Prisma travou o `afterAll` em **10 s**; em
  > produção o mesmo desenho entrega o processo ao `SIGKILL`, porque `close()` é
  > o caminho do `SIGTERM` e **a hora em que há erro acumulado é a hora em que o
  > banco é o suspeito**.
  >
  > **E uma guarda minha passava verde sobre o defeito que existia para achar** —
  > sétima vez desta família. A asserção da severidade no fingerprint variava o
  > **código** junto, então continuava verde com a severidade removida. Só
  > apareceu porque as cinco quebras de propósito foram rodadas uma a uma.

  > **A guarda nova fecha um buraco que não tinha sintoma: mudar o
  > `schema.prisma` e esquecer a migration deixa a suíte inteira verde.** O
  > `prisma generate` lê o *schema*, então o client tipa a tabela nova, o `tsc`
  > aprova e todo teste passa — o erro só aparece na primeira consulta contra o
  > banco real, que é produção, porque o `migrate.yml` aplica o que existe em
  > `migrations/`. Hoje há conjunto derivado do schema (models, enums e os nomes
  > de índice que a convenção do Prisma implica) cobrado contra o SQL aplicado.
  >
  > **E sem Docker à mão o SQL sai canônico do mesmo jeito:**
  > `prisma migrate diff --from-empty --to-schema-datamodel` **não precisa de
  > banco**, e devolve o que o Prisma geraria — em vez do que eu lembrei da
  > convenção.
  >
  > **A segunda guarda achou seis frases falsas no `packages/database/CLAUDE.md`,
  > todas anteriores à fase.** É o documento que uma sessão fria lê para saber o
  > que existe no banco, e ele não citava `UserPreference` (21/08) nem
  > `ProductEvent` (22/08), faltava dois enums, descrevia o `Favorite` pela
  > chave que a Fase 6 aposentou e dizia que o cleanup não apaga evento de
  > produto — que ele apaga desde a Fase 8. Lista escrita em prosa é a família
  > do `13` dos feeds, agora por **ausência** em vez de número errado.

- **Fora da linha das fases (2026-09-09): o erro que o servidor escolhe devolver
  parou de sumir, e a espinha do plano abriu.** A **Fase 3** (§7), PR 5 da ordem
  do §19. `AppError` ganhou `code`, `category`, `cause` e `context`; o primeiro
  ramo do handler global — que respondia e **não escrevia nada** — passou a
  logar, com o nível saindo da categoria; e entrou o `setNotFoundHandler`.
  **921 → 954 testes na API.** Item **56** do `docs/progress.md`.

  > **O achado grande não estava no inventário do plano: o `catch` do
  > `authPlugin` engolia toda recusa de sessão.** Ele responde 401 dali mesmo,
  > então o handler que a fase acabara de instrumentar **nunca era chamado** —
  > alcance de toda rota de conta e de admin. E o pior caso é o que torna isso
  > caro: sem `AUTH_JWT_SECRET`, `verifyAuthJwt` recusa **todo** token com a
  > mesma frase de um token expirado, e **essa variável já falhou em silêncio em
  > produção uma vez**. Hoje a recusa passa por `logAppError` e a resposta segue
  > idêntica — uniforme de propósito; quem separa as três causas é o `code`.
  >
  > **A regra de nível do plano estava errada num caso, e o plano foi corrigido
  > no mesmo PR.** `< 500 ⇒ debug` é certo para 404 e para token expirado, e
  > errado para o 401 acima: é configuração quebrada com cara de recusa. Quando
  > categoria e status discordam sobre a gravidade, **ganha a categoria** — o
  > status diz o que o cliente recebe, a categoria diz de quem é a culpa.
  >
  > **Mais três, todos medidos ao escrever a guarda.** O caminho não registrado
  > era **a única resposta de erro fora do contrato** (`{message, error,
  > statusCode}` do Fastify, com o caminho pedido ecoado de volta) e nenhuma
  > guarda podia alcançá-lo, porque nenhuma rota declara schema de 404 para o
  > que não é rota. `ValidationError` era classe exportada que **nenhum arquivo
  > lançava**. E `routes/health/index.ts` tinha a **quarta** cópia da conferência
  > do `JOB_SECRET`, com `!==` — a revisão da Fase 9 achou três e escreveu que
  > `assertJobSecret` era o único lugar.
  >
  > **A auditoria de completude, feita depois do CI verde, achou mais três — e a
  > pior é que o `POST /dev/dashboard/session` não escrevia nada.** É o **único
  > formulário de senha do produto**, e como ele responde **303** nem a linha de
  > acesso ajudava (303 < 400, sai em `info`): quem insistisse em adivinhar o
  > `JOB_SECRET` não produzia sinal nenhum. `authn_fail` é justamente o evento
  > que o §3.2 do plano cita. Junto: o `POST /api/auth/upsert` — **a única rota
  > que cria usuário** — conflava "token de uma pessoa usado para criar a conta
  > de outra" com todo token expirado; e uma sessão **que nós assinamos** sem
  > `sub`/`email` deixava o leitor logado com toda rota de conta em 401, em
  > silêncio. Três códigos novos, com guarda.
  >
  > **A guarda do `code` é derivada do parser, e falhou duas vezes antes de
  > servir.** A família do `AppError` é lida do próprio arquivo (lista digitada
  > responde "o que eu lembrei de olhar" — foi assim que a varredura da Fase 7a
  > perdeu a única rota fora de `app/api`), e os **defaults do construtor contam
  > como uso**: a primeira versão acusou `INTERNAL` de ser código sem quem o
  > lance, e ele é o que todo `new AppError('...')` carrega.

- **Verificação pós-merge da Fase 3 (2026-09-09): três defesas disparavam
  caladas.** Item **57**. A pergunta é a do item 39 e a do 52 — *o que ficou de
  fora?* —, e quem respondeu foram duas varreduras sobre a árvore mergeada: todo
  `catch` que descarta o erro, e **toda resposta de erro que não passa pelo
  handler global** (a armadilha 29, escrita na própria fase, usada como
  ferramenta). Sete saídas laterais; quatro já cobertas, **três mudas**.
  **954 → 964 testes na API.**

  > **A mitigação de uma GHSA *high* não escrevia nada** — a recusa de
  > `Content-Type` com caractere de controle, que é o bypass de validação da
  > `fastify@4`. Ninguém manda TAB ali por acidente: é sonda contra CVE
  > conhecida. Virou `CONTENT_TYPE_REJECTED`, com `category: 'authorization'`
  > **porque o nível é o que importa** — `validation` sairia em `debug`, e
  > produção roda em `LOG_LEVEL=info`, então a linha não existiria e a correção
  > não compraria nada.
  >
  > **O `verifyAuthJwt` descartava a razão do jose** — expirado, assinatura
  > errada e malformado pedem ações opostas e viravam a mesma frase —, e a Fase
  > 3 tinha acabado de criar o `cause` para guardá-la. E o `invalid` do
  > `/api/health/providers` colapsava "chave recusada", "provedor fora do ar" e
  > "timeout": o status na resposta **não mudou** (é contrato declarado), a razão
  > passou a existir no log. **A URL da sonda não entra na linha** — ela carrega
  > a chave —, e há asserção sobre isso.
  >
  > **O Gitleaks varreu `0 commits` no push do merge, com ✅ verde.** Terceira
  > medição do mesmo buraco (`--no-merges --first-parent`). O conteúdo foi
  > varrido no PR; o gate do merge é que é decorativo.

- **Fora da linha das fases (2026-09-07): o BFF parou de engolir a falha, e com
  isso o bloco 1 do plano de observabilidade fechou.** A **Fase 7a** (§11.1), PR
  4 da ordem do §19. O parser deu o número que a inspeção de 01/09 tinha dito em
  prosa: **quatro cláusulas `catch` no BFF, zero registrando qualquer coisa** —
  e aqui não há pino nem Render, o **log de função da Vercel é o log**, então o
  que não vai para o stderr não existe depois que a invocação termina. Entrou
  `apps/web/lib/log-server-error.ts`, uma linha JSON **na forma que o pino já
  escreve na API**, e os três `catch` que viram status passaram a escrevê-la.
  **652 → 680 testes no web.** Item **51** do `docs/progress.md`.

  > **Três achados, e nenhum estava no plano.** O `requestId` que o §11.1 diz
  > fazer o `x-request-id` pagar é **`null` em toda requisição real** — o
  > navegador não manda o cabeçalho, e na falha não há resposta da API para
  > devolver o dela; o campo fica porque é onde o id entra quando a §11.2
  > existir. O `cause` importa mais do que o plano diz: o undici lança
  > `TypeError: fetch failed`, e `ECONNREFUSED` está **só** ali dentro. E a
  > lista de segredos do plano tinha **três** contra os **seis** do
  > `.env.example` — faltava justamente o `BACKEND_JOB_SECRET`, que viaja no
  > `Bearer` de um dos três `catch`. A lista virou derivada do `.env.example`.
  >
  > **A guarda existente achou um defeito de fronteira que já estava lá.** O
  > `trust-boundary.test.ts` reprovou o arquivo novo, com razão — ele cita
  > `AUTH_JWT_SECRET` —, mas a lista significava "autorizados a **assinar**", e
  > o redator faz o oposto: lê o valor para **tirá-lo do log**. Fundir os dois
  > teria transformado a lista em "arquivos que mencionam o segredo". Virou
  > `SECRET_SIGNERS` + `SECRET_REDACTORS`, e **nasceu a asserção que faltava**:
  > só os três signatários chamam `signAuthJwt`. Antes, entrar na lista dava as
  > duas permissões de uma vez.
  >
  > **E a revisão do próprio diff pagou de novo, com um comentário meu.** Ele
  > afirmava que a guarda exercita o coletor pelo mesmo caminho de código — e
  > logo abaixo estava a cópia. Mesma família do achado da Fase 2: prosa que
  > descreve comportamento é asserção sem teste.

  > **A verificação pós-merge achou mais três (item 52), e o padrão do item 39 se
  > repetiu:** ler o depois de mergeado muda a pergunta de "o código está certo?"
  > para "o que ficou de fora?". **A guarda varria `app/api` e a
  > `app/news-sitemap.xml/route.ts` é a única rota fora dali** — justamente a que
  > o Google Notícias lê, engolindo duas falhas em silêncio; o defeito era o
  > alcance, não o `catch`, e hoje a varredura é por *"o que é uma rota"*. O
  > **`signAuthJwt` estava fora do `try`**, então a falha que derruba toda rota de
  > conta e de admin de uma vez era a única sem log, num PR feito para acabar com
  > isso (loga e **relança** — o status não muda). E **o Gitleaks não varre o que
  > entra por merge**: o scan de `push` usa `--no-merges --first-parent`, e no
  > merge do #160 isso deu **zero commits varridos** sobre um conteúdo que
  > reprovou o PR duas vezes. O valor era fixture de teste, não segredo — o que
  > fica é o buraco no gate, hoje dívida com gatilho no §16.

- **Ferramenta (2026-09-07): as telas de admin entraram em captura pela primeira
  vez.** `pnpm --filter @newranews/web admin:capture` — a baseline visual exclui
  `/admin` porque exige sessão, e esse comentário valia desde que a baseline
  existe. **Três dos seis achados da revisão da Fase 2 eram defeitos visíveis sem
  sintoma de código**, e apareceram só porque um humano mandou print; este script
  é o mecanismo que acha essa classe sozinho. Item **50** do `docs/progress.md`.

  > **A sessão é forjada com a mecânica que o smoke E2E já usa** — assinar o
  > cookie do next-auth é o que o próprio next-auth faz depois do OAuth. Quatro
  > decisões sustentam isso: **nada mora no app** (apagar o arquivo deixa o
  > produto bit a bit igual — atalho de autenticação dentro do app é OWASP M10 /
  > CWE-489), **só localhost**, o **`NEXTAUTH_SECRET` local tem de diferir do de
  > produção** (a checagem de host protege o script, não o token), e a saída é
  > gitignored com cookie de cinco minutos.
  >
  > **A primeira execução de verdade achou quatro defeitos na própria
  > ferramenta** — seletor que casava o menu mobile, espera fixa que fotografava
  > o esqueleto, `fullPage` duplicando o cabeçalho `sticky` na emenda, e a
  > correção disso apagando o esconderijo do skip link. Nenhum tinha sintoma; os
  > quatro apareceram olhando a imagem que ela produziu.

- **Fora da linha das fases (2026-09-07): o pipeline ficou visível para quem
  consegue entrar.** A **Fase 2** do plano de observabilidade, PR 3 da ordem do
  §19. O dado existia desde a Fase 9 — `PipelineLog` e `PipelineEvent` — e a
  única superfície que o mostrava era o `/dev/dashboard`, atrás do `JOB_SECRET`:
  o dono do produto não conseguia ver, de nenhuma tela em que conseguisse
  entrar, que o run de ontem falhou na etapa 6, o que o erro dizia, ou que ele
  falha há três dias. Entrou **sem tabela nova, sem consulta nova e sem rota
  nova no web**: `GET /api/admin/pipeline/runs` e `/runs/:pipelineId` reusam
  `getDevLogs`/`getDevLogDetail` verbatim, e os três painéis moram na `/admin`.
  **892 → 920 testes na API, 618 → 652 no web.** Item **49** do
  `docs/progress.md`.

  > **O prefixo `/api/admin` é o que a fase realmente comprou.** `authPlugin` e
  > `requireAdmin` registram **uma vez no grupo**, o que faz de "tudo sob
  > `/api/admin` é ADMIN" uma garantia estrutural em vez de hábito por rota — e
  > há guarda enumerando o `printRoutes()` e cobrando `access: 'admin'` de cada
  > linha, com uma segunda asserção exigindo que o filtro **encontre alguma
  > coisa**. O `/api/dev/*` fica intacto de propósito: acesso por segredo é o
  > caminho que funciona quando **não há sessão**, e isso importa mais
  > justamente quando o que quebrou é o provedor de sessão. Há teste comparando
  > os corpos das duas portas, para que "duas portas, um contrato" seja algo que
  > reprova.
  >
  > **Os achados foram todos da implementação e da revisão, nenhum do plano.** A
  > armadilha 8 do §17 apareceu na hora de escrever a tela: `durationSeconds` é
  > **segundo** e `formatPipelineDuration` recebe **milissegundo**, então o
  > caminho óbvio renderiza **"45 ms" para um run de 45 s** — sem erro de tipo e
  > sem aviso. E o `admin-panel.test.tsx` caiu inteiro porque seu
  > `vi.mock('@/lib/queries')` declarava só os três hooks que conhecia: **mock
  > parcial mente por omissão**, a mesma família do `vi.mock` de `env` da Fase 1,
  > agora do lado do web.
  >
  > **A revisão do próprio diff achou mais quatro, todos na tela e nenhum com
  > sintoma de código** — build, lint, `tsc` e as asserções do componente
  > passavam por cima dos quatro. O de maior alcance: `recentErrors` inclui o
  > último run quando ele falhou, então a tela empilhava **duas caixas vermelhas
  > sobre o mesmo run**, e o teste que existia usava um último run
  > **bem-sucedido** — nunca exercitando o estado em que alguém de fato abre
  > esta tela. Junto: `errorDetail` atravessando a rede para ser descartado pelo
  > consumidor, `role='alert'` sobre conteúdo (o leitor de tela interrompe a
  > leitura ao abrir a página), e dois comentários afirmando coisa que o código
  > não fazia. Detalhe no item 49.

- **Fora da linha das fases (2026-09-05): o log virou sistema, e a DSN com senha
  parou de sair no stdout.** A **Fase 1** do plano de observabilidade, PR 2 da
  ordem do §19. A API tinha **6** chamadas ao logger do Fastify contra **14
  `console.*`** que o contornavam, e `logger:` era um **booleano** — sem `level`,
  sem `redact`, sem `serializers`. Hoje há `apps/api/src/utils/logger.ts` (uma
  instância de pino), `redactSecrets` ao lado do `redactEmails`, `LOG_LEVEL` no
  blueprint, uma linha de log por requisição em vez de duas, `pipelineLogId` em
  toda linha escrita durante um run (por `AsyncLocalStorage`, sem nenhuma
  assinatura mudar) e `no-console: 'error'` no ESLint da API. **868 → 892 testes
  na API.** Item **48** do `docs/progress.md`.

  > **Os dois achados foram da implementação, e nenhum estava no plano.**
  > Declarar `baseLogger` com o tipo que `pino()` devolve **fixa o parâmetro de
  > logger do `FastifyInstance`**, e `registerDailyPipelineJob(app)` para de
  > compilar a três arquivos de distância — a suíte inteira passava, só o `tsc`
  > viu; a correção é declarar o export como `FastifyBaseLogger`. E resolver o
  > nível por `NODE_ENV !== 'test'` faz **mock parcial de `env` acender o
  > logger**: duas suítes de provider passaram a despejar JSON com stack trace no
  > stdout do CI sem que teste nenhum falhasse. A condição virou lista de
  > permissão. É o `env` lido na carga do módulo em mais uma forma — o mock
  > parcial não erra, mente por omissão.
  >
  > **E a revisão da fase achou um terceiro, na guarda recém-escrita:** a
  > varredura de `console.*` passava verde sobre um `console.warn` real, porque
  > uma aspa **dentro de um literal de regex** (`.replace(/"/g, …)`) abria uma
  > string que nunca fechava e apagava **481 linhas do `src/`**. Virou parser do
  > TypeScript. Detalhe na armadilha, abaixo.

- **Fora da linha das fases (2026-09-05): a esteira ganhou etapa de segurança —
  a Fase 10 do plano de observabilidade, primeiro PR de código dele.** Os cinco
  workflows tinham **1 `permissions:` declarado** e **zero actions fixadas**;
  hoje são seis workflows, todos com o `GITHUB_TOKEN` no mínimo, e as **21
  ocorrências de `uses:` fixadas em SHA de 40 hex** com o comentário da versão.
  Entraram `pnpm audit --audit-level=high --prod` reprovando o merge, **CodeQL**
  e **Dependabot**. **856 → 865 testes na API.** Item **47** do
  `docs/progress.md`.

  > **O `--prod` é a decisão que faz o gate durar, e foi medida:** sem ele são
  > 35 advisories *high* em 17 pacotes, quase todas em ferramenta que nunca é
  > publicada, e lista de exceção com 35 linhas vira ruído até alguém desligar o
  > passo. Com ele são **18**, todas já analisadas nos itens 9.S e 10.S, com
  > **três gatilhos**: `next@15`, `fastify@5`, e reabrir a UI do Swagger em
  > produção. Elas ficam em `docs/security-advisories.md`, e a guarda impede que
  > o documento e o `package.json` divirjam.
  >
  > **A guarda achou dois defeitos enquanto era escrita.** A contagem de
  > workflows em prosa nos dois READMEs (o item 41 outra vez, no mesmo turno em
  > que o arquivo novo entrou); e ela mesma passando verde sobre
  > `permissions: write-all` — escrito na **coluna zero**, ele escapava do
  > `^\s+` da asserção de escrita e passava na de declaração. Sexta vez nesta
  > família: a guarda vê caractere, não intenção.

- **Fora da linha das fases (2026-09-03): a etapa 8.5 parou de derrubar a
  instância, e o run morto parou de travar o dia.** Nasceu de um alerta do
  Render (*health check timed out after 5 seconds*). O pipeline do dia estava
  íntegro — briefing no ar, **377 itens de 45 fontes**, `archive:hygiene`
  fechando com **`Acervo limpo`** —, mas a varredura do acervo segurava o event
  loop por **45 s** e o Render matava a instância com `SIGTERM` **no meio da
  etapa**, deixando o `PipelineLog` preso em `RUNNING` e recusando todo disparo
  pelo resto do dia. Hoje a varredura pagina por cursor e respira a cada 100
  linhas, e `RUNNING` há mais de 15 min é enterrado antes do disparo seguinte.
  **837 → 848 testes.** Item **46** do `docs/progress.md`.

  > ~~**Sobrou dívida com gatilho:** três dos 12 feeds RSS (Superinteressante,
  > Veja Saúde, Drauzio Varella) estão em `ETIMEDOUT` desde 02/09 e o pipeline
  > os registra como `feed-empty` — a classe de "publicou devagar", que não
  > conta em `pipelineErrors`.~~ **Fechado no mesmo PR:** `fetchFromRss` agora
  > devolve `failures` por fonte, e a fonte que lançou vira `feed-failed` — que
  > **conta** — em vez de `feed-empty`. Ver `FetchWarningKind` em
  > `news-fetcher.service.ts`. **848 → 853 testes.**
  >
  > **O outro fio (o Groq nos dois últimos briefings) foi investigado, e não
  > pede correção.** O log de 03/09 mostra três tentativas, todas 503
  > `UNAVAILABLE — This model is currently experiencing high demand`: é o
  > `gemini-2.5-flash` sobrecarregado do lado do Google, reportado em massa por
  > terceiros ao longo de 2026 (fóruns oficiais do Google AI, issues do
  > `googleapis/python-genai`), não uma cota nossa — o pipeline chama a Gemini
  > **uma vez por dia**, longe de qualquer teto de RPD. `isTransientApiError`
  > classificou certo, `withRetry` tentou três vezes com backoff, e o fallback
  > para o Groq entregou o briefing sem perda. **Gatilho para agir:** três dias
  > seguidos de fallback (hoje são dois, medidos por
  > `aiProviderUsage.groq` em `/api/metrics/weekly`). **Desde a Fase 8 a
  > `/admin` mede isso sozinha:** "Degradado pela etapa 6 há 3 execuções
  > seguidas" aparece na faixa de desfechos quando o gatilho dispara.

- **Fora da linha das fases (2026-09-01): os seis diagramas passaram a
  descrever o sistema que existe.** Item **adiantado da Fase 13.5**. Os quatro
  `.mermaid` eram de 16/08 e tinham sido tocados uma vez desde então: o ER
  documentava **4 das 12 tabelas**, o de arquitetura anunciava um keep-alive
  removido dois dias antes e uma UI de Swagger que produção não registra desde
  a Fase 9, os dois do pipeline diziam **9 etapas** quando são **11**, e o
  contrato do disparo era o que mentia antes do item 39. Entraram dois:
  **mapa de rotas do frontend** (15 páginas, com o modo de renderização de cada
  uma) e **fluxo de sessão** (o JWT com escopo que atravessa do Next para a
  API — contas e admin existem desde a Fase 6 e não estavam em diagrama
  nenhum).

  **A sintaxe estava certa o tempo todo — os seis parseiam e renderizam.** O
  defeito era 100% de conteúdo, que é a razão de nada ter acusado. Guarda nova
  em `apps/api/tests/docs/diagram-drift.test.ts`, e ela compara **conjuntos
  derivados da fonte** (models do schema, `page.tsx` do `app/`, etapas que o
  pipeline anuncia), não contagens. Item **44** do `docs/progress.md`.

- **Fora da linha das fases (2026-08-31): o README virou padrão, nos dois
  idiomas.** `README.md` em inglês e `README.pt-BR.md` espelhado, gerados pelo
  procedimento do `README-GENERATOR.md` — a mesma especificação que vai rodar
  contra os outros três repositórios do conjunto. **Isto fecha duas das dívidas
  da 13**: a dos screenshots da V1 (o `docs/screenshots/` foi apagado e as telas
  passaram a sair da `baseline-v2`) e a do `docs/presentation.md`, reescrito
  depois das Fases 0–12 — com os números medidos e datados, e os desafios da V1
  trocados pelos da V2.

  **O achado é o método, não o arquivo: cinco afirmações do README tinham
  deixado de ser verdade, e nenhuma tinha sintoma.** O `/api/docs` anunciado em
  produção **não existe lá** desde a Fase 9 (`isDocsUiEnabled`); os feeds RSS
  eram **12 e não 13** desde a saída da Reuters em 24/08; os screenshots eram de
  **16/08**, quatro dias antes de o redesign começar; não havia tabela de
  variáveis de ambiente; e não havia par bilíngue. **Documento não tem CI** — a
  única coisa que os pegou foi a regra do gerador de conferir toda afirmação
  contra um arquivo real do repositório.

  O `13` estava escrito em **oito** arquivos, incluindo o parágrafo do
  `rss.provider.ts` que conta a história da remoção da Reuters. Virou guarda:
  `apps/api/tests/docs/feed-count-drift.test.ts` compara `rssSources.length` com
  a contagem escrita em prosa nos nove arquivos vivos. Item **41** do
  `docs/progress.md`.

- **Última entrega (2026-08-25):** a **Fase 12 (refinamento visual e de
  leitura)**, com os sete eixos fechados. **Sete achados, e o padrão é novo: são
  todos visíveis e nenhum tem sintoma de código** — build, 1.314 testes,
  Lighthouse e smoke passavam por cima de todos. O de maior alcance era o
  **texto que vem do feed**: **63,7% do acervo com tag HTML no corpo**, metade
  abrindo com um `<img>` impresso como texto, e o campo de subtítulo guardando a
  matéria inteira (**mediana de 594 caracteres, máximo de 33.073**). Junto:
  **as abas de `/account` desenhadas umas sobre as outras**, por colisão entre
  o token `--spacing-block` e a utility `inline-block` do Tailwind; **`/admin`
  sem link nenhum em tela ≥ 768 px** desde o masthead da Fase 3; **o rótulo
  "Trecho" sobre uma caixa vazia em 23,2%**; a palavra **`null` como subtítulo
  em 158 notícias**; **`**asteriscos**` no meio da frase em 60% dos briefings**;
  e **um retângulo laranja com um "N" em 25,5% das células da grade**.

  **A lição de fluxo foi a primeira versão da higiene de texto**, que teria
  descartado **5.635 corpos** — máximo de 33.073 caracteres — por confundir "o
  corpo repete o dek" com "os dois campos guardam a mesma matéria". Só um ensaio
  contra produção pegou; um teste de unidade sobre caso inventado passaria nas
  duas versões. **1.314 testes em 122 suítes → 1.391 em 126.** Detalhe no item
  **38** do `docs/progress.md`.

  > **A verificação pós-merge (item 39) confirmou seis dos sete achados no ar e
  > achou o sétimo pendente do mecanismo:** a higiene de texto age pela ingestão
  > e pela etapa 8.5, e o pipeline do dia já tinha rodado antes do merge. Ela
  > produziu um achado próprio — **o painel dizia "Pipeline disparado com
  > sucesso" sem ter disparado nada**, porque o `triggerPipeline` é idempotente
  > por dia e a resposta não contava isso. Corrigido no PR seguinte.

- **Entrega anterior (2026-08-24):** a **Fase 11 (integração geral)** — quinze
  achados, o smoke E2E estreando com 29 specs contra produção, e o
  `revalidate = 3600` que não fazia nada nas duas telas de leitura. Item **36**.

- **Monetização é só planejamento** (§21): publicidade **cancelada**; newsletter
  patrocinada, Newra Plus e API B2B **adiados**. O gatilho é um número —
  **assinantes ativos e contas**, os dois persistentes.
- **Testes:** 2.293 em 181 suites (**1.389 API em 92** + **904 web em 89** — todos
  passando), mais o **smoke E2E** — um arquivo de spec por fluxo (visitante,
  acervo, conta, newsletter, autorização) —, que roda contra produção pelo
  workflow `Smoke E2E` e **não** faz parte do `pnpm test`. Cobertura
  da API medida em 31/08: **98,77% stmts · 92,96% branch · 99,49% funcs**; a do
  web remedida em 07/09: **74,16% stmts · 90,25% branch · 73,48% funcs** — com
  piso de 70% no CI desde
  a Fase 10, que antes media só a API.

### Por onde começar a Fase 13 (Ajustes finos e release final)

**As Fases 9, 10, 11 e 12 estão fechadas.** Leia os itens **34**, **35**, **36**
e **38** do `docs/progress.md` — a 13 é o fechamento, e cada um dos quatro
registra o que deixou pendente para ela.

**O plano das cinco fases finais está na §28.** Antes de abrir a 13, leia de lá
as mesmas três coisas que as outras leram:

- **"Anatomia de uma fase de revisão"** — **todo achado sai como correção
  mergeada, guarda no CI, ou dívida com gatilho numérico**. Nunca como item de
  lista. E a fase abre com inventário fechado, senão não tem critério de parada.
- **"A camada de segurança e testes"** — os eixos **`S`** e **`T`** são
  obrigatórios e **não são adiáveis**. Na 13 eles mudam de natureza: `S` é **o
  gate** (o que precisa estar verde para publicar) e `T` **não escreve teste
  novo** — exige a suíte inteira verde e que o gate reprove quando deve.
- **A seção da Fase 13**, e só ela. Cada fase tem inventário próprio.

**A 13 não caça vulnerabilidade** — isso foi trabalho das três revisões. Ela
decide cada coisa que ficou em aberto, fecha os critérios de aceite da §31 e da
§26, e publica.

> **A baseline visual mudou de tela na Fase 12**, e isso é escopo direto da
> **13.5**: as 51 capturas de `docs/v2/baseline-v2/` são de antes do card de
> texto, do briefing renderizado e do painel com abas. Recapturar é obrigatório
> antes de a §31 ser fechada.
>
> **E agora a recaptura conserta o README junto.** Desde 31/08 as três telas do
> README apontam para `home--1440.jpg`, `news--1440.jpg` e
> `article-detail--1440.jpg` **deste diretório**, em vez de manter cópia
> própria. O diretório é reescrito a cada fase com os mesmos nomes, então a
> 13.5 atualiza os dois de uma vez. Foi a cópia própria — `docs/screenshots/`,
> de 16/08 — que envelheceu quinze dias sem ninguém ver, e ela **foi apagada**:
> o diretório não existe mais. Captura de tela que mora fora do conjunto que o
> ritual recaptura é cópia condenada a divergir.

**A dívida das fases 0–12 que a 13 herda, levantada na auditoria de fechamento
(item 37) — nenhuma delas é escopo novo, todas são coisa que ficou para trás:**

- ~~o diagrama ER documenta 4 entidades e o schema tem 12; os quatro
  `.mermaid` são de 16/08~~ — **fechado em 01/09**: os quatro foram reescritos
  contra o código, entraram mais dois (rotas do frontend e fluxo de sessão) e há
  guarda derivada do schema, do `app/` e do pipeline. Item 44;
- ~~os screenshots do README são de 15/08, da V1~~ — **fechado em 31/08**: o
  README passou a apontar para `docs/v2/baseline-v2/`, e a recaptura da 13.5
  atualiza os dois de uma vez;
- ~~`docs/presentation.md` é de 16/08~~ — **fechado em 31/08**: reescrito
  depois das Fases 0–12, com os números medidos e datados, e os desafios
  trocados pelos da V2;
- **a newsletter não entrega a assinante real** — o domínio nunca foi verificado
  no Resend, então o envio funciona só para o e-mail da conta. O produto tem
  inscrição, cancelamento, estágio no pipeline e tela, e **não envia**;
- **`GET /api/trending` etapa 2** esperava a camada de analytics, que existe
  desde a Fase 8 — o gatilho disparou e ninguém percebeu;
- **zero tags e nenhum `CHANGELOG.md`** (o `CONTRIBUTING.md` existe);
- **o opt-out de analytics na interface**, aberto desde a Fase 8.

**O que a auditoria conferiu e está em ordem:** zero `TODO`/`FIXME` no código de
produção; `docs/api.md` guardado contra deriva; 9 rotas públicas e 6 de metadata
em 200, endereço errado em 404; advisories de produção em 36, sem regressão.

**O que a 11 deixou explicitamente para a 13**, e é bom não redescobrir:

- **A primeira leitura honesta da tela de métricas** é o único item da 11 que não
  fechou: exige credencial de admin de produção. Tudo que a prepara está feito —
  a cadeia de ingestão provada ponta a ponta (`accepted: 1`), o balde
  compartilhado medido, e o gatilho de subcontagem **observável sem
  instrumentação nova**: 429 em `POST /api/events` dentro de
  `GET /api/metrics/http`.
- **Os fluxos autenticados do smoke** (conta e admin) ficam pulados até os
  quatro segredos serem configurados — e o pulo é impresso pelo workflow. Ligá-los
  põe o `NEXTAUTH_SECRET` de produção no runner do CI; a decisão é de quem é dono
  do segredo. `apps/web/e2e/support/session.ts` documenta.
- **Rollback pós-deploy** (§13.6). O smoke falha e avisa; reverter sozinho exige
  distinguir "o deploy quebrou" de "a API estava dormindo", e este projeto já
  cometeu o erro oposto com o gate do Lighthouse medindo cold start.
- **A `fastify@5`** e as três advisories que esperam a major (item 34).
- **`LCP alvo < 2,5 s` da §31 mudou de estado no fechamento da 11.** Com as duas
  telas de detalhe entrando no gate, **uma rota passou a alcançá-lo** —
  `/article/[date]` em **2,42 s** — e as outras seis medem de 2,61 s a 2,90 s. O
  critério deixou de reprovar em bloco e virou pergunta de escopo.

**Três dívidas compartilham o mesmo gatilho, e é o Next 15:** as advisories do
`next` — **8 *high* mais 2 *critical* desde 09/09/2026** (nenhuma alcança esta
configuração hoje; a tabela está no item 35 e o aceite em
`docs/security-advisories.md`), o **soft 404** (`notFound()` em rota com
`revalidate` e `not-found.tsx` aninhado responde **200**; quem segura o estrago é
o `noindex` no caminho de falta, e essa linha tem guarda) e o **meta refresh do
`redirect()`** — que é da mesma família e a 11 cobriu no caso comum, pelo
middleware.

> **As duas *critical* mudaram o peso desse gatilho, e uma delas tem um fio
> solto.** A do AVIF (`libheif` no `sharp`) não alcança porque **o `/_next/image`
> é servido pela plataforma da Vercel, não pela app** — medido em 09/09, com
> `sharp` fora do lockfile e a requisição nem chegando à região da função. Mas a
> saída documentada para o **estouro de cota do otimizador** (que a mesma medição
> encontrou: todo `/_next/image` em **402**) é *servir a imagem por um proxy
> próprio* — e isso traz `sharp` para dentro e **reabre a advisory**. Resolver a
> cota por esse caminho faz o Next 15 deixar de ser dívida e virar pré-requisito.

**O que a 11 deixou pronto e a 13 pode aproveitar:** o smoke E2E, que passa a ser
parte do ritual de fechar fase; e seis guardas exaustivas novas — resposta de
rota ⇒ contrato de tipo declarado, `fetch` ⇒ prazo declarado, página com
`revalidate` ⇒ jeito de ser guardada, evento do catálogo ⇒ call site, variável do
schema ⇒ linha no blueprint, e o mapa de confiança como teste.

### Armadilhas que já custaram caro

- **Laço síncrono sobre coleção que cresce derruba o servidor que o hospeda, e
  o sintoma chega por e-mail do provedor.** A etapa 8.5 varria as 8.190 linhas
  do acervo num `for` sem devolver o event loop; com 0.1 vCPU no plano free do
  Render isso são **45 s de processo mudo**. Os health checks de 5 s pararam de
  ser respondidos às 11:00:22 de 03/09/2026 e o Render matou a instância com
  `SIGTERM` às 11:01:07 — no meio da etapa, deixando o run preso em `RUNNING`.
  **Nada no código parece errado**: não há laço infinito, não há vazamento, a
  função retorna. O que faltava era o `await` que cede o controle — e o teste
  que trava isso não pode conferir `take`, tem de perguntar **em que ponto** do
  laço o event loop girou (`setImmediate` agendado antes, contador lido dentro).
  **E meça antes de escolher a correção:** a suspeita óbvia era memória, e o
  acervo inteiro são ~27 MB em 512 MB — paginar aqui é sobre CPU, nunca RAM.
  Corolário: em regime a varredura **não escrevia nada** (zero linhas tocadas),
  então o trabalho que derrubou a API era trabalho jogado fora.

- **Run que só é marcado no fim fica `RUNNING` para sempre quando o processo
  morre — e trava o dia inteiro.** O `status` vira `SUCCESS` na etapa 9, e o
  `catch` não alcança um `process.exit`. Como a idempotência aceita `RUNNING`
  como "já tem run hoje", **um cadáver recusa todo disparo até a meia-noite**,
  com a tela dizendo "já está rodando". É a família do episódio de 25/08 pelo
  avesso. Hoje há `STALE_RUN_MS` (15 min) enterrando o run morto antes de
  seguir. Ao escrever máquina de estado com estado terminal só no fim do
  caminho feliz, decida **quem marca o estado quando o processo não volta** —
  **e de que dia**: o enterro olhava só o run de hoje, e o cadáver de 03/09
  ficou `RUNNING` em produção por três semanas (a faixa o desenhava
  "Rodando"; a invariante `pipeline.no_stale_running` o acusava em todo run).
  Achado do ensaio de aceitação em 24/09; hoje a varredura é de qualquer dia.

- **Gatilho agendado que não acorda quem ele chama perde o dia inteiro.** O cron
  das 11h UTC é justamente a hora em que a API mais provavelmente dorme, e o
  disparo tinha 20 s — folga sobre o cold start comum (4,9 s), **não** sobre a
  primeira acordada depois de um mês suspenso. Em 01/09/2026 ele estourou, o
  `catch` devolveu 500, e **o dia ficou sem briefing** — o único sinal foi o
  briefing ausente. Hoje a rota do cron **acorda antes de disparar**
  (`warmApi`, duas tentativas de 25 s no `/api/health`) e devolve `warmed`, que
  é o que separa "não acordou" de "acordou e recusou". Ao agendar chamada para
  serviço que hiberna, o prazo do disparo não é o prazo de acordar.
- **Agendamento do GitHub Actions não serve para keep-alive.** Medido em
  01/09/2026: o workflow de 10 em 10 minutos rodou **2 vezes contra 46
  esperadas**, uma delas 47 min atrasada e fora da janela. A documentação do
  GitHub pede **no mínimo 15 min** em repositório público e avisa que execução
  agendada é despriorizada e **descartada em silêncio** — e o Render dorme aos
  15 min, então os dois números não deixam folga. Para agendamento de minutos,
  serviço dedicado; o `schedule` do Actions serve para o que é diário.
- **Plano gratuito que cobra tempo ligado não combina com keep-alive.** O free
  do Render dá **750 h/mês de instância**, e dorme sozinho com ~15 min sem
  tráfego. O keep-alive pingava a cada **5 min** — e como 5 < 15, o serviço
  **nunca dormia**: 24 h × 31 dias = **744 h contra 750**, 0,8% de folga. Em
  29/08 as horas acabaram e a API ficou **suspensa até o dia 1º**; o site
  continuou de pé (ISR mantém a última página boa) e **congelado** no conteúdo
  daquele dia. O erro não foi configurar o keep-alive — foi **nunca ter feito a
  multiplicação**. Ao pôr um ping periódico em qualquer serviço gratuito,
  calcule as horas antes: a pergunta não é "está dormindo?", é "quanto custa
  não dormir?". **Hoje não há keep-alive** — o que ele comprava foi medido e não
  pagava o preço. `docs/setup.md` §9.0.
- **Antes de manter um mecanismo, meça o que ele compra.** O keep-alive existia
  desde a Fase 8, quando o cold start derrubava o Lighthouse. As fases seguintes
  puseram prefetch e ISR em tudo — a `/news` passou a trazer a primeira página
  **no HTML**, com `staleTime` de 5 min, sem tocar a API — e ninguém reconferiu
  se a premissa ainda valia. Ela não valia: o keep-alive comprava ~5 s no
  segundo clique e custava 99% da cota mensal, e foi o que suspendeu a API por
  dois dias. **Premissa herdada de uma fase anterior tem prazo de validade igual
  à medição que a originou.**
- **Diagrama é a documentação que apodrece sem deixar sintoma, e a sintaxe
  válida disfarça.** Os quatro `.mermaid` de 16/08 passavam no parser, rendiam
  imagem bonita e descreviam um sistema de duas fases atrás: 4 das 12 tabelas,
  4 das 15 rotas, 9 etapas de 11, um keep-alive apagado e uma UI de Swagger que
  produção não registra. **Ninguém reabre um `.mermaid` ao acrescentar uma
  tabela** — a mudança não abre o arquivo, e "renderiza" é o que se confunde
  com "está certo". A guarda tem de comparar **conjunto derivado da fonte**
  (models do schema, `page.tsx` do `app/`, etapas que o pipeline anuncia) e
  nunca contagem: aqui a etapa 2 não grava evento, então contar marcadores dá
  10 enquanto a prosa diz 11, e os dois estão certos.
  `apps/api/tests/docs/diagram-drift.test.ts`.
- **Duas do parser do Mermaid, que só aparecem renderizando.** Linha com `%%`
  sozinho **quebra `flowchart` e `erDiagram`** (o comentário vazio não consome a
  quebra de linha, e o parser recebe `%%%%flowchart TB`) e **passa em
  `sequenceDiagram`** — são parsers diferentes, então um diagrama verde não
  garante o vizinho. Use `%% ---` como separador. E `;` dentro de um `Note` de
  `sequenceDiagram` **termina a instrução**: o resto da nota vira instrução nova
  e o erro sai a três linhas de distância, apontando para texto que está certo.
- **Remover um item de uma lista é uma linha; a contagem dela está escrita em
  prosa, em oito arquivos que a mudança não abre.** A Reuters saiu de
  `rss-sources.ts` em 24/08 porque o domínio deixou de existir, e o `13`
  sobreviveu nos dois `CLAUDE.md`, em dois diagramas, na peça de portfólio, no
  plano da V2, no README — e no parágrafo do **próprio `rss.provider.ts`** que
  conta a história da remoção, e que seguia dizendo **treze** ao explicar por
  que uma suíte não deve bater em todos eles.
  **O `tsc` não lê prosa e a suíte não lia**; só apareceu quando a padronização
  do README mandou conferir toda afirmação contra um arquivo real. Hoje há
  guarda: `apps/api/tests/docs/feed-count-drift.test.ts` compara
  `rssSources.length` com o que está escrito, e a lista de arquivos é
  **explícita** — `docs/progress.md` e a §74 do plano guardam o `13` de
  propósito, porque são registro histórico. Número que descreve uma coleção
  quer guarda derivada da coleção, nunca um segundo lugar onde ele é digitado.
- **Resposta que não distingue "fiz" de "não precisei fazer" vira tela que
  mente.** O `triggerPipeline` é idempotente por dia e devolvia **só o id**: com
  um run de hoje já em `SUCCESS`, ele entregava o id daquele, a rota respondia
  `200 { status: 'started' }`, o BFF traduzia para `success: true` e o painel
  imprimia "Pipeline disparado com sucesso". Em 25/08 o botão foi clicado, a
  tela confirmou, **e nada rodou** — custou uma rodada inteira de investigação
  para descobrir, porque não havia sinal nenhum. Hoje a rota devolve `outcome`
  (`started` · `already-running` · `already-succeeded-today`) e o painel diz
  qual foi, com a hora do run referido. **Ao escrever resposta de rota que pode
  não fazer nada, o "não fiz" precisa caber no contrato** — com schema de
  resposta declarado, o que o schema não diz não existe para quem consome.
- **Token do `@theme` gera utility, e a utility pode ter o nome de outra.** No
  Tailwind v4 um `--spacing-<nome>` não gera só `p-<nome>` e `gap-<nome>`: gera
  o eixo de espaço inteiro, e `inline-<valor>` ali é `inline-size`. Com
  `--spacing-block` declarado, a folha ganha **dois** `.inline-block` — o de
  display e o do token — na mesma especificidade, e vence o último. As quatro
  abas de `/account` mediam **33 px** (`clamp(1.5rem, 1.25rem + 1vw, 2.5rem)` a
  1280 px = 32,80 px) com o texto vazando por cima do vizinho. **Nada avisa:** a
  classe existe, o `display` é aplicado, e a largura vem de outro lugar. Guarda
  derivada dos tokens em `tests/lib/design-tokens.test.ts`.
- **Link que depende de sessão precisa estar nas duas cascas, e nada obriga.** O
  masthead de três linhas partiu a `Navbar` responsiva da V1 em `Masthead`
  (lista estática) e `MobileNav` (com sessão); os links de sessão foram só para
  o segundo, e `/admin` ficou **sem link em qualquer tela ≥ 768 px** por nove
  fases. A rota respondia 200 e a suíte estava verde — o único jeito de achar
  era procurar o link e não encontrar. Hoje a lista é uma só
  (`sessionNavLinks`, em `lib/nav.ts`) e há guarda de paridade.
- **`description` é subtítulo e `content` é corpo — mas o feed não sabe disso.**
  Metade do acervo chega com **a matéria inteira nos dois campos** (G1, Folha,
  Valor, BBC, Trivela) e a outra parte com **a mesma frase única nos dois**
  (TechCrunch). Tratar "corpo igual ao dek" como corpo redundante descartaria
  **5.635 corpos**, o maior deles com 33.073 caracteres. Quem separa é
  `splitDekAndBody` (`providers/news/feed-text.ts`): texto longo repetido vira
  **corpo**, e o dek passa a ser a abertura dele. **Correção de dado se ensaia
  contra produção antes de mergear** — um teste de unidade sobre caso inventado
  passa nas duas versões.
- **O que a IA escreve muda, e a nota que descreve isso envelhece em silêncio.**
  O `article-body` dizia, por escrito e com razão, que o briefing só usava
  `###`. Meses depois: **60% com `**negrito**`, 20% com `---`, 8% com listas, e
  29% misturando `##` com `###`** — tudo aparecendo como caractere na tela.
  Medição sobre saída de modelo tem prazo de validade; ao ler uma dessas notas,
  reconte antes de confiar. O prompt agora fixa um subconjunto fechado, e a
  época dele é `v2` justamente para marcar isso.
- **Ensinar a tela a renderizar um formato conserta o campo que passa por ela,
  e deixa os vizinhos piores por contraste.** A Fase 12 ensinou o corpo do
  briefing a renderizar `**negrito**`. O `title` e o `summary` saem do **mesmo
  documento** e não passam por renderizador nenhum — vão direto para `<h1>`,
  `<meta name="description">`, `og:title`, o JSON-LD, o sitemap do Google
  Notícias, os cards e o assunto do e-mail da newsletter. Medido em 01/09/2026
  nos 88 briefings retidos: **34,1% dos títulos e 21,6% dos subtítulos** com
  marcador na tela, **19,3% dos títulos** abrindo com `**TÍTULO:**` — o nome do
  campo impresso como valor —, e **17,0% dos subtítulos** sendo só
  `Introdução:` ou `---`. **Ao ensinar um campo a entender um formato, liste os
  outros campos que vêm da mesma fonte** e decida um por um: aqui a resposta
  foi renderizar o corpo e **tirar** dos outros dois, porque metadata é texto
  puro por definição. E a correção tem duas pontas de propósito — a gravação
  (`parseMarkdownResponse`) conserta o novo em todo consumidor, inclusive o
  e-mail; a exibição (`lib/markdown-text.ts`) cobre os 90 dias já gravados.
- **Limpar o dek quebra a deduplicação que usa o dek como chave.** O
  `parseArticleBody` tira o parágrafo de abertura do corpo comparando-o com o
  dek exibido. Com o dek limpo e o corpo ainda em Markdown, a comparação para
  de casar e o parágrafo aparece **duas vezes** — o defeito que a limpeza
  deveria evitar, em dobro. Normalizar as duas pontas resolve, e de quebra
  deixa a regra indiferente a de qual lado veio o texto.
- **`revalidate` só significa alguma coisa onde a rota é guardada.** Rota com
  segmento dinâmico e **sem `generateStaticParams`** é marcada `ƒ` no build —
  renderizada a cada requisição —, e o `export const revalidate` do arquivo
  passa a valer só para o cache de dados, nunca para o HTML. Não há erro,
  nem aviso: a tabela do build diz `ƒ` e a linha no topo do arquivo diz 3600.
  Medido em produção: `/news/[id]` em `x-vercel-cache: MISS` nas três
  tentativas, com `private, no-cache, no-store`, enquanto a Home respondia
  `HIT` com `Age: 1491`. `generateStaticParams` devolvendo `[]` é o que liga a
  ISR sem assar nada no build. Guarda em `tests/lib/rendering-mode.test.ts`.
- **`error.tsx` não alcança erro de servidor numa página ISR — a resposta é a
  500 estática do Next, preta e sem estilo, em qualquer navegação.** Medido
  na Fase 7b do plano de observabilidade, três vezes: com a API parada
  (`/news/[id]` produz dois `digest` no log — um do `generateMetadata`, um do
  corpo — e a 500), com um `throw` no corpo por navegação direta (HTTP 500,
  mesma tela) e pela navegação de cliente a partir do acervo (o RSC devolve
  500 e o roteador cai para navegação dura). Render de **geração** que lança é
  "a geração falhou", não "renderize o boundary": o `error.tsx` do segmento só
  entra no erro de render do **cliente**, que não tem `digest`, e o
  `global-error.tsx` é para o layout. Onde o `digest` chega a um humano é nas
  páginas `force-dynamic` (admin, conta, favoritos). O inventário de duas
  sessões dizia que a página "cai no `news/error.tsx`" — era dedução. **Ao
  afirmar que um boundary alcança um erro, provoque o erro e olhe a tela**:
  o `admin:capture` tem `breakBff` para o erro de cliente, e um `throw`
  guardado por variável de ambiente (nunca commitado) serve para o de
  servidor. Dívida com gatilho no §16 do plano; armadilha 41.
- **`redirect()` de server component em rota com `loading.tsx` vira `<meta
  refresh>`, não 307.** O `loading.tsx` do segmento faz o Next despachar a
  casca na hora; quando o `redirect()` resolve, a resposta já começou e não há
  mais como mandar status. A saída dele é
  `<meta http-equiv="refresh" content="1;url=…">` — **um segundo** de espera,
  status 200, e um salto a mais se o alvo não levar prefixo de idioma. É a
  mesma família do soft 404. Quem decide antes de renderizar é o
  `middleware.ts`, e ele pergunta **só se existe cookie de sessão**, nunca se
  ele é válido: validar na borda exigiria o `NEXTAUTH_SECRET` ali, e o modo de
  falha (variável ausente → todo mundo deslogado) é muito pior.
- **Guarda estática que varre fonte não deve varrer fonte com regex — use o
  parser.** É a sexta vez desta família, e a primeira em que "ler melhor o
  texto" não era a saída. A varredura de `console.*` da Fase 1 tratava aspas
  como delimitador de string, para não repetir o erro conhecido de apagar a
  linha a partir do `//` de um `'https://…'`. Só que **a aspa dentro de um
  literal de regex** — `.replace(/"/g, '&quot;')`, que existe em
  `routes/dev/dashboard.ts:23` e em `services/newsletter.service.ts:27` — abria
  uma string que nunca fechava: **481 linhas do `src/` ficavam invisíveis**, e um
  `console.warn` acrescentado ao fim do `dashboard.ts` passava sem uma falha.
  **Distinguir literal de regex de uma divisão exige o token anterior**, que é
  gramática, não caractere. `ts.createSourceFile` já vem com o `typescript` que
  todo pacote daqui tem, e responde exatamente o que a guarda pergunta. Quando a
  pergunta for sobre a **estrutura** do código, o parser é mais curto que o
  regex e não tem esse tipo de buraco; regex continua certo para prosa e para
  YAML.
- **A guarda pode estar certa e não guardar nada, se ninguém liga o que ela
  protege.** As 17 asserções do `secrets-in-logs.test.ts` provam que o
  serializer redige; nenhuma provava que o `buildApp` o **usa**. Trocar
  `logger: baseLogger` por `logger: true` deixava tudo verde e reabria o
  vazamento inteiro. Ao fechar um achado com uma guarda sobre uma função, escreva
  a segunda asserção sobre a **fiação** — e note que `app.log` **não é** a
  instância passada ao Fastify, é um `child({ reqId })` dela: quem atravessa são
  os serializers (`app.log[pino.symbols.serializersSym]`).
- **Guarda estática que varre fonte precisa tirar comentário e declaração de
  tipo antes do regex.** Aconteceu **quatro vezes na Fase 11**, nas duas
  direções: um `201` dentro de prosa contado como declaração de rota; um
  `assertContract` **comentado** contando como asserção presente — a guarda
  passou verde exatamente sobre o defeito que existe para achar; um
  `proxyToApi` citado num JSDoc que dizia *não* usá-lo, reprovando o que estava
  certo; e um literal de vocabulário vivo dentro de um `Extract<...>` numa
  `interface`, contado como emissão. **Só se descobre insistindo em ver a
  guarda falhar** — escreva o teste, quebre o código, confirme a reprovação.
- **Rota fora do layout de idioma não recebe o CSS, e nada acusa.** O Next
  prende o chunk de um `.css` à **entrada que o importa**, e o `_not-found` da
  raiz não passa por `app/[locale]/layout.tsx`. Resultado medido em produção: a
  404 — a página que **todo endereço errado alcança, inclusive com prefixo de
  idioma** — ia ao ar com folha de estilo nenhuma, Times New Roman e link azul.
  Importar o mesmo arquivo nos dois lugares **não resolve**: o Next deduplica e
  o chunk fica onde estava. O `globals.css` mora **só** em `app/layout.tsx`, e
  há guarda em `tests/lib/state-matrix.test.ts`. Corolário: caminho que não casa
  com arquivo de rota **não cai dentro de `[locale]`** — quem renderiza é o
  `not-found` da raiz, não o localizado. **E o `global-error.tsx` é o caso
  que nem o layout raiz alcança**: ele *substitui* o layout raiz, então nem o
  `globals.css` de lá chega, e o `import` repetido nele é deduplicado — a tela
  de crash ia ao ar sem folha de estilo nenhuma, e a guarda que conferia o
  `import` passava. Ele traz o próprio `<style>` com os tokens resolvidos
  (ensaio de aceitação, 25/09/2026). Só se vê em build de produção: em dev o
  Next mostra o overlay no lugar dele.
- **`.catch(() => valor)` numa página confunde "a API disse não" com "a API não
  respondeu", e a ISR fixa a confusão.** A Home dizia "sem notícias hoje" e
  guardava a afirmação por uma hora; as telas de detalhe chamavam `notFound()`
  numa matéria que existe. Use `ApiError` (`lib/api.ts`): `status === null` é
  transporte, `isAboutTheRequest` é 404 **ou 400** — id fora do formato UUID
  devolve 400, e ele também é "não existe". `nullIfNotFound` é obrigatório em
  qualquer `catch` que alimente um `notFound()`, e há guarda.
- **"Build" não é uma coisa só, e confundir os dois reprova o CI.** O build da
  **Vercel** recebe `NEXT_PUBLIC_API_URL` e produz o que vai ao ar — ali, falhar
  quando a API não responde é o certo, porque ela preserva o deploy anterior. O
  build do **CI** roda **sem API de propósito** (`build` não precisa de banco,
  como `lint` e `typecheck`) e só confere que compila. `nullUnlessPublishing`
  (`lib/api.ts`) separa os dois pela variável `VERCEL`, que vale também em
  runtime — é ela que faz a revalidação da ISR manter a última página boa no ar.
  A primeira versão da correção da Home não fazia essa distinção e reprovou com
  `ECONNREFUSED`.
- **`scrollTo({ behavior: 'smooth' })` ignora `prefers-reduced-motion`.** O
  reset do `globals.css` cobre CSS e `scrollIntoView` sem `behavior` explícito —
  `behavior` no JavaScript vence `scroll-behavior: auto !important`. Rolagem
  programática mora em `lib/use-results-focus.ts`, que lê a preferência em tempo
  de execução e leva o foco junto (rolar sem mover o foco deixa viewport e
  cursor em lugares diferentes).
- **`notFound()` em rota com `revalidate` e `not-found.tsx` aninhado responde
  200.** Soft 404: a tela certa aparece, o status mente, e o buscador pode
  indexar. **Não é o middleware** — `/pt-BR/rota-que-nao-existe` passa pela mesma
  reescrita do `next-intl` e responde 404. Só o Next 15 corrige. O que segura o
  estrago é o `noindex` no `generateMetadata` do caminho de falta, e essa linha
  tem guarda.
- **Amostrar "100 por fonte" esconde a cauda longa do acervo.** O pipeline
  ingere a **NewsData.io** além dos 12 feeds RSS, e ela agrega centenas de
  veículos: são **87 fontes** e **95 hosts de imagem** distintos, das quais só 12
  estão em `rss-sources.ts`. Uma lista de hosts derivada das fontes cobria 77,6%
  e teria quebrado **22,4% das imagens** em silêncio (o `SafeImage` degrada sem
  gritar). Ao medir acervo, varra páginas — não filtre por fonte.
- **Medir "o que um run coletou" por `publishedAt` numa janela truncada dá o
  retrato errado, e ele é convincente.** As 400 notícias mais recentes por data
  de publicação diziam que o run da véspera colhera **49 itens de 7 fontes** e
  que a NewsData tinha voltado vazia; varrendo 2.600 e agrupando por
  **`createdAt`**, aquele mesmo run tinha **444 itens de 51 fontes** e a
  NewsData estava lá. O run recente cabe inteiro na janela, o anterior aparece
  só pela cauda — e o que sobra dele é RSS por acaso, então a ausência da
  NewsData vira conclusão. **Os dois campos respondem perguntas diferentes:**
  `publishedAt` é do veículo, `createdAt` é do pipeline, e só o segundo diz o
  que uma execução trouxe. Some a isso que **~39% de toda colheita chega
  carimbada com a data da véspera** — norma da série, nunca sintoma.
- **A varredura de cor crua exigia sufixo numérico**, então `bg-white`,
  `text-black` e os cinzas neutros passavam batido — as classes que somem no
  claro e ficam ilegíveis no escuro. Corrigida, com as quatro ocorrências de
  **véu sobre conteúdo** como exceção declarada.
- **Pacote do workspace importado em *runtime* precisa emitir JavaScript.** O
  `@newranews/types` tinha `"main": "./src/index.ts"` e `build: tsc --noEmit` —
  ou seja, **não emitia nada**. Enquanto a API só importava `type` dele, o import
  sumia na compilação e ninguém percebia. O primeiro import de **valor**
  (`PRODUCT_EVENT_RETENTION_DAYS`, no PR #122) virou `require()` no `dist`, e o
  servidor passou a morrer no boot com `ERR_MODULE_NOT_FOUND`. **`tsc` compila,
  a suíte passa, e nada acusa** — os testes rodam o fonte pelo resolvedor do
  Vitest, e só o Node puro executa o `dist`. Em produção o sintoma não parecia
  com a causa: o Render reprovava o health check, mantinha a build anterior no
  ar, e a rota nova respondia 404 num serviço que respondia 200 em todo o resto.
  A guarda é `apps/api/tests/build/runtime-deps.test.ts`.
- **Serviço no plano free do Render dorme, e `uptime` mente sobre deploy.** Ele
  hiberna com ~15 min sem tráfego; o primeiro `curl` o acorda. Concluir "o
  processo subiu na hora do merge, logo o deploy rodou" a partir do `uptime` é
  erro — o que subiu foi a própria sondagem. Para saber o que está no ar,
  **probe uma rota que só existe na versão nova**. E desde 31/08 ele volta a
  dormir de madrugada, de propósito: ver a armadilha do keep-alive no topo desta
  lista.
- **A metadata do Next não faz merge profundo.** O layout declara
  `openGraph: { type, siteName, locale }` e `twitter: { card }`; a página que
  declara os seus **substitui o objeto inteiro**. Nenhuma página tinha
  `og:type`, `og:site_name`, `og:locale` nem `og:image`, e cinco das sete
  compartilhavam com `twitter:card: summary` — porque as outras duas repetiam
  o valor à mão. O default vive em `pageMetadata` (`lib/seo.ts`); não o
  reescreva na página.
- **Rota de metadata gerada não tem extensão, e o middleware engolia.** O
  matcher exclui o que tem ponto (`sitemap.xml`, `icon.svg`, `robots.txt`);
  `opengraph-image` e `apple-icon` não têm, e viravam 307 para
  `/pt-BR/...` → 404. A imagem de compartilhamento do site e o ícone do iOS
  ficaram **inalcançáveis** desde que existem, e nada no build acusa.
  Rota de metadata nova entra no matcher de `middleware.ts`.
- **`Article.date` é data de calendário, não instante.** Gravada à meia-noite
  UTC, lida no fuso local ela vira a véspera em qualquer fuso negativo — o
  Brasil é um. A URL dizia `/article/2026-08-22` e a página dizia "21 de
  agosto"; e como a Vercel roda em UTC e o navegador não, os dois lados
  renderizavam diferente. `formatArticleDate` lê em UTC; para **instante**
  (`createdAt`, `generatedAt`) use `formatDate`/`formatDateTime`.
- **`cn` e a escala tipográfica.** `tailwind-merge` não distingue tamanho
  nomeado de cor nomeada; sem a configuração de `lib/utils.ts`, uma das duas
  some do HTML sem erro nenhum. Ao acrescentar um nome à escala em `tokens.css`,
  acrescente também em `TYPOGRAPHY_SCALE`. Detalhe em `apps/web/CLAUDE.md`.
- **Bloco sem dado devolve `null`, e o wrapper do grid também sai** — grid vazio
  tem altura zero mas ainda consome o `gap-section` do pai.
- **O nível do heading é decisão da página, nunca do componente nem do texto.**
  Nos cards é prop (`heading-level`); no corpo do briefing, o `###` que a IA
  escreve sai como `h2`, porque o `h1` é o título. Heading fixo já reprovou
  `heading-order` duas vezes neste projeto.
- **Número em controle de filtro tem de prometer o que o próprio clique
  devolve.** A pílula "Todas" da Fase 4 mostrava o total **já filtrado** por
  categoria: lia 594 e abria 2.373. Contagem de faceta ignora a própria
  dimensão; o total do recorte é o `meta.total` da listagem, e só ele.
- **Relógio dentro do render quebra página estática, e quebra em silêncio.** O
  HTML guarda o dia do *build* e o cliente compara com o dia de *agora*; toda
  meia-noite UTC os dois divergem e o React derruba a hidratação (#418/#422).
  Leia o relógio num efeito. Foi o que custou 4 pontos de best-practices em
  `/article`, e o teste que trava isso usa `renderToString`.
- **Duas utilities de mesma especificidade brigando são decididas pela ordem no
  CSS gerado**, que ninguém controla. O par `sr-only` / `focus:not-sr-only` é o
  caso clássico; o skip link usa `top` negativo + `focus:top-4`, onde o
  pseudo-seletor vence por especificidade. Ver `app/[locale]/layout.tsx`.
- **Com schema de resposta declarado, o schema é o contrato — não o `select` do
  serviço.** O `fastify-type-provider-zod` serializa pelo schema: campo que o
  serviço carrega e o schema não declara é buscado e descartado, sem erro. Foi
  assim que a auditoria do briefing e as 15 fontes por artigo ficaram invisíveis
  por um dia, com a `docs/api.md` documentando o comportamento certo.
- **`catch` com valor de fallback mente sobre "vazio" × "não deu" — e um
  `staleTime` torna a mentira permanente.** Prefetch de server component que
  vira `initialData` usa `prefetch` de `lib/api.ts`, que falha em `undefined`.
  Com um objeto vazio no lugar, a `/news` foi ao ar com as oito categorias
  zeradas ao lado de "5.783 notícias" e a query nunca buscou de novo. Onde o
  valor só é renderizado no servidor, `.catch(() => null)` continua certo.
- **O cache de `fetch` do Next (`.next/cache/fetch-cache`) sobrevive entre
  builds e serve dado velho.** Limpar antes de recapturar a baseline depois de
  mexer no seed ou nos dados.
- **O Postgres local foi baselinado com `migrate resolve`**, que marca a
  migration como aplicada sem executar o SQL — por isso falta o índice único de
  `News.sourceUrl` e há títulos duplicados no ambiente local. Não afeta
  produção. Há `pnpm --filter @newranews/database db:cleanup-news-duplicates`.
  O artigo mais recente do banco local também tem **auditoria e 12 fontes
  semeadas à mão** (21/08), para dar de ver a tela de briefing completa — não
  saiu do pipeline, e o resto do acervo local é anterior à migration.
- **`request.ip` do Fastify não é o cliente sem `trustProxy`** — é o peer do
  socket, e atrás do proxy do Render isso é o proxy. Medido em 23/08: três
  requisições com `X-Forwarded-For` diferentes consumiram o **mesmo** balde de
  rate limit. Corrigido com `trustProxy: 1` (e não `true`, que confia na ponta
  esquerda da cadeia, escrita pelo cliente). Guarda em
  `apps/api/tests/security/server-hardening.test.ts`.
- **O `env` da API é lido na carga do módulo, e `process.env` num `beforeAll`
  chega tarde.** O efeito é traiçoeiro: `AUTH_JWT_SECRET` vazio faz
  `verifyAuthJwt` recusar **todo** token por "auth não configurada", então um
  teste que só afirma 401 **passa pelo motivo errado**. Aconteceu com as guardas
  de escopo do `purpose` nesta fase. Em teste que envolve JWT, use
  `vi.mock('../../src/config/env', ...)` — como as suítes de rota já faziam — e
  inclua uma asserção de caminho feliz provando que o harness não é vazio.
  **E o mock parcial tem o defeito espelhado, achado na Fase 1 do plano de
  observabilidade:** a suíte declara só as chaves de que precisa, e o resto do
  código lê `undefined` sem que nada falhe. `NODE_ENV` indefinido fez o logger
  resolver o nível para `info` em duas suítes de provider, que passaram a
  **despejar JSON com stack trace no stdout do CI** com todos os testes verdes.
  Ao ler uma variável de ambiente fora de uma rota, decida o que
  **indefinido** significa — aqui virou lista de permissão: `info` só nos dois
  ambientes reais, `silent` no resto.
- **Validação de schema responde antes da autorização.** A ordem de hooks do
  Fastify é `preValidation` → `validation` → `preHandler`, e o `authPlugin`
  está no `preHandler`: um POST anônimo com corpo inválido numa rota protegida
  devolve **400, não 401**. Não é vazamento sério (a forma do corpo está na
  `docs/api.md`), mas surpreende ao escrever teste de autorização — dê corpo
  válido, senão você mede a validação e acha que mediu a porta.
- **`turbo test` não constrói o `apps/api`, e agora também importa para SQL.**
  A suíte roda sem banco de propósito, então guarda sobre migration tem de ser
  **estática** (lê o `.sql`, não aplica). O replay de verdade é manual —
  `packages/database` + banco limpo + `prisma migrate diff`; foi feito em 23/08
  e o resultado está no item 34.
- **O gate do Lighthouse é real desde 21/08** (`configPath` nos inputs da
  action): a execução semanal de segunda 09:00 UTC falha se alguma categoria
  cair abaixo de 90.

### O que ficou em aberto

- **O teto de ingestão de eventos é um balde só para todos os leitores.** O
  caminho que carrega o tráfego é navegador → BFF do Next → API, e o IP que
  chega na API é o da função da Vercel — o `trustProxy: 1` da Fase 9 consertou
  o caminho direto, este é o outro. Medido: 45 requisições pelo BFF em **12
  segundos** devolveram 10 × 400 e **35 × 429**. O número fica em 30, e não por
  folga: com lote de 20 ele já permite 600 eventos/min, o que alcança as 200 mil
  linhas da dívida da `/metrics/product` em ~5h30 — dobrá-lo não compra
  proteção. **Gatilho:** 429 em `POST /api/events` dentro de
  `GET /api/metrics/http` — **e só passou a ser legível por rota na Fase
  7c**: esta frase dizia "observável sem instrumentação nova" desde a Fase 9,
  e o 4xx por rota era contado e nunca servido (armadilha 39 do plano). Hoje
  é o `clientErrorRate` de cada linha de `routes`, e a coluna "4xx" da
  `/admin/metrics`. O `POST /api/errors/client` (7c) partilha o desenho e o
  gatilho, com balde de 10/min.
- **`NewsletterLog` é a única tabela do produto fora do expurgo.** Uma linha por
  dia, e sem dado pessoal depois da Fase 11 (o corpo de erro do Resend passou a
  ser redigido). **Gatilho:** a primeira coluna de texto livre que voltar a ser
  gravada ali.
- **Os fluxos autenticados do smoke E2E** (conta e admin) ficam pulados até
  `E2E_NEXTAUTH_SECRET`, `E2E_USER_ID`, `E2E_USER_EMAIL` e `E2E_ADMIN_USER_ID`
  existirem como segredos do repositório — e o pulo é impresso pelo workflow.
  Ligá-los põe o `NEXTAUTH_SECRET` de produção no runner do CI, e a decisão é de
  quem é dono do segredo. `apps/web/e2e/support/session.ts` documenta.
- **Trilha nas listagens** (`/news`, `/article`). Marcação de trilha pede
  trilha visível, e ali o segundo degrau seria a própria página — o
  `editorial-nav` já diz onde se está. Se um dia entrar, a lista de
  `BreadcrumbStep` é a mesma que o componente e o JSON-LD consomem.
- **Página na URL em `/article`** — a lista usa `useState`, ao contrário de
  `/news` e, desde a Fase 6, de `/favorites`. Dívida consciente: a ficha escopa a
  tela a ritmo visual, e ler a query string pediria uma fronteira de Suspense que
  a página estática precisa e a de conta não.
- **A categoria gravada acerta ~67%**, teto do classificador por palavra-chave.
  Não bloqueia tela nenhuma — o campo existe e é estável —, mas evita a surpresa
  de ver matéria fora de lugar navegando por categoria. Passar disso pede
  classificação por IA, que é trabalho próprio e ainda não foi feito. O acervo se
  renormaliza sozinho na etapa 8.5 do pipeline diário: não há job manual a
  disparar.
- **A `/api/favorites` resolve os salvos do usuário inteiros antes de paginar.**
  É o que faz o `meta.total` prometer o que a lista mostra. **O gatilho tem
  número desde a Fase 9: ~5.000 salvos numa conta** — aí o `IN` da hidratação
  carrega 5 mil ids para devolver 20 linhas. É observável sem instrumentação
  nova: `GET /api/account` já devolve `saved: { news, articles }`.
- **A `/api/metrics/product` agrega em memória a partir de uma consulta só.**
  **Gatilho: ~200.000 linhas na janela de 90 dias** (≈60 MB de objetos numa
  requisição, num plano de 512 MB), o que a ~4 eventos por pageview são **~550
  pageviews/dia**. Abaixo disso, uma consulta e uma agregação em memória custam
  menos que seis `groupBy`.
- **As métricas de HTTP não são persistidas** (`GET /api/metrics/http`). A
  janela zera a cada deploy e a cada hibernação, e com mais de uma instância
  cada uma responde a sua — por isso a resposta traz `since` e `uptimeSeconds`.
  **Gatilho para persistir:** mais de uma instância no Render, ou a primeira
  pergunta que exija comparar duas semanas.
- **Três advisories da `fastify@4` esperam a major**, que é dívida da Fase 13. A
  única **high** alcançável (bypass de validação por `content-type` com tab)
  está mitigada na porta, com guarda em
  `apps/api/tests/security/content-type-bypass.test.ts`. As outras três de
  `apps/api` têm alcance zero hoje: HTTP/2 que a API não serve, e
  `@fastify/static`, que só a UI do Swagger arrastava — e ela deixou de ser
  registrada em produção.

### Onde ler o resto

- **Histórico fase a fase, com o que cada revisão achou:** `docs/progress.md`,
  itens 11 a 42 — e as fases finais são **34** (backend review), **35**
  (frontend review), **36** (integração) e **38** (refinamento visual e de
  leitura), com a verificação pós-merge da 12 no **39**. É lá que mora o
  detalhe — este bloco é orientação, não changelog.
- **Plano de ação e próximos itens:** `docs/progress.md`, seção "Plano de Ação".
- **Decisões de design da V2:** `docs/v2/` (tokens, sitemap, contratos,
  analytics e slots) e o plano `docs/Newra-News-V2-Frontend-Redesign-Plan.md`.

> Ao concluir qualquer milestone: (1) marcar `[x]` em docs/progress.md com o
> detalhe, (2) atualizar **só o topo** deste bloco. Se ele voltar a virar
> changelog, o detalhe está no arquivo errado.
