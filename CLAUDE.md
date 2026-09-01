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
- `pnpm dev` — rodar todos os apps em dev
- `pnpm build` — build de produção
- `pnpm lint` — ESLint em todo o monorepo
- `pnpm test` — Vitest (backend + frontend). **Não precisa de banco** — assim como `lint`, `typecheck` e `build`
- `pnpm --filter @newranews/web visual:baseline` — capturas das rotas públicas (§30 do plano V2); exige app no ar. Em ambiente com Chromium pré-instalado, exportar `CHROMIUM_PATH`. **O conjunto versionado é capturado de produção**, não do local — ver "Fechar uma fase" abaixo
- `pnpm --filter @newranews/api archive:hygiene` — **mede a higiene de texto do
  acervo contra produção** (§12.D). Varre `/api/news` e conta as seis classes de
  defeito que a Fase 12 zerou; sai 1 se alguma tiver linha, 2 se a API não
  responder. A correção alcança o que já está gravado pela **etapa 8.5**, que
  roda uma vez por dia — então o acervo só converge no dia seguinte ao deploy, e
  é este comando que diz se convergiu
- `pnpm db:migrate` — rodar migrations Prisma
- `pnpm db:generate` — gerar Prisma Client
- `pnpm db:studio` — abrir Prisma Studio

## Fechar uma fase (o ritual, contra produção)

Roda **depois** do merge e do deploy — as duas medições são contra o site no ar,
e cada uma pega o que a outra não pega. Nas Fases 4 e 5 as duas acharam defeito.

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

29 specs contra produção: os fluxos da §25 mais os casos negativos de
autorização. É o passo que pega a classe de defeito que os outros dois não
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
- Discovery da V2 (Fase 0 — tokens, sitemap, contratos, baseline visual): docs/v2/
- **Regras de uso dos tokens da V2 no código: `apps/web/CLAUDE.md`** — tabela papel → classe, o que a suíte proíbe e por quê
- Diagramas: docs/diagrams/

## Status Atual

- **Onde estamos:** V2.0 com as **Fases 0 a 12 concluídas**. A **Fase 13
  (ajustes finos e release final)** é a próxima e pode abrir — ela dependia da
  12, que fechou. §28 do plano.

  > **A numeração mudou em 25/08.** A antiga Fase 12 (release) virou a **13**, e
  > a **12** passou a ser o *refinamento visual e de leitura*. Ela entrou porque
  > as três revisões olharam **camadas** — servidor, navegador, costura — e
  > nenhuma olhou uma tela com dado de produção dentro. §28, "As cinco fases
  > finais".
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
- **Testes:** 1.433 em 128 suites (**815 API em 61** + **618 web em 67** — todos
  passando), mais **29 specs de E2E em 5 arquivos**, que rodam contra produção
  pelo workflow `Smoke E2E` e **não** fazem parte do `pnpm test`. Cobertura
  medida em 31/08: API **98,77% stmts · 92,96% branch · 99,49% funcs**; web
  **72,79% stmts · 89,59% branch · 72,43% funcs** — com piso de 70% no CI desde
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

- **o diagrama ER documenta 3 entidades e o schema tem 12** — faltam as nove da
  V2; os quatro `.mermaid` são de 15/08;
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
- **Os fluxos autenticados do smoke** (6 dos 29 specs) ficam pulados até os
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

**Três dívidas compartilham o mesmo gatilho, e é o Next 15:** as 8 advisories
*high* do `next` (nenhuma alcança esta configuração hoje — a tabela está no item
35), o **soft 404** (`notFound()` em rota com `revalidate` e `not-found.tsx`
aninhado responde **200**; quem segura o estrago é o `noindex` no caminho de
falta, e essa linha tem guarda) e o **meta refresh do `redirect()`** — que é da
mesma família e a 11 cobriu no caso comum, pelo middleware.

**O que a 11 deixou pronto e a 13 pode aproveitar:** o smoke E2E, que passa a ser
parte do ritual de fechar fase; e seis guardas exaustivas novas — resposta de
rota ⇒ contrato de tipo declarado, `fetch` ⇒ prazo declarado, página com
`revalidate` ⇒ jeito de ser guardada, evento do catálogo ⇒ call site, variável do
schema ⇒ linha no blueprint, e o mapa de confiança como teste.

### Armadilhas que já custaram caro

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
  `not-found` da raiz, não o localizado.
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
  proteção. **Gatilho, e é observável sem instrumentação nova:** 429 em
  `POST /api/events` dentro de `GET /api/metrics/http`.
- **`NewsletterLog` é a única tabela do produto fora do expurgo.** Uma linha por
  dia, e sem dado pessoal depois da Fase 11 (o corpo de erro do Resend passou a
  ser redigido). **Gatilho:** a primeira coluna de texto livre que voltar a ser
  gravada ali.
- **Os fluxos autenticados do smoke E2E** (6 dos 29 specs) ficam pulados até
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
