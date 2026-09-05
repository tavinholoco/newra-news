# Plano de Observabilidade e Painel do Admin — Newra News

> **Estado:** base aberta para acréscimo. Nenhuma fase foi implementada.
> **Criado em:** 01/09/2026, depois das Fases 0–12 da V2.
> **Relação com o plano da V2:** este é um plano **à parte**. O
> `Newra-News-V2-Frontend-Redesign-Plan.md` cuida do produto que o leitor vê;
> este cuida do que a equipe vê quando algo dá errado.

---

## §1 Por que este plano existe

O sistema tem 1.474 testes, seis workflows de CI, gate de Lighthouse, smoke E2E
contra produção e seis diagramas guardados contra deriva. E ainda assim, **nas
duas últimas semanas, três incidentes de produção foram descobertos por
acidente**:

| Incidente | Como foi descoberto | Quanto tempo passou |
|---|---|---|
| API suspensa por esgotar 750 h (29/08) | e-mail do Render | 2 dias sem briefing |
| Cron estourou o prazo e o dia ficou sem briefing (01/09) | o briefing ausente na Home | 1 dia |
| Etapa 8.5 segurando o event loop por 45 s (03/09) | alerta de health check do Render | o run do dia travado |

Nenhum deles apareceu num teste, num gate ou numa tela. **A causa comum não é
falta de sinal — é que o sinal não tem para onde ir.**

### O que a inspeção de 01/09/2026 mediu

- **O log não existe como sistema.** `apps/api/src/app.ts:40` passa
  `logger: env.NODE_ENV !== 'test'` — um **booleano**. Sem `level`, sem
  `redact`, sem `serializers`, sem `disableRequestLogging`. São **6** chamadas
  ao logger do Fastify na API inteira contra **14 `console.*`** que o
  contornam, sem `reqId` e sem correlação nenhuma.
- **Há um vazamento de segredo aberto agora.** `apps/api/src/app.ts:134` faz
  `request.log.error({ err, reqId, url }, 'unhandled error')` sem serializer.
  Uma falha de conexão do Prisma carrega a **DSN com senha** para o log do
  Render. A redação que existe (`apps/api/src/utils/redact.ts`) cobre **só
  e-mail**, num **único** call site
  (`apps/api/src/providers/newsletter/resend.provider.ts:60`).
- **O handler global é cego para metade dos erros.**
  `apps/api/src/app.ts:124-141` tem três ramos: um `AppError` de qualquer
  status — **inclusive um 500 lançado de propósito** — é devolvido e não
  logado. Só 500 não-`AppError` produz linha.
- **O admin não enxerga o pipeline.** `PipelineLog`, `PipelineEvent`, mensagem
  de erro e etapa da falha existem no banco e estão expostos — mas atrás do
  `JOB_SECRET`, no `/dev/dashboard`. De uma sessão ADMIN chegam só agregados de
  `DailyMetric`: três inteiros (`pipelineErrors`, `pipelineSuccessRate`,
  `failureDays`) sem hora e sem mensagem.
- **O frontend não reporta erro nenhum.** Os quatro `error.tsx` declaram
  `error: Error & { digest?: string }` e **nunca desestruturam** — o `digest`,
  única chave que liga o erro do navegador ao stack do servidor, é descartado.
  Não há `global-error.tsx`. Todo `catch` do BFF é vazio.
- **Três conjuntos de dados órfãos:** `GET /api/metrics/http` é ADMIN-guarded e
  não tem BFF nem tela; `newsApiCount`/`rssCount`/`cleanupCount` são gravados
  pela etapa 9 e descartados na serialização porque o
  `dashboardMetricsSchema` não os declara; `ProductMetrics.byDay` volta da API
  e não é renderizado.

### A peça forte, sobre a qual tudo se apoia

O **`x-request-id` ponta a ponta já existe e funciona**:
`apps/api/src/app.ts:63` aceita o cabeçalho de entrada ou gera um UUID,
`apps/api/src/plugins/observability.ts:181` devolve em toda resposta, e
`apps/web/lib/api-proxy.ts:133` ecoa de volta ao navegador. Este plano
**constrói sobre ele** e não o substitui.

---

## §2 Princípios

Cinco, e cada um sai de uma armadilha que já custou caro.

1. **Observabilidade nunca quebra o caminho que observa.** É o contrato que
   `logPipelineEvent` já cumpre (`pipeline-event.service.ts:146-171`): o
   `try/catch` é interno, a função sempre resolve.
2. **Nada de varredura síncrona.** O incidente de 03/09 foi um `for` sobre
   8.190 linhas segurando o event loop por 45 s, com 0.1 vCPU. Toda checagem
   nova é consulta agregada, e quem itera cede o controle
   (`yieldToEventLoop`, em `news-renormalizer.service.ts:174`).
3. **Toda contagem que descreve uma coleção sai derivada da coleção.** Foi a
   lição do `13` que sobreviveu em oito arquivos depois que a Reuters saiu da
   lista.
4. **Todo custo novo é medido contra o teto do plano free antes de entrar.**
   750 h/mês com 0,8% de folga; 512 MB; 0.1 vCPU.
5. **Toda guarda é quebrada de propósito antes de ser considerada pronta.** A
   Fase 11 teve quatro guardas que passavam verde sobre o defeito que existiam
   para achar.

### As dez fases, e a ordem

Cada uma é mergeável sozinha e deixa o sistema melhor. **Três trilhas
independentes**, que não se bloqueiam:

| # | Fase | § | Trilha | Toca schema? | Depende de |
|---|---|---|---|---|---|
| 1 | Um logger, um redator, fim dos `console.*` | §5 | substrato | não | — |
| 2 | Pipeline visível ao ADMIN | §6 | painel | não | — |
| 3 | Taxonomia de erro | §7 | substrato | não | 1 |
| 4 | `ErrorEvent` | §8 | substrato | **sim** | 1, 3 |
| 5 | As telas: Métricas e Segurança | §9 | painel | não | 2, 4 |
| 6 | Invariantes | §10 | qualidade | não | 4, 5 |
| 7 | Erro do cliente | §11 | cliente | não | 1 (7a) · 4 (7c) |
| 8 | O log de sucesso | §12 | qualidade | não | 2 |
| 9 | Os dois portões da IA | §13 | qualidade | não | 1, **4** |
| 10 | Segurança do CI/CD | §14 | esteira | não | — |
| 11 | Saúde por fonte | §15 | qualidade | **sim** | 5 |

**Ordem recomendada de merge: 1, 2, 7a, 10** — as quatro de maior razão
valor/risco, nenhuma toca schema, e a **10 pode ir a qualquer momento** porque
não depende de nada neste plano.

Depois: **3 → 4 → 5**, que é a espinha, e a partir daí **6, 8, 9 e 11**.

**Duas fases pedem cautela extra, por razões diferentes:**

- **A 9 é a única que pode impedir um briefing de ser publicado.** É a única
  que muda o comportamento do produto em produção, e a única cuja calibração
  errada tira conteúdo do ar. O §13 traz o comportamento de partida e os dois
  caminhos de degradação exatamente por isso.
- **A 4 e a 11 são as duas que tocam schema**, e portanto as duas que não são
  revertidas por um `git revert` sozinho. Migration primeiro, código depois, em
  PRs separados.

> **A dependência da 9 na 4 foi corrigida na auditoria de 04/09.** A tabela
> dizia "1", mas o §13.3 emite `recordError`, que nasce na Fase 4. Sem ela, a
> decisão de cada portão não teria onde ser registrada — e um portão que
> bloqueia sem deixar rastro é pior que nenhum portão.

---

## §3 O que a pesquisa mandou incluir

Esta seção existe porque pensar de cabeça perde ponto. As fontes estão no §21.

### §3.1 Os quatro sinais de ouro — e o que falta

O padrão do Google SRE diz que, se você só puder medir quatro coisas de um
sistema que atende gente, meça **latência, tráfego, erro e saturação**. O
método RED (Grafana) e o USE (Brendan Gregg) são recortes do mesmo espaço.

| Sinal | Newra tem? | Onde |
|---|---|---|
| Latência | **Sim** | `GET /api/metrics/http` — p50/p95/p99/max por rota |
| Tráfego | **Sim** | mesmo endpoint — `totalRequests` e contagem por rota |
| Erro | **Sim** | mesmo endpoint — `errorRate` e `clientErrorRate` |
| **Saturação** | **Não. Nada.** | — |

**Saturação é o sinal que faltava nos três incidentes**, e é o achado mais
forte da pesquisa. Para este projeto ela tem três medidas concretas:

- **Horas de instância consumidas no mês / 750.** O teto que suspendeu a API em
  29/08 é literalmente uma métrica de saturação que ninguém observava. Derivável
  do `uptime` do processo mais a data de reset do plano.
- **Memória residente / 512 MB.** O gatilho documentado da
  `/api/metrics/product` (~200 mil linhas ≈ 60 MB) é uma previsão de saturação
  que hoje não tem termômetro.
- **Atraso do event loop.** `perf_hooks.monitorEventLoopDelay` custa quase nada
  e teria acusado os 45 s de 03/09 **antes** do `SIGTERM` — o health check de
  5 s falhou porque o loop estava parado, e a métrica que descreve isso é
  exatamente esta.

E os três primeiros sinais já existem, medidos e ADMIN-guarded, **sem tela
nenhuma**. Antes de instrumentar coisa nova, ligar o que já está pronto.

### §3.2 Eventos de segurança — o vocabulário do OWASP

O OWASP mantém um vocabulário padronizado de eventos de segurança, e a A09 do
Top 10 (2021 "Logging and Monitoring Failures", 2025 "Logging and **Alerting**
Failures") é sobre exatamente o buraco deste projeto. A mudança de nome entre
as duas edições é o recado: **logar sem alertar não conta**.

Mapeando o vocabulário no que o Newra consegue emitir:

| Evento OWASP | Onde nasce no Newra | Valor |
|---|---|---|
| `authz_fail` | `requireAdmin` lançando `ForbiddenError` (`plugins/auth.ts:100-104`) | **Alto.** Hoje é devolvido e não logado |
| `authn_token_reuse` | o check simétrico de `purpose` em `plugins/auth.ts:68-73` | **O mais alto.** Um `auth-upsert` usado em outra rota é replay deliberado, nunca acidente |
| `authz_admin` | `POST /api/admin/run-pipeline`, `DELETE /api/news/:id` | **Alto.** Hoje uma notícia apagada não deixa rastro de quem apagou |
| `excess_rate_limit_exceeded` | 429 do `@fastify/rate-limit` | **Alto.** Já é gatilho documentado (429 em `POST /api/events`) |
| `malicious_excess_404` | o `setNotFoundHandler` da Fase 3 | **Médio.** É como se vê um scanner varrendo |
| `malicious_csp_violation` | há CSP nos **dois** apps e **nenhum `report-uri`** | **Médio e barato.** Pega XSS tentado e extensão hostil |
| `session_use_after_expire` | JWT expirado em `verifyAuthJwt` | Médio |
| `sys_startup` / `sys_crash` | `server.ts` (SIGTERM) e o último-recurso do pipeline | **Alto.** Reinício de instância é o sinal que passou batido em 03/09 |
| `authn_login_success` / `_fail` | callbacks do NextAuth e `POST /api/auth/upsert` | Médio — ver a ressalva abaixo |
| `authz_change` | `roleForEmail()` gravando `role` a cada sign-in | Médio. Mudança de papel merece evento |
| `input_validation_fail` | 400 do Zod | Baixo por unidade, **alto em agregado** |

**O que NÃO se aplica, e é importante escrever para ninguém construir:** troca e
reset de senha (o login é só OAuth — não há senha nossa a atacar), upload de
arquivo (não existe), *impossible travel* e geolocalização (exigiria reter IP
por usuário), e honeytokens (desproporcional).

### O IP: a pergunta é mais estreita do que parece, e a resposta foi medida

O OWASP quer `source_ip` em todo evento de segurança. Antes de decidir se
guardamos, é preciso saber **se ele chega** — e neste projeto, na maior parte
dos casos, **não chega.**

O caminho do tráfego autenticado é `navegador → função da Vercel (BFF) → API no
Render`, e o `api-proxy.ts` monta os cabeçalhos de saída à mão: encaminha
`Authorization`, `x-request-id` e `Content-Type`, e **não** encaminha
`x-forwarded-for`. Então:

| Caminho | Rotas | O que `request.ip` vale na API |
|---|---|---|
| Direto do navegador | `/api/news`, `/api/news/facets`, `/api/articles` | **o IP do leitor** — o `trustProxy: 1` da Fase 9 lê o `X-Forwarded-For` do proxy do Render |
| Pelo BFF | `/api/account`, `/api/admin/*`, `/api/favorites`, `/api/events` | **o IP da função da Vercel** |

**O IP é real exatamente onde menos importa e ausente exatamente onde mais
importa.** Um `authz_fail` numa rota de admin — o evento de maior valor da
§3.2 — registraria o IP da Vercel para todo mundo, atacante incluído. É a mesma
raiz do teto de ingestão compartilhado que o `CLAUDE.md` já documenta, medido em
45 requisições pelo BFF consumindo um balde só.

Isso reordena a decisão. Não é "guardar IP ou não"; são **três** decisões, e a
primeira é de código:

1. **O BFF passa a encaminhar o IP de origem?** É uma linha em `api-proxy.ts`.
   Sem ela, IP em evento de rota autenticada é ruído com aparência de dado — o
   pior tipo de campo, porque parece que a pergunta foi respondida.
2. **Se passar, guarda-se o quê?** A recomendação deste plano é **hash truncado
   com sal que roda por dia**: permite contar "quantas falhas vieram da mesma
   origem hoje" e perde a capacidade de ligar duas origens entre dias — que é
   exatamente o que o produto promete ao chamar seu analytics de anônimo por
   construção.
3. **Retenção própria**, mais curta que a do `ErrorEvent`.

### A decisão: não encaminhar, não guardar

> **Decidido em 05/09/2026.** Não há campo de IP neste plano, e o
> `api-proxy.ts` não muda. O argumento abaixo é o registro do porquê — se
> alguém propuser acrescentar IP mais tarde, é aqui que estão os três fatos que
> precisam ter deixado de valer.

Três leituras do código, e elas fecham a questão:

**1. Onde o IP falta, já existe identificador melhor.** Os dois eventos de maior
valor da §3.2 são `authz_fail` (rota de admin negada) e `authn_token_reuse`
(`purpose` trocado). Os dois exigem **um JWT válido** — quem os dispara está
logado, e o token carrega `sub` e `email`. O IP não acrescentaria nada a uma
identidade que já é nominal.

**2. A tentativa anônima nem chega à API.** O `proxyToApi` chama
`getServerSession` primeiro e devolve **401 sem chamar a API**; o 403 de papel
errado sai no passo seguinte, também antes. Um atacante sem sessão martelando
`/api/admin/metrics` produz **zero** requisições no Render. Não é que a API veja
o IP errado: ela não vê requisição nenhuma.

**3. Onde há anônimo de verdade, o IP já funciona.** As rotas que o navegador
chama direto — `/api/news`, `/api/articles`, as facetas — chegam com
`X-Forwarded-For` e o `trustProxy: 1` lê certo. É lá que mora o rate limit, e
ele já usa esse IP.

Portanto: **não mexer no `api-proxy.ts` e não criar campo de IP.** Os eventos de
segurança agrupam por `userId` quando autenticados e por `request.ip` quando
públicos, que é o dado que já existe em cada caso.

**E a lacuna que sobra tem dono, e é a Fase 7a.** A tentativa anônima contra
rota autenticada é invisível para a API **e é exatamente onde o IP seria útil**.
Ela acontece dentro da função da Vercel, que **recebe** o IP do cliente no
`x-forwarded-for` — só não o repassa. Então quem registra esse evento é o
`logServerError` da §11.1, no lugar onde o dado está, sem contrato novo entre os
dois apps e sem coluna nova no banco.

> **Confirmar em produção antes de escrever a linha:** que a função da Vercel de
> fato recebe `x-forwarded-for`. É o comportamento documentado da plataforma,
> mas este projeto tem o hábito de sondar antes de concluir — foi o que separou
> "a API está dormindo" de "a API foi suspensa".

O que se perde: detectar um atacante distribuído e anônimo contra rota
autenticada. Pelo item 2, essa classe não existe do lado da API. O que se
mantém: detectar **conta comprometida**, que num produto com login social e sem
senha nossa é o vetor provável.

### §3.3 Qualidade de dado — o eixo das inconsistências

A literatura de *data observability* trabalha com seis dimensões, e todas as
seis têm tradução direta aqui:

| Dimensão | Pergunta | Medida no Newra |
|---|---|---|
| **Frescor** | O dado é de agora? | Horas desde o último briefing; horas desde a última ingestão |
| **Completude** | Os campos que importam estão preenchidos? | % de `News` com imagem, com corpo, com categoria; % de `Article` com `BriefingSource` |
| **Validade** | O conteúdo respeita a regra? | As seis classes de defeito que o `archive:hygiene` já conta |
| **Unicidade** | Há duplicata? | `sourceUrl` repetido (o banco local tem esse problema hoje) |
| **Consistência** | A distribuição mudou de forma? | Deriva na distribuição de categoria — o classificador acerta ~67%, e um salto súbito significa que um feed mudou de formato |
| **Volume** | A quantidade é a esperada? | Itens colhidos por dia contra a mediana móvel |

E duas métricas de resposta a incidente que a literatura chama de MTTD e MTTR.
Para este projeto elas têm uma versão honesta e desconfortável: **tempo entre a
falha acontecer e alguém poder vê-la numa tela**. Hoje esse número é
indefinido, porque não existe a tela. Ele passa a ser mensurável na Fase 5.

### §3.4 O que a pesquisa disse e este plano recusa

- **Alerta por e-mail/webhook.** A A09 de 2025 insiste em alerta, e está certa.
  Mas alerta sem *playbook* vira fadiga, e fadiga faz o alerta importante sumir
  no meio dos outros — a própria A09 diz isso. Entra como **§20**, depois de a
  tela existir e de sabermos qual sinal de fato dispara. Alertar antes de medir
  é como o keep-alive: mecanismo antes da conta.
- **Retenção longa de log.** O Render free não guarda log entre deploys, e
  agregador externo é custo. A retenção deste plano é **14 dias em Postgres**,
  coalescida — e o §16 diz qual número muda essa decisão.
- **Integridade de log (append-only, assinatura).** A A09 pede. É
  desproporcional para um projeto de portfólio de um dono só; fica registrado
  como recusa consciente, não como esquecimento.

---

## §4 A forma do painel

### §4.1 As abas

Hoje são **duas** (`/admin` e `/admin/metrics`). Passam a ser **três**:

| Aba | Rota | O que responde |
|---|---|---|
| **Visão geral** | `/admin` | "Está tudo de pé agora?" — a linha de KPI, o disparo do pipeline e as ações |
| **Métricas** | `/admin/metrics` | "Como o produto vai?" — audiência, leitura, ingestão, os quatro sinais |
| **Logs e segurança** | `/admin/security` | "O que quebrou e quem tentou o quê?" — erros, eventos de segurança, invariantes, auditoria |

O pedido era duas abas novas; a de **visão geral** é a que já existe e continua
sendo a primeira coisa que se abre — daí três.

**Uma quarta aba tem gatilho, não opinião:** quando a `/admin/security` passar
de ~6 painéis ou precisar de dois seletores de janela independentes, ela se
parte em **Logs** e **Segurança**. Antes disso, partir é inventar navegação
para conteúdo que não existe.

**A referência do Behance usa barra lateral, e este plano mantém a faixa de
abas.** A barra lateral de lá carrega oito destinos em três grupos; nós temos
três. Faixa de abas é o que já existe (`components/admin/admin-nav.tsx`), o que
o `account-nav.tsx` espelha, e o que a suíte já guarda. Copiar a barra lateral
seria copiar a solução de um problema que não temos.

### §4.2 O que tirar da referência

Cinco coisas, e o motivo de cada uma:

1. **Linha de KPI com variação.** Ícone, rótulo curto, número grande, e um chip
   de variação com seta e período (`+12,5% vs. semana passada`). O `MetricCard`
   de hoje (`components/dashboard/metric-card.tsx`) tem rótulo, valor e dica —
   falta a variação, que é o que transforma um número em notícia. **É a
   melhoria de maior alcance da referência**, porque `45.6k` sozinho não diz
   nada e `45.6k, +12,5%` diz.
2. **Seletor de período por painel.** Na referência cada cartão tem o seu
   (`Weekly`). Hoje isso existe solto dentro do
   `product-metrics-client.tsx:59-76`; vira componente compartilhado.
3. **Um acento, usado com avareza.** A referência é cinza e branca com laranja
   em **um** elemento por painel — a barra que importa. A marca do Newra já é
   laranja (`--brand-accent`, `--link`), então o mapeamento é direto, e a regra
   fica escrita: **laranja marca o que precisa de atenção; o resto é neutro.**
   Um painel onde tudo é laranja não destaca nada.
4. **Tabela com severidade e ordenação.** A `User Risk Assessment` da
   referência — busca, dois filtros, colunas ordenáveis, nível de risco por
   linha. É exatamente a forma da tabela de eventos de segurança.
5. **Densidade.** Fundo neutro, cartão branco, muito respiro, rótulo pequeno e
   número grande. O painel de hoje já vai nessa direção; a referência é mais
   disciplinada com espaço vertical.

**O que não se leva:** a barra lateral (§4.1), o gráfico de bolhas
sobrepostas — bolha sobreposta sugere interseção entre conjuntos, e
"Mobile/Desktop/Tablet" são exclusivos, então ali a forma mente sobre o dado —
e a paleta de cinco cores saturadas lado a lado, que não passa em contraste no
tema escuro.

### §4.3 Rosquinhas: onde ajudam, onde mentem

Rosquinha responde **"que parte do todo?"**. Ela é boa com 2 a 6 fatias e
péssima com série temporal ou com comparação de grandezas independentes.

Os cinco lugares onde ela é a forma certa aqui:

| Painel | Fatias | Aba | Por que rosquinha |
|---|---|---|---|
| Notícias por categoria | 8 | Métricas | Parte de um todo fechado. **Nota:** 8 é o limite; agrupar a cauda em "Outras" se ficar ilegível |
| Provider de IA | 2 (Gemini/Groq) | Métricas | Duas fatias, e o buraco do meio carrega o número. Torna visível o gatilho documentado dos "três dias seguidos de fallback" |
| Ingestão por fonte | 2 (NewsData/RSS) | Métricas | Usa `newsApiCount`/`rssCount`, hoje descartados na serialização |
| Erros por categoria | 6 (`upstream`, `database`, `validation`, `authorization`, `contract`, `internal`) | Segurança | Diz de onde vem a dor sem ler uma linha de log |
| **Saturação do plano** | arco único | Visão geral | Horas consumidas / 750. É o medidor que faltava em 29/08 |

O último é o mais importante do plano inteiro em relação custo/benefício: um
arco, um número, e o incidente que suspendeu a API por dois dias vira algo que
se vê chegando.

**Onde a rosquinha estaria errada, e o plano diz não:** evolução no tempo
(`byDay` é série — barra ordenada por data, e é para isso que entra o
`series-bars.tsx`), e comparação de rotas por latência (grandezas
independentes, não partes de um todo).

**Como desenhar, dentro das regras deste repositório.** Não há biblioteca de
gráfico e não entra nenhuma: a CSP e o orçamento de bundle não pagam. Rosquinha
é **SVG inline** com `stroke-dasharray` num `<circle>`, no mesmo padrão do
`components/dashboard/category-bars.tsx`:

- cores de `--chart-1` a `--chart-5`, reusando o `BAR_COLORS` que já existe;
- `role='img'` com `aria-label` completo no `<svg>`, como o `CategoryBars` já
  faz;
- **legenda com valor e porcentagem ao lado de cada fatia** — cor sozinha não
  codifica informação, e o gate de acessibilidade do Lighthouse está em 90;
- estado vazio próprio (o `CategoryBars` já tem um, reusar a mensagem);
- caso de fatia única em 100% tratado à mão — `stroke-dasharray` com o arco
  inteiro não desenha nada em alguns navegadores;
- sem animação de entrada, ou respeitando `prefers-reduced-motion` — o reset do
  `globals.css` cobre CSS, e há armadilha registrada sobre isso.

---

## §5 Fase 1 — Um logger, um redator, e o fim dos `console.*` ✅ 2026-09-05

**Fecha:** a DSN com senha no log do Render, e o ruído que torna a linha certa
inencontrável.

### Arquivos

| Ação | Caminho |
|---|---|
| criar | `apps/api/src/utils/logger.ts` |
| modificar | `apps/api/src/utils/redact.ts` — ganha `redactSecrets` |
| modificar | `apps/api/src/config/env.ts` — `LOG_LEVEL` |
| modificar | `render.yaml`, `apps/api/.env.example` |
| modificar | `apps/api/package.json` — `pino` vira dependência direta, fixada na versão que o Fastify já resolve |
| modificar | `apps/api/src/app.ts:39-69` — a chamada `Fastify({...})` |
| modificar | `apps/api/src/plugins/observability.ts` — o hook `onResponse` passa a escrever a linha |
| modificar | os 14 call sites de `console.*` |
| modificar | `packages/eslint-config/node.js` |

### As decisões que sustentam a fase

**Uma instância de pino, duas portas de entrada.** `logger.ts` exporta
`baseLogger`; o `buildApp` passa **a instância** para o Fastify (que aceita
instância, não só opções), e os services importam `baseLogger` direto.

**Correlação sem alterar assinatura.** Um `AsyncLocalStorage<{ pipelineLogId }>`
lido pelo `mixin` do pino. **O `reqId` não entrou no store, e é decisão da
implementação:** quem tem requisição já escreve por `request.log`, cujo child
logger carrega o `reqId` que o `genReqId` do `buildApp` gerou — um segundo lugar
guardando o mesmo fato é um segundo lugar para ele divergir. O `runPipeline` embrulha o corpo em
`pipelineContext.run({ pipelineLogId }, ...)` e, a partir daí, os cinco avisos
do `news-fetcher.service.ts`, os dois do `rss.provider.ts`, os dois do
`newsdata.provider.ts` e o retry do `ai-utils.ts` passam a carregar o
`pipelineLogId` **sem que nenhuma função mude de assinatura**. A alternativa —
passar `request.log` por cinco camadas — é o que faz correlação virar intenção
em vez de fato.

**Configuração, e o que fica de fora:**

```
{ level: env.LOG_LEVEL,
  redact: { paths: ['req.headers.authorization', 'req.headers.cookie',
                    'res.headers["set-cookie"]', '*.password', '*.token', '*.secret'],
            censor: '[redigido]' },
  serializers: { err: redactingErrSerializer },
  disableRequestLogging: true }
```

- **Sem `transport`, em nenhum ambiente.** `pino-pretty` em produção é um
  segundo processo em 0.1 vCPU; em dev é modo de falha no boot por ganho
  cosmético. Quem quiser, `pnpm dev | npx pino-pretty`.
- **`disableRequestLogging: true`, e a linha que substitui é uma só.** Hoje o
  log padrão escreve duas linhas por requisição, incluindo cada sonda do
  `/api/health`. O `plugins/observability.ts` já tem o hook `onResponse` e já
  calcula rota, status e `elapsedTime` — falta só escrever.

**A redação, que é o conserto do vazamento.** O `redact` do pino trabalha por
**caminho**, e a DSN do Prisma vem dentro de `err.message`, que não é caminho.
Por isso o conserto é o **serializer de `err`**, e ele faz quatro coisas:

1. `redactEmails` — reusar, não escrever um segundo.
2. `redactSecrets` — irmão novo no mesmo arquivo. Mascara
   `postgres(ql)://user:senha@host`, `Bearer <token>`, e — a parte mais forte —
   **o valor literal de cada segredo conhecido do ambiente** (`DATABASE_URL`,
   `JOB_SECRET`, `AUTH_JWT_SECRET`, `GEMINI_API_KEY`, `GROQ_API_KEY`,
   `RESEND_API_KEY`, `NEWSDATA_API_KEY`). Não precisa adivinhar o **formato**
   de um segredo: ele conhece os valores. É o que torna a guarda total em vez
   de corrida armamentista de regex.
3. Truncar `message` em 500 caracteres e `stack` em 10 quadros.
4. Preservar `name`, `code`, `statusCode` — o diagnóstico tem de sobreviver, o
   mesmo argumento que o `redact.ts` já faz sobre o 422 do Resend.

**`apps/api/src/config/env.ts:51` continua `console.error`**, com o motivo
escrito ao lado da exceção do ESLint: roda na carga do módulo, antes de o
logger existir, e é seguido de `process.exit(1)`.

### Guarda

`apps/api/tests/security/secrets-in-logs.test.ts`, irmão do
`pii-in-logs.test.ts` que já existe:

- alimenta o serializer real com três erros sintéticos — um com
  `postgresql://user:senha@ep-x.neon.tech/db` na mensagem, um com
  `Bearer <JOB_SECRET>`, um com endereço de e-mail. Afirma que nenhum
  sobrevive **e que o diagnóstico sobrevive** (`expect(out.message).toContain('P1001')`);
- metade estática: nenhum `console.` em `apps/api/src` fora de um mapa de
  exceções com motivo escrito;
- uma asserção de caminho feliz, para o harness não poder estar vazio.

O `LOG_LEVEL` no `render.yaml` cai de graça no `env-parity.test.ts` que já
existe — **se você esquecer a linha do blueprint, o CI reprova, e é esse o
ponto.**

---

## §6 Fase 2 — O pipeline, visível para uma sessão ADMIN

**Fecha:** o dono do produto não consegue ver, de nenhuma superfície em que
consiga entrar, que o run de ontem falhou na etapa 6, o que o erro dizia, ou
que ele falha há três dias.

Entrega **zero tabela nova e zero consulta nova** — `getDevLogs()`
(`pipeline-event.service.ts:171-208`) e `getDevLogDetail()` (`:211-235`) são
reusados verbatim. O que muda é a porta.

### §6.1 API

Rotas: `GET /api/admin/pipeline/runs` (filtros `status`, `since`, `limit`,
reusando o `devLogsQuerySchema`) e `GET /api/admin/pipeline/runs/:pipelineId`.

**Por que um prefixo `/api/admin` novo e não uma rota em `/api/metrics`.** O
`authPlugin` e o `requireAdmin` registram uma vez no grupo, o que faz de "tudo
sob `/api/admin` é ADMIN" uma garantia **estrutural** em vez de hábito por
rota — o mesmo argumento que o `admin/layout.tsx` faz do lado do web. E faz o
caminho do BFF e o da API finalmente terem o mesmo nome.

**O `/api/dev/*` e o `/dev/dashboard` ficam intactos.** Acesso por segredo é o
caminho que funciona quando não há sessão, e isso importa mais justamente
quando o que quebrou é o provedor de sessão.

**A exceção que precisa cair.** O `shared-type-contract.test.ts:55-56` isenta
`devLogsResponseSchema` e `devLogDetailResponseSchema` com o motivo
`'painel dev, fora do produto'`. **No instante em que uma tela do produto lê
aquele shape, o motivo deixa de ser verdade.** Os tipos entram em
`packages/types`, o `assertContract` entra ao lado dos schemas, e as duas
linhas de exceção saem. A guarda está dizendo o que fazer; é só ouvir.

### §6.2 Web

Painéis, em ordem de valor: (1) o último run, como cartões — status, etapa,
duração, mensagem do erro; (2) os últimos 20 runs, como lista com pílula de
status; (3) o detalhe de um run — os ~19 `PipelineEvent` agrupados por etapa,
coloridos por nível, com o `context` atrás de um `<details>`.

**Os painéis entram na `/admin`, sem rota nova.** A primeira versão desta fase
criava `/admin/pipeline` — e isso **contradizia o §4.1**, que declara três abas
e não lista essa. A auditoria de 04/09 resolveu para o lado mais barato: a
`/admin` já existe, já é a aba "está tudo de pé agora?", e o histórico de runs é
exatamente essa pergunta. Sem rota nova significa **sem linha na matriz de
estados, sem chave de rota nos dois arquivos de mensagem e sem `alternatesFor`**
— o `toHaveLength(15)` fica em 15 nesta fase, e só a Fase 5 o move para 16 ao
criar a `/admin/security`.

O **detalhe de um run** é linha expansível, não rota própria. Rota `/[id]`
pediria `loading.tsx`, `error.tsx`, `not-found.tsx` e uma linha na matriz para
uma tela que só um admin abre — e a matriz de estados cobraria os três.

### Guarda

Asserção nova dentro do `authorization-matrix.test.ts`:

> `it('toda rota registrada sob /api/admin é admin-only')` — enumera o
> `printRoutes()`, filtra o prefixo, e afirma `access: 'admin'` na `MATRIX`.

Isso converte o prefixo de convenção em garantia, e é o gêmeo, do lado da API,
do que o `admin/layout.tsx` faz do lado do web.

---

## §7 Fase 3 — A taxonomia de erro

**Fecha:** um `throw new AppError('...', 500)` — a forma como um service diz
"não consegui" — devolve 500 ao cliente e escreve **zero linhas**. Não há como
saber que aconteceu.

`AppError` ganha `code`, `category`, `cause?` e `context?`. A categoria é um
conjunto fechado pequeno, porque política de retry e de alerta se apoia nela e
o fingerprint da Fase 4 se apoia no `code`:

```
category: 'upstream' | 'database' | 'validation' | 'authorization' | 'contract' | 'internal'
```

**A regra que faz o desenho inteiro funcionar: `code` é literal do tuple e
nunca é interpolado.** Cardinalidade de `code` sem teto é cardinalidade de
fingerprint sem teto, que é tabela sem teto na Fase 4. A regra fica escrita ao
lado do tuple e a guarda a cobra.

O handler global passa a ter quatro ramos: `AppError` ≥ 500 é **logado**
(o buraco de hoje); `AppError` < 500 vai a `debug`, exceto
`category: 'authorization'` que vai a `warn` — um 404 em `/news/:id` é
resultado normal e afogaria o sinal, um `ForbiddenError` em rota de admin vale
linha. Entra também um **`setNotFoundHandler`**: hoje um caminho não registrado
cai no padrão do Fastify e o `observability.ts` arquiva como rota `unmatched`.

**O contrato do fio não muda, de propósito.** `errorResponseSchema` continua
`{ error }`. Pôr `code` no corpo poria um campo em `ApiError` que nenhuma tela
lê. **Gatilho para reverter:** a primeira tela que precise ramificar por qual
falha foi.

---

## §8 Fase 4 — `ErrorEvent`

**Fecha:** o único registro durável de uma falha de API é uma linha do Render
que rola para fora; nada sobrevive a um deploy e nada é consultável.

### O modelo

Uma linha por **`(fingerprint, hora)`**, não por ocorrência. Um 500 que dispara
10.000 vezes numa hora é **uma** linha com `count: 10000`. A quantidade de
linhas fica limitada por *falhas distintas × 24*, nunca por tráfego.

O custo vai escrito no comentário do modelo, honestamente: **não dá para
reconstruir a ocorrência individual.** O que se guarda é `count`,
`firstRequestId` e `lastRequestId` — as duas chaves que acham a linha de log
nas duas pontas da janela — e um `context` amostrado.

Campos: `fingerprint`, `windowStart` (hora cheia UTC), `origin`
(`API|PIPELINE|WEB|INVARIANT`), `severity` (`WARN|ERROR|FATAL`), `code`,
`category`, `count`, `route` (padrão da rota, **nunca** a URL crua),
`statusCode`, `message` (já redigida e truncada), `firstRequestId`,
`lastRequestId`, `pipelineLogId`, `context`, `firstSeenAt`, `lastSeenAt`.
Índice único em `(fingerprint, windowStart)`, mais `windowStart`,
`(origin, windowStart)`, `(severity, windowStart)`.

A mesma migration acrescenta os dois índices que o **`PipelineLog` nunca
teve** — verificado: zero `@@index` no modelo, apesar de `getDevLogs` ordenar
por `startedAt desc` e a etapa 8 apagar por `startedAt`.

### As decisões que o mantêm dentro do plano free

- **Sem FK para `PipelineLog`, e o motivo não é o que parecia.** A primeira
  versão desta linha dizia que a cascata apagaria o `ErrorEvent` junto do run.
  **Isso não pode acontecer**: o `ErrorEvent` vive 14 dias e o `PipelineLog`
  30, então o erro sempre morre primeiro e a cascata nunca alcançaria uma linha
  viva. O motivo verdadeiro é o **coalescimento**: uma linha cobre uma janela de
  uma hora e pode acumular ocorrências de mais de uma origem, então
  `pipelineLogId` é o **último visto**, não uma relação. Uma FK afirmaria um
  vínculo que a agregação torna falso — e o banco passaria a impedir o expurgo
  do run por causa de um ponteiro aproximado.
- **A escrita é bufferizada, e `recordError` é síncrona por contrato.** Ela
  muta um `Map` em memória e retorna; um intervalo de 30 s (mais um flush no
  `onClose`) faz os upserts. **É a lição de 03/09 aplicada à escrita: o caminho
  que está falhando não pode ganhar uma ida ao banco** — e escrever no banco
  dentro do handler de um erro *de banco* é falha auto-amplificante.
- **`severity: FATAL` escreve na hora.** São poucos por dia, e perder um para
  um `SIGTERM` é perder o único registro do que matou o processo — exatamente a
  forma do 03/09.
- **`recordError` nunca lança.** Mesmo contrato do `logPipelineEvent`.

### Retenção

A etapa 8 ganha `errorEvent.deleteMany` com corte em 14 dias — não 30: esta
tabela responde "o que está quebrado agora"; `PipelineLog` e `DailyMetric`
respondem "estava quebrado no mês passado".

---

## §9 Fase 5 — As telas: Métricas e Segurança

**Fecha:** quatro números calculados todo dia e jogados fora na serialização; um
endpoint ADMIN inteiro sem leitor; e nenhuma tela que responda "a API está
devolvendo erro agora?".

### Aba Métricas — o que entra

- **Linha de KPI com variação** (§4.2), quatro cartões.
- **Os quatro sinais** (§3.1): latência p95 por rota, tráfego, taxa de erro, e
  **saturação** — o painel novo, com as horas do plano, memória e atraso do
  event loop.
- **Rosquinhas** de categoria, provider de IA e fonte de ingestão (§4.3).
- **`series-bars.tsx`** — irmão do `CategoryBars` que **preserva a ordem**, para
  o `byDay` que hoje volta e não é desenhado. Não parametrizar o `CategoryBars`:
  a ordenação por valor é a razão de ele existir.
- **As três colunas órfãs** — `newsApiCount`, `rssCount`, `cleanupCount` entram
  no `dashboardMetricsSchema` e viram cartão.

### `aiTokensUsed`: removido — decidido em 05/09/2026

Verificado: só o `schema.prisma:205` e o `seed.ts:161` a mencionam — **nenhum
provider captura uso de token**. É coluna morta, e renderizá-la mostraria número
em dev e branco em produção.

**Há um argumento honesto a favor de populá-la**, e ele vem da §3.1: token
consumido é a **saturação** da dependência de IA, o mesmo tipo de teto que
suspendeu a API por 750 horas. Os dois providers devolvem uso no envelope
(`usageMetadata` no Gemini, `usage` no Groq), então popular é trabalho pequeno.

**O argumento não bite nos números deste produto.** É **uma** chamada por dia,
com ~15 matérias de entrada e um briefing de saída — ordem de dezenas de
milhares de tokens por dia, contra tetos de plano gratuito que estão duas ou
três ordens de grandeza acima. Instrumentar uma saturação a ~1% do teto é
construir um termômetro para uma febre que não existe.

**Decidido: remover por migration, e o lugar é a Fase 5** — é lá que a extensão
do `response-schema-contract.test.ts` ao `DailyMetric` **força** a decisão, em
vez de deixá-la parada mais um mês. Sai com o motivo escrito no `progress.md`.

**Gatilho para voltar atrás**, e é barato: mais de um briefing por dia, ou a
primeira troca para um modelo pago. Aí a coluna volta com uma migration de uma
linha e os dois providers passam a preencher.

### Aba Logs e segurança — o que entra

- **Erros agrupados por fingerprint**, janela de 24 h / 7 d: código, contagem,
  visto por último, rota, mensagem, e o `lastRequestId` como texto
  selecionável — é ele que torna o relato de um usuário pesquisável.
- **Rosquinha de erro por categoria** (6 fatias).
- **Tabela de eventos de segurança** no formato da referência (§4.2): busca,
  filtro por severidade, filtro por tipo, colunas ordenáveis.
- **Invariantes** — vazio até a Fase 6.
- **Auditoria de ação de admin** — quem disparou o pipeline, quem apagou o quê.

### Guardas

Do lado do web, `apps/web/tests/lib/admin-surface.test.ts`: **toda rota sob
`app/api/admin/**` chama `proxyToApi` com `requireRole: 'ADMIN'`**, com mapa de
exceções — e o `run-pipeline` ganha a única entrada, porque ele reentra na rota
do cron com `CRON_SECRET`. Ter de escrever o motivo é o que mantém a lista
honesta.

Do lado da API, estender o `response-schema-contract.test.ts` para o
`DailyMetric`: toda coluna escalar aparece no schema ou num `OMITTED` com
motivo. **É literalmente o defeito para o qual esse teste foi escrito** —
carregado pelo service, descartado pelo serializador, sem erro e sem teste
vermelho — aplicado ao modelo que ele nunca cobriu. E força a decisão sobre o
`aiTokensUsed` em vez de deixá-la parada.

---

## §10 Fase 6 — Invariantes (o eixo das inconsistências)

**Fecha:** as etapas 7.5, 8, 8.5 e 9 engolem a própria falha de propósito, para
o run terminar — e nada nunca pergunta "o que deveria ter acontecido
aconteceu?". A retenção pode parar de funcionar por um mês e o primeiro sintoma
é uma conta do Neon.

O `measure-archive-hygiene.mjs` continua exatamente como está — ele mede o
acervo vivo pela rede, e o motivo de ser script e não teste segue correto. O
que a Fase 6 acrescenta é o irmão **em processo, agendado e visível ao admin**,
para invariante que se resolve com consulta agregada.

Roda como **etapa 9.5**, com `for...of` e `await yieldToEventLoop()` entre
checagens — **reusando o helper do `news-renormalizer.service.ts:174`**, não
escrevendo um segundo. Suíte de invariante é exatamente o tipo de coisa que
vira varredura sem ninguém perceber, que é a forma do 03/09.

### As nove

| id | Consulta | Pega |
|---|---|---|
| `retention.news` | `MIN(createdAt) >= now-31d` | etapa 8 parada em silêncio |
| `retention.pipelineLog` | idem, 31d | idem |
| `retention.productEvent` | idem, 91d | idem |
| `retention.errorEvent` | idem, 15d | idem |
| `briefing.one_per_day` | datas distintas de `Article` nos últimos 7d == 7 | **a falha de 01/09, cujo único sinal foi o briefing ausente** |
| `pipeline.no_stale_running` | `RUNNING` mais velho que `STALE_RUN_MS` == 0 | o cadáver, antes de travar o disparo de amanhã |
| `briefing.has_sources` | `Article` dos últimos 7d sem `BriefingSource` == 0 | a auditoria da §18.4 **do plano da V2**, conferida em vez de suposta |
| `metrics.day_recorded` | dias com run SUCCESS e sem `DailyMetric` == 0 | a etapa 9 engolindo a própria falha |

A nona converte dívida em prosa para número: `newsletter.delivered` — dias com
assinante ativo e `NewsletterLog.sent = 0`. Hoje "a newsletter não entrega a
assinante real" é uma frase no `CLAUDE.md`; como invariante vira linha vermelha
numa tela.

**Todas são `count`/`groupBy`/`aggregate` sobre coluna indexada. Nenhuma
carrega linha.** Nove consultas, dentro do orçamento de dez declarado abaixo.

### Para onde o resultado vai — e é aqui que a fase se paga

Zero tabela nova, zero tela nova. O resultado sai em dois lugares que já vão
existir:

- **um `PipelineEvent`** na etapa 9.5, nível INFO, relatório no `context` —
  aparece de graça na tela de detalhe da Fase 2;
- **um `recordError({ origin: 'INVARIANT', ... })` por violação** — aparece no
  painel de erros da Fase 5, e como o fingerprint inclui o id do invariante,
  uma violação que dura 10 dias são 10 linhas, não 10 mil.

`GET /api/admin/invariants` lê o último evento da etapa 9.5 em vez de rodar a
suíte de novo — atualizar a tela não pode disparar oito consultas agregadas em
0.1 vCPU.

**Orçamento como número:** no máximo 10 consultas agregadas, abaixo de 2 s de
relógio. Estourar significa que um invariante está varrendo — e o sintoma vai
ser um `SIGTERM`, não um teste lento.

---

## §11 Fase 7 — Erro do cliente (três subfases independentes)

**Fecha:** um crash de render mostra "algo deu errado", descarta o `digest` que
localizaria o stack do servidor, e não é contado em lugar nenhum. Um crash no
layout raiz mostra o padrão do Next sem estilo, porque não existe
`global-error.tsx`.

### §11.1 — Os `catch` vazios do BFF (mergear esta primeiro)

`logServerError(scope, error, { requestId })` escreve uma linha JSON em stderr —
o log de função da Vercel **é** o log aqui. Mascara `AUTH_JWT_SECRET`,
`CRON_SECRET`, `NEXTAUTH_SECRET`: um conjunto de segredos **diferente** do da
API, então é irmão do `apps/api/src/utils/redact.ts` e não duplicata. Escrever
isso no comentário, para ninguém "deduplicar" os dois.

Duas coisas que isso destrava e que já existem sem funcionar:

- o `api-proxy.ts` **já tem** o `requestId` em escopo no `catch`. Logar ali faz
  o 502 na Vercel e a linha da API compartilharem o id — **é a peça que
  finalmente faz o `x-request-id` pagar no caminho em que ele importa.** Hoje
  ele é ecoado no sucesso e jogado fora na falha.
- o `ApiError.cause` do `lib/api.ts` é documentado como existindo "para manter
  o rastro para o log do servidor" e **nenhum código o lê**. O
  `logServerError` é o leitor.

### §11.2 — O `digest` chega a um humano

Os quatro `error.tsx` passam a desestruturar `error`, renderizar o `digest` em
texto pequeno ao lado do botão de tentar de novo — o mesmo papel que o
`requestId` cumpre no corpo do 500 da API — e reportá-lo.

**`global-error.tsx` é o boundary raiz sancionado.** O `apps/web/CLAUDE.md`
proíbe um `error.tsx` na raiz porque o boundary cairia fora do `<html>`; o
`global-error.tsx` renderiza o próprio `<html>`/`<body>` e é a exceção. **O
modelo é o `app/not-found.tsx`**, que já pagou essa lição: renderizando fora de
todo layout, ele precisa do próprio `globals.css`, das próprias fontes e do
próprio `ThemeInit` — a ausência disso mandou uma página em Times New Roman
para produção.

**A maior armadilha da subfase:** o `global-error.tsx` é componente de cliente
(recebe `reset`), então **não pode** chamar `getMessages()` como o
`not-found.tsx` faz — e `useTranslations` sem provider **lança dentro do
boundary**, que é falha dupla e não renderiza nada. Resolver com string neutra
fixa, ou escolhendo por `document.documentElement.lang`.

### §11.3 — O caminho de ingestão

`POST /api/errors/client`, **endpoint dedicado e não um 15º tipo de evento de
produto**. O `/api/events` é medição de produto anônima de propósito, com
catálogo guardado e um balde de 30/min já documentado como insuficiente; pôr
falha ali faria relato de erro competir com pageview pelo mesmo limite. E o
`track()` é fire-and-forget sem canal de retorno — certo para analytics, errado
para erro, onde se quer ver o 429.

Corpo: `message` até 300 caracteres, `digest` até 64, `path` sem query string,
**sem stack do cliente** — stack minificado não serve, e o `digest` é a chave
para o stack do servidor. Rate limit de 10/min.

**A armadilha, sinalizada alto:** endpoint de reportar erro que um cliente
hostil pode chamar é amplificador de escrita. Três defesas, todas já padrão
aqui: o coalescimento da Fase 4, o rate limit, e schema estrito. **Gatilho
numérico: 429 em `POST /api/errors/client` dentro de `GET /api/metrics/http`** —
sem instrumentação nova.

---

## §12 Fase 8 — O log de sucesso, e por que `SUCCESS` mente hoje

**Fecha:** não existe registro de que o dia deu certo que alguém consiga ler — e
o `SUCCESS` que existe **esconde quatro modos de falha por construção**.

### O problema, que não é o que parece

O pipeline **já** grava sucesso: a etapa 9 emite o `PipelineEvent`
`Pipeline completed successfully` e o `PipelineLog.status` vira `SUCCESS`. Então
por que uma fase?

Porque **`SUCCESS` é binário e o pipeline não é.** Quatro etapas engolem a
própria falha de propósito, para o run terminar:

| Etapa | O que faz | Se falhar |
|---|---|---|
| 7.5 | envia a newsletter | `WARN`, run segue `SUCCESS` |
| 8 | expurga dados velhos | `WARN`, run segue `SUCCESS` |
| 8.5 | renormaliza o acervo | `WARN`, run segue `SUCCESS` |
| 9 | grava as métricas do dia | `WARN`, run segue `SUCCESS` |

Some a isso duas coisas que também não mudam o status: **o fallback para o
Groq** (o Gemini caiu e o briefing saiu por outro modelo) e **feeds em
`feed-failed`** (fontes que não responderam). Um run pode ter **seis coisas
erradas** e reportar `SUCCESS`.

E há um terceiro estado que hoje não existe em lugar nenhum: **o dia em que o
pipeline não rodou**. Em 01/09 o cron estourou o prazo, nenhuma linha foi
gravada, e o único sinal foi o briefing ausente na Home. **Ausência de linha
não é o mesmo que linha de falha, e nada distingue as duas.**

### O que a fase entrega

**1. Um desfecho com mais de dois valores.** Derivado, não uma coluna nova — a
regra lê os eventos do run:

```
SUCCESS           — briefing gerado, zero WARN, provider primário
SUCCESS_DEGRADED  — briefing gerado, mas com pelo menos um WARN
FAILED            — sem briefing
NEVER_RAN         — não há run para a data (derivado da ausência)
```

`SUCCESS_DEGRADED` é o valor que hoje não existe e que carrega toda a
informação perdida. **Não é coluna nova no banco**: é função pura sobre
`PipelineLog` + seus `PipelineEvent`, testável sem banco, e por isso não pede
migration.

**2. Um resumo do que deu certo, e não só do que deu errado.** O evento da
etapa 9 passa a carregar no `context` o que uma pessoa quer saber ao abrir a
tela de manhã:

```
{ collected, sources, deduped, persisted, selected,
  provider, model, promptVersion,
  briefingId, briefingChars, sourcesCited,
  newsletter: { total, sent, failed } | 'skipped',
  degradedBy: ['7.5', '8.5'],
  durationMs }
```

`degradedBy` é o campo que faz o `SUCCESS_DEGRADED` ser acionável em vez de
decorativo — ele diz **qual** etapa engoliu a falha.

**3. Um batimento positivo.** A ausência de run vira observável: o
`briefing.one_per_day` da Fase 6 já cobre a consequência; esta fase cobre a
causa, comparando **a data esperada** com o último run. Um cartão na Visão
geral com "último briefing: há 4 h" responde antes de qualquer gráfico.

**4. A série de desfechos, 30 dias.** Uma faixa de 30 quadradinhos, um por dia,
colorido por desfecho — verde, âmbar, vermelho, vazado para `NEVER_RAN`. É o
painel de maior densidade de informação por pixel do plano inteiro: três
semanas de saúde do produto num relance, e o buraco de 29–31/08 apareceria como
três quadrados vazados.

### Arquivos

| Ação | Caminho |
|---|---|
| criar | `apps/api/src/services/run-outcome.ts` — a função pura |
| modificar | `apps/api/src/services/pipeline.service.ts` — o `context` da etapa 9 |
| modificar | `apps/api/src/routes/admin/pipeline.ts` (Fase 2) — `outcome` na resposta |
| criar | `apps/web/components/admin/outcome-strip.tsx` — a faixa de 30 dias |
| modificar | `packages/types/src/admin.ts` — `RunOutcome` |

### Guarda

`apps/api/tests/services/run-outcome.test.ts` — a tabela inteira, incluindo os
casos que hoje somem: run com briefing e newsletter falhada é
`SUCCESS_DEGRADED`, não `SUCCESS`; run com fallback para o Groq é
`SUCCESS_DEGRADED`; data sem run é `NEVER_RAN`, e **não** `FAILED`. Função pura
sobre fixture, sem banco — cabe no `turbo test`.

**Gatilho numérico que a fase cria:** três dias seguidos de `SUCCESS_DEGRADED`
pelo mesmo `degradedBy`. É a versão medida do gatilho que hoje está escrito em
prosa no `CLAUDE.md` sobre o fallback do Groq.

---

## §13 Fase 9 — Os dois portões: antes da IA e depois dela

**Fecha:** o briefing vai para a capa **sem ninguém conferir se ele deveria**. A
validação de hoje (`parseMarkdownResponse`) confere **forma** — existe linha de
título, título não vazio, corpo com pelo menos 400 caracteres — e nada mais.

A literatura de pipeline de dados chama isso de **portão de qualidade** com
**disjuntor**: cada etapa analisa métrica e regra, e se alguma é violada o
circuito abre e o processamento não avança. A de LLM em produção chama de
**guardrail de saída**: o modelo produz um candidato, um guarda o examina, e só
o aprovado sai. São a mesma ideia em dois vocabulários, e o pipeline do Newra
precisa das duas.

### §13.1 Etapa 5.5 — o portão de entrada

Roda **depois da seleção e antes da chamada de IA**. O argumento é econômico
antes de ser de qualidade: **não gastar a chamada do modelo sobre uma colheita
que não presta**. Melhor nenhum briefing que um briefing escrito a partir de
três matérias de uma fonte só.

| Checagem | Regra | Ação |
|---|---|---|
| Volume | itens colhidos ≥ 30% da mediana móvel de 7 dias | **BLOQUEIA** |
| Diversidade de fonte | ≥ 3 fontes distintas entre os selecionados | **alarga, depois BLOQUEIA** |
| Frescor | ≥ 1 item publicado nas últimas 24 h | **BLOQUEIA** |
| Taxa de duplicata | duplicados / colhidos ≤ 60% | avisa |
| Deriva de categoria | distribuição contra a média de 7 dias | avisa |

**A calibração é o ponto delicado**, e a literatura é explícita: um disjuntor
sensível demais causa fadiga de alerta e parada desnecessária, e um frouxo
demais não pega nada. Daí os números serem relativos a **mediana móvel** e não
absolutos — o acervo cresce, e limiar fixo apodrece.

**Duas correções da auditoria de 04/09, e as duas evitariam um dia sem briefing
por engano:**

**1. A diversidade tenta alargar antes de desistir.** `selectTopItems` pega as
15 mais recentes; se elas vierem de menos de 3 fontes, isso é acidente de
ordenação, não escassez de matéria. O portão **refaz a seleção com 30 itens**
uma vez e só bloqueia se ainda assim não houver diversidade. Bloquear na
primeira tentativa trocaria "a ordenação concentrou" por "o dia não tem
notícia", que são coisas diferentes.

**2. Mediana móvel sem histórico não bloqueia — isso é o comportamento de
partida, e sem ele o deploy derruba o primeiro dia.** A mediana de 7 dias
precisa de 7 dias. No primeiro dia depois do deploy ela é indefinida; depois de
uma lacuna como a de 29–31/08 ela é calculada sobre dias vazios e daria uma
mediana perto de zero, que aprovaria qualquer coisa — ou, pior, um `NaN` que
compara `false` e **bloquearia tudo**. A regra:

```
< 3 dias com run bem-sucedido na janela  →  o portão de volume NÃO opina
                                            (registra `INFO: baseline insuficiente`)
>= 3 dias                                →  mediana sobre os dias que existem
```

Um portão que não sabe o normal não tem o que dizer sobre o anormal. Dizer isso
em voz alta, num evento, é melhor que aprovar em silêncio.

**~39% de toda colheita chega carimbada com a data da véspera** — é norma da
série, registrada no `CLAUDE.md`, e por isso o portão de frescor olha 24 h e
não "hoje".

### §13.2 Etapa 6.5 — o portão de saída, que é a etapa de segurança

Roda **depois de gerar e antes de persistir**. É a camada que falta na defesa
de injeção de prompt deste projeto.

**Correção importante, feita na auditoria de 04/09.** A primeira versão desta
seção dizia que "não há nenhuma defesa de saída". **É falso, e a diferença
importa.** O `apps/api/CLAUDE.md` documenta **três** camadas, e a terceira é de
saída: `parseMarkdownResponse` exige o `# ` e um corpo, e o
`prompt-injection.test.ts:142-152` afirma que ela recusa exatamente *"o formato
do sucesso de um ataque: o modelo respondeu à ordem que veio no feed"* — tanto
`'OI'` quanto `'Minhas instruções são: …'`.

O que a camada 3 **não** pega é o ataque que **preserva o formato**: um briefing
bem-formado, com título e corpo de tamanho normal, que carrega um link injetado
ou uma afirmação plantada. Ela filtra a injeção grosseira; a fase 9 filtra a
educada. Esse é o buraco real, e ele é mais estreito e mais preciso do que o
que estava escrito aqui.

| Checagem | O que pega | Ação |
|---|---|---|
| **URL não ancorada** | link no briefing que não estava em nenhuma fonte de entrada | **BLOQUEIA — segurança** |
| **Vazamento de envelope** | `MATERIAL_START`/`MATERIAL_END` ou trecho do system prompt na saída | **BLOQUEIA — segurança** |
| Idioma | o briefing tem de estar em pt-BR | **BLOQUEIA — qualidade** |
| Teto de tamanho | há piso (400) e nenhum teto | **BLOQUEIA — qualidade** |
| Ancoragem das fontes | toda `BriefingSource` estava no conjunto enviado | avisa |
| Texto em forma de instrução | "ignore", "as an AI", "system prompt" e a família | **avisa — nunca bloqueia** |

**A URL não ancorada é a checagem mais forte da fase**, e é barata: o conjunto
de links legítimos é exatamente o que o `formatNewsItems` mandou para o modelo.
Um link que aparece na saída e não estava na entrada foi **inventado ou
injetado** — e é o vetor de exfiltração e de envenenamento de SEO, num site que
o Google News indexa. Ela é **estrutural**: falso positivo exige que o modelo
invente uma URL, o que já é defeito.

### O bloqueio por palavra-chave foi rebaixado, e o motivo é um teste que existe

A primeira versão desta tabela mandava **bloquear** por lista de palavras.
Isso **contradiz uma decisão testada deste repositório**. O
`prompt-injection.test.ts:125-131` se chama
`does not censor journalism that is about prompt injection` e o comentário dele
diz, sobre a camada de entrada:

> lista de palavra proibida. Uma matéria sobre o assunto seria o primeiro falso
> positivo, e a mesma ordem se escreve de mil maneiras.

O argumento vale **igual ou mais** na saída. Um dia em que a notícia É um
ataque de injeção produz um briefing que resume o ataque — e bloquear ali
suprime o briefing do dia por estar fazendo jornalismo. Pior: a lista é em
inglês e uma injeção em português não casa com ela, então o filtro seria **alto
em falso positivo e baixo em verdadeiro positivo**, que é a pior combinação
possível. Vira `avisa`, com evento registrado, e quem decide olha.

### Bloqueio de segurança **não** cai para o provider de reserva

A primeira versão dizia que qualquer bloqueio derrubava para o Groq, "como já
faz quando o Gemini falha". **Para falha de qualidade está certo. Para falha de
segurança é uma vulnerabilidade**, e é o achado mais sério da auditoria.

Se o portão bloqueou porque detectou injeção, **a causa está no material de
entrada, não no modelo**. Mandar o mesmo material envenenado para o segundo
modelo é repetir o ataque com um oráculo diferente — e **dobra a chance de um
dos dois escapar**, porque basta um passar. A regra fica escrita ao lado do
código:

| Motivo do bloqueio | O que acontece |
|---|---|
| Qualidade (idioma, tamanho) | cai para o provider de reserva, uma vez |
| **Segurança (URL não ancorada, envelope vazado)** | **o dia falha. Sem repetir, sem fallback.** `FAILED` com `errorStage: 6.5`, `recordError` com `severity: FATAL` |

Um dia sem briefing é um custo conhecido e reversível. Um briefing com link
injetado indexado pelo Google Notícias não é.

### §13.3 O sinal que a própria literatura pede

> Registre toda decisão de guarda e observe a deriva; mudança súbita na taxa de
> aprovação, ou na distribuição dos motivos de recusa, costuma **preceder** um
> bypass que funciona.

Isso encaixa sem esforço no que as fases anteriores já constroem: cada decisão
de portão vira um `PipelineEvent` na etapa 5.5 ou 6.5, e cada bloqueio vira um
`recordError({ origin: 'PIPELINE', code: 'pipeline.gate_blocked', ... })`. A
**taxa de aprovação por dia** vira uma linha na aba de segurança, e a
distribuição de motivos vira uma rosquinha.

**Gatilho numérico:** taxa de aprovação do portão de saída caindo abaixo de 90%
em 7 dias, ou qualquer bloqueio por URL não ancorada — o segundo é evento único
e merece olhar no mesmo dia.

### Arquivos

| Ação | Caminho |
|---|---|
| criar | `apps/api/src/services/pipeline-gates.service.ts` |
| criar | `apps/api/src/providers/ai/output-guard.ts` |
| modificar | `apps/api/src/services/pipeline.service.ts` — as duas etapas |
| modificar | `apps/api/src/services/pipeline-event.service.ts` — `stage` 5.5 e 6.5 |
| modificar | `docs/diagrams/pipeline-sequence.mermaid` e `data-flow.mermaid` |

**A guarda de deriva de diagrama vai reprovar** se as duas etapas novas não
entrarem nos `.mermaid` — o `diagram-drift.test.ts` compara com as etapas que o
pipeline anuncia. É a guarda funcionando como projetada.

### Guarda

`apps/api/tests/services/pipeline-gates.test.ts` e
`apps/api/tests/providers/output-guard.test.ts`:

- cada portão reprovando **exatamente** o caso que existe para pegar, e
  aprovando o caso vizinho legítimo — a asserção que impede um regex
  ganancioso demais;
- **um briefing real de produção passa em todos os portões.** É a lição da
  higiene de texto da Fase 12: um teste sobre caso inventado passa nas duas
  versões, e só o ensaio contra dado real pegou que a primeira versão
  descartaria 5.635 corpos. Antes de mergear, rodar os portões contra os
  briefings retidos e **contar quantos reprovariam** — se mais que zero, é o
  portão que está errado, não o acervo;
- um caso de injeção sintético — material com "ignore as instruções anteriores"
  no título — atravessando entrada e saída.

---

## §14 Fase 10 — A esteira: segurança do CI/CD ✅ 2026-09-05

**Fecha:** o pipeline que **constrói e publica** o site não tem etapa de
segurança além do Gitleaks.

Esta fase é curta de propósito. É higiene de esteira, não arquitetura.

> **Entregue em 05/09/2026 — o primeiro PR de código deste plano.** O
> inventário abaixo foi reconferido contra os arquivos antes de abrir e os
> quatro achados estavam certos. O detalhe do que entrou, os números medidos e
> os dois defeitos que a guarda achou enquanto era escrita estão no item **47**
> do `docs/progress.md`; as advisories aceitas, em
> `docs/security-advisories.md`.
>
> **Uma decisão foi tomada aqui e não estava escrita no plano: o `--prod`.** O
> texto abaixo pede `pnpm audit --audit-level=high`, e sem o filtro são 35
> advisories *high* em 17 pacotes — quase todas em ferramenta que nunca é
> publicada. Uma lista de exceção com 35 linhas é a armadilha 21 escrita por
> extenso. Com `--prod` são 18, todas já analisadas nos itens 9.S e 10.S, e o
> lado de desenvolvimento fica com o Dependabot, que propõe em vez de reprovar.

### O que a inspeção achou

| Achado | Estado hoje | Risco |
|---|---|---|
| `permissions:` declarado | **1 de 5** workflows (só o `gitleaks.yml`) | o `GITHUB_TOKEN` vai com o padrão do repositório para todo job |
| Actions fixadas | **0 de 6** — todas em tag mutável (`@v5`, `@v4`, `@v2`, `@v12`) | tag é movível; quem controla a action controla o job |
| Auditoria de dependência | **nenhuma** no CI | as advisories só aparecem quando alguém roda à mão |
| SAST | **nenhum** | — |

### O que entra

1. **`permissions: {}` no topo de cada workflow**, com o mínimo declarado por
   job. É a mudança de maior alcance e a mais barata: cinco linhas.
2. **Fixar as seis actions em SHA completo**, com o comentário da versão ao
   lado. Fixar em SHA é o único jeito de usar uma action como release imutável.
3. **`pnpm audit --audit-level=high` no job de lint**, com uma lista de exceções
   **com motivo escrito e data** — o repositório já tem as três advisories da
   `fastify@4` documentadas com alcance analisado, e é isso que vira a lista.
   Sem a lista, o passo vira ruído e alguém o desliga.
4. **CodeQL** no `push` da `main` e nos PRs. É gratuito em repositório público,
   e o `javascript-typescript` cobre os dois apps.
5. **Dependabot** para `npm` e `github-actions`, semanal, agrupado.

### O que fica de fora, e por quê

- **DAST** (varredura dinâmica contra o site no ar) — o smoke E2E já bate em
  produção, e um scanner ativo contra o plano free do Render consumiria a cota
  de horas que já suspendeu a API uma vez.
- **SBOM e assinatura de artefato** — não há artefato publicado; o deploy é
  build direto na Vercel e no Render.
- **Container scanning** — não há container.

### Guarda

`apps/api/tests/build/workflow-hardening.test.ts` — estática, lendo os `.yml`:

- todo workflow declara `permissions:`;
- todo `uses:` casa com `@[0-9a-f]{40}`, com mapa de exceção escrito;
- a lista de exceções do `audit` tem motivo e data em cada linha.

É a mesma família do `env-parity.test.ts`: o CI conferindo a própria
configuração. E ela **reprova hoje**, o que é o jeito certo de a fase começar.

---

## §15 Fase 11 — A saúde de cada fonte, uma por uma

**Fecha:** o pipeline sabe **hoje** qual fonte falhou, e esquece amanhã. Uma
fonte que entregava 20 matérias por dia e passou a entregar 2 é **invisível** —
ela não falha, só definha.

### O que já existe, e é mais do que parece

A classificação por fonte foi construída em 03/09 e está pronta:
`FetchWarningKind` (`news-fetcher.service.ts:27`) distingue quatro casos, e a
distinção que importa já foi paga com um episódio:

| Classe | Significa | Conta como erro? |
|---|---|---|
| `provider-failed` | o provider inteiro lançou | sim |
| `provider-empty` | o provider devolveu lista vazia sem lançar | sim — é o pior, indistinguível de dia sem notícia |
| `feed-failed` | **aquele** feed lançou (timeout, DNS, XML inválido) | sim |
| `feed-empty` | aquele feed respondeu e não tinha nada | **não** — é o normal de fonte especializada |

O `fetchFromRssWithFailures` devolve `failures` por fonte, com nome e mensagem.
**Nada disso é perdido por falta de dado. É perdido por falta de memória:** o
aviso vira o `context` de um `PipelineEvent` da etapa 1 e acabou.

### As três perguntas que hoje não têm resposta

1. **"Há quantos dias a Superinteressante está fora?"** Exige ler os eventos de
   N dias e cruzar à mão. Em 03/09 a resposta era "dois", e ela só apareceu
   porque alguém foi olhar.
2. **"Esta fonte entrega menos do que entregava?"** Não tem como perguntar. O
   `feed-empty` de uma fonte que sempre teve pouco e o de uma fonte que secou
   são o mesmo registro.
3. **"Vale a pena trocar este provedor?"** — que é o seu caso de uso declarado.
   Exige série histórica por fonte, e ela não existe.

### O modelo

Uma linha por **`(source, dia)`**. Diária, não por hora: a colheita é diária, e
uma granularidade mais fina só multiplicaria linha sem responder nada.

```prisma
model SourceHealth {
  id            String    @id @default(uuid())
  /// Nome da fonte como `rss-sources.ts` a escreve, ou `newsdata`.
  source        String
  kind          SourceKind   // RSS | AGGREGATOR
  day           DateTime     // data de calendário, meia-noite UTC
  /// Itens que **esta fonte** trouxe no run do dia.
  fetched       Int       @default(0)
  /// Quantos sobreviveram à deduplicação — a medida que importa de verdade.
  kept          Int       @default(0)
  outcome       SourceOutcome  // OK | EMPTY | FAILED | NOT_ATTEMPTED
  /// Já redigida e truncada; `null` quando `outcome` não é FAILED.
  failureReason String?
  latencyMs     Int?
  @@unique([source, day])
  @@index([day])
  @@index([source, day])
}
```

**`kept` é o campo que faz a fase valer.** `fetched` mede o que a fonte
publicou; `kept` mede o que ela **acrescentou** ao acervo depois da
deduplicação. Uma fonte que republica o que o G1 já deu tem `fetched` alto e
`kept` perto de zero — e é exatamente essa a fonte que se troca primeiro. Sem
`kept`, a decisão de trocar provedor seria tomada sobre o número errado.

**`NOT_ATTEMPTED` existe de propósito.** Uma fonte removida de
`rss-sources.ts`, ou um run que morreu antes da etapa 1, não é a mesma coisa que
uma fonte que respondeu vazio. Sem esse valor, remover uma fonte a faria parecer
quebrada para sempre no gráfico.

### Retenção: 90 dias, e é mais que o resto de propósito

O `ErrorEvent` vive 14 dias porque responde "o que está quebrado agora". Este
responde **"esta fonte vale a pena?"**, que é uma pergunta trimestral. Noventa
dias × 13 fontes = **~1.170 linhas**, um custo desprezível — e alinha com a
retenção do `Article`, então dá para cruzar "o briefing daquele dia" com "quem
alimentou o briefing daquele dia".

### O que aparece na tela

Na aba **Métricas**, um painel "Fontes":

- **Tabela por fonte**, no formato da referência (§4.2): nome, estado de hoje,
  `fetched`/`kept` de hoje, média de 7 e de 30 dias, **variação**, e dias
  seguidos em falha. Ordenável por qualquer coluna — é assim que se acha a fonte
  que definhou.
- **Faixa de 30 dias por fonte**, um quadradinho por dia, mesmo componente da
  Fase 8. Uma fonte que caiu no dia 12 e não voltou é uma linha que muda de cor
  no meio e não volta mais.
- **Rosquinha de contribuição** — que fatia do acervo dos últimos 30 dias veio
  de cada fonte, por `kept`. É o retrato que responde "de que eu realmente
  dependo".

### O limite honesto, e ele é grande

**A NewsData.io entra como *uma* fonte, e ela agrega dezenas.** O `CLAUDE.md`
registra a medição: são **87 fontes** e 95 hosts de imagem distintos no acervo,
das quais só 12 estão em `rss-sources.ts`. Ou seja: `source: 'newsdata'` é um
balde que esconde a maior parte da diversidade real.

Dividi-lo exigiria agrupar por `News.source` no que a NewsData trouxe naquele
run — dado que **existe**, mas cuja cardinalidade não tem teto declarado por
nós; é o provedor que decide quantos veículos manda. Fica de fora nesta fase,
com gatilho: **quando a decisão em pauta for trocar a NewsData por outro
agregador**, dividir vira pré-requisito, porque comparar um balde com outro
balde não decide nada.

### Onde a etapa entra

Na **etapa 1**, junto da coleta — é lá que `fetchAll` já tem o resultado por
fonte. Uma escrita `createMany` com `skipDuplicates`, **uma por run**, não uma
por fonte: treze `upsert` sequenciais numa instância de 0.1 vCPU é a forma de
problema que este projeto já conhece.

### Guarda

`apps/api/tests/services/source-health.test.ts`:

- as quatro `FetchWarningKind` mapeiam para os quatro `SourceOutcome`, **e a
  tabela é exaustiva nos dois sentidos** — uma classe nova em
  `FetchWarningKind` sem desfecho correspondente reprova, que é o idioma do
  `analytics-catalog.test.ts`;
- **uma fonte que não aparece nos avisos e trouxe zero item é `EMPTY`, não
  `FAILED`** — é a distinção de 03/09, e perdê-la aqui a desfaria;
- **fonte fora de `rss-sources.ts` vira `NOT_ATTEMPTED`, e não some** da série;
- `kept` nunca é maior que `fetched` — invariante de aritmética que pega erro de
  atribuição de coluna;
- estática: a escrita é **uma** chamada ao Prisma, não um laço.

**Gatilho numérico:** fonte com **3 dias seguidos** de `FAILED`, ou `kept` médio
de 7 dias abaixo de **30%** do de 30 dias. O primeiro é a Superinteressante de
03/09; o segundo é a fonte que definha, que hoje ninguém veria.

---

## §16 Dívidas com gatilho numérico

Não-objetivos declarados como número, nunca como item de lista.

| Dívida | Gatilho |
|---|---|
| `logPipelineEvent` é awaited em 19 call sites (~1 s por run) | o primeiro dia em que a duração do run for o que se investiga |
| Métricas de HTTP seguem em memória | mais de uma instância no Render, ou a primeira pergunta que exija comparar duas semanas |
| `ErrorEvent` não guarda ocorrência individual | o primeiro incidente em que `firstRequestId`/`lastRequestId` provadamente não bastaram |
| `code` não vai no corpo da resposta | a primeira tela que precise ramificar por qual falha foi |
| Fingerprint granular demais | **> 2.000 linhas em 14 dias** ou **> 50 fingerprints em 24 h** — conserta-se o normalizador, não a tabela |
| Leitura do painel de erros pesada | **p95 de `GET /api/admin/errors` > 1.000 ms** no `/api/metrics/http` |
| Buffer de erro pequeno demais | contador de descarte diferente de zero em qualquer dia |
| Quarta aba | a `/admin/security` passar de ~6 painéis |
| Alerta ativo (e-mail/webhook) | depois de a tela existir e de sabermos qual sinal dispara de fato |
| Degradação virou norma | **3 dias seguidos de `SUCCESS_DEGRADED` pelo mesmo `degradedBy`** — a versão medida do gatilho do fallback do Groq, hoje escrito em prosa |
| Portão de saída afrouxando | **taxa de aprovação < 90% em 7 dias** — ou **qualquer** bloqueio por URL não ancorada, que é evento único e merece olhar no mesmo dia |
| Portão de entrada sensível demais | **> 1 bloqueio por semana** sem que a colheita estivesse de fato ruim — recalibrar a mediana móvel, não desligar o portão |
| Advisory sem dono | linha na lista de exceções do `audit` com mais de **90 dias** sem revisão |
| Fonte quebrada | **3 dias seguidos** de `FAILED` para a mesma fonte |
| Fonte definhando | `kept` médio de 7 dias abaixo de **30%** do de 30 dias |
| Balde da NewsData virou cego | quando a decisão em pauta for **trocar o agregador** — aí dividir `source: 'newsdata'` por veículo vira pré-requisito |

---

## §17 Armadilhas

1. **`transport`/`pino-pretty` em produção** — segundo processo em 0.1 vCPU.
2. **Aguardar a escrita do `ErrorEvent` no caminho que falhou** — escrita no
   banco dentro do handler de um erro de banco é auto-amplificante. Há teste
   afirmando que `recordError` devolve `undefined`, não `Promise`.
3. **`refetchInterval` numa aba de admin deixada aberta** — 750 h/mês com 0,8%
   de folga, e esta API já foi suspensa uma vez. Sempre
   `refetchIntervalInBackground: false`.
4. **Invariante com `findMany`** — o 03/09 verbatim. A guarda pergunta **onde o
   event loop girou**, não se há `take`.
5. **`ErrorEvent` sem coalescimento** — um laço de 500 escreve linha na
   velocidade em que falha.
6. **Variável de ambiente nova sem linha no `render.yaml`** — o `env-parity`
   reprova; se fosse `.optional()`, falharia **em silêncio na produção**, que é
   a história do `AUTH_JWT_SECRET`.
7. **Rota nova na API custa três guardas** — linha na `MATRIX`, linha em
   `docs/api.md`, e tipo compartilhado ou exceção escrita.
8. **`formatPipelineDuration` recebe milissegundos** e
   `DevLogSummary.durationSeconds` é segundo: renderiza "45 ms" para um run de
   45 s, em silêncio.
9. **`global-error.tsx` com `useTranslations`** — lança dentro do boundary,
   falha dupla, nada renderiza.
10. **Reusar `/api/events` para erro de cliente** — acopla o balde do analytics
    ao do erro e força exceção no `analytics-catalog.test.ts`.
11. **Copiar o `mx-auto max-w-7xl` do `admin/metrics/loading.tsx`** — o layout
    já fornece `container-editorial`; essa duplicação é o defeito que o
    comentário do layout diz ter consertado.
12. **`@@index([fingerprint])` redundante** — o `@@unique([fingerprint,
    windowStart])` já é o alvo do upsert e serve busca por prefixo.
13. **`aiTokensUsed`** — não renderizar. Só o seed a escreve.
14. **`inline-block` é proibido no projeto inteiro** — o `--spacing-block`
    sombreia a utility. Usar `inline-flex`, como o `admin-nav.tsx` já faz.
15. **Rosquinha com fatia única em 100%** — `stroke-dasharray` com o arco
    inteiro não desenha em alguns navegadores. Tratar à mão.
16. **Portão calibrado com limiar absoluto** — o acervo cresce e o número
    apodrece. Tudo relativo a mediana móvel de 7 dias.
17. **Portão de saída sem caminho de degradação** — bloquear e morrer deixa o
    site sem briefing. Bloqueou, cai para o provider de reserva; só se os dois
    reprovarem é que o dia fica sem, e aí `errorStage: 6.5` diz por quê.
18. **Ensaiar os portões só contra caso inventado.** É a lição da higiene de
    texto: a primeira versão descartaria 5.635 corpos e passava em teste de
    unidade. Rodar contra os briefings retidos e contar quantos reprovariam —
    se mais que zero, o errado é o portão.
19. **`SUCCESS_DEGRADED` como coluna nova.** Não é: é função pura sobre o run e
    seus eventos. Coluna pediria migration e ficaria dessincronizada do que os
    eventos dizem.
20. **Fixar action em SHA e esquecer o comentário da versão.** Um SHA sem
    `# v4.2.1` ao lado é indecifrável, e ninguém atualiza o que não consegue
    ler.
21. **`pnpm audit` sem lista de exceção com motivo e data** — vira ruído,
    alguém desliga o passo, e aí ele deixa de existir de fato enquanto continua
    existindo no arquivo.
22. **Cair para o provider de reserva depois de um bloqueio de segurança** — é
    repetir o ataque com um segundo oráculo, e basta um dos dois escapar. Só
    falha de **qualidade** faz fallback.
23. **Lista de palavra proibida que bloqueia** — o
    `prompt-injection.test.ts:125` já registra por que não: uma matéria *sobre*
    o assunto é o primeiro falso positivo. Avisa, nunca bloqueia.
24. **Portão que opina sem linha de base** — mediana móvel sem histórico dá
    `NaN`, e `NaN` compara `false` em toda direção. Menos de 3 dias de amostra,
    o portão se cala e diz que se calou.
25. **`fetched` no lugar de `kept` ao decidir trocar provedor** — uma fonte que
    republica o que outra já deu tem volume alto e contribuição nula. A
    deduplicação é quem separa as duas.
26. **Remover uma fonte e ela virar "quebrada" para sempre no gráfico** — é o
    que `NOT_ATTEMPTED` existe para impedir.

---

## §18 O que cada fase custa em guarda

| Mudança | Guardas que reprovam se esquecer |
|---|---|
| Rota nova na API | `authorization-matrix.test.ts` (linha na `MATRIX`), `api-docs-drift.test.ts` (linha em `docs/api.md`), `shared-type-contract.test.ts` (tipo ou exceção escrita) |
| Página nova no web | `state-matrix.test.ts` (linha + `toHaveLength`), `i18n-messages.test.ts` (chave nos **dois** arquivos de mensagem), `seo.test.ts` (`pageMetadata`/`alternatesFor`) |
| Componente novo | `design-tokens.test.ts` (paleta camada 1, `inline-block`, `rounded-xl+`, `duration-<n>`, `shadow-*`) |
| Migration | `migrations.test.ts` — **estática**, porque `turbo test` roda sem banco |
| Variável de ambiente | `env-parity.test.ts` — `render.yaml` e `.env.example` |
| **Etapa nova no pipeline** | `diagram-drift.test.ts` — as etapas 5.5 e 6.5 têm de entrar no `pipeline-sequence.mermaid` e no `data-flow.mermaid`, porque a guarda compara com o que o pipeline anuncia |
| **Workflow novo ou alterado** | `workflow-hardening.test.ts` (Fase 10) — `permissions:` declarado e `uses:` fixado em SHA |

---

## §19 Como começar

### Abrir uma sessão de contexto zerado

**O trabalho acontece no repositório de sempre**
(`C:\Users\tavin\Desktop\Projetos\Newra News`), **numa branch por fase**. Não há
worktree, não há segunda pasta, não há nada a configurar.

Pela interface: projeto **`Newra News`**, branch **da fase**, e a caixa
`worktree` **desmarcada**. Pelo terminal, `claude` dentro da pasta do
repositório.

> ### Por que este documento pedia worktree, e por que parou
>
> **Ele nunca justificou.** A versão de 05/09/2026 dizia *"worktree própria"* e
> em seguida explicava apenas o **custo** dela (worktree nova precisa de
> `pnpm install`). Nenhuma linha dizia o que ela traz.
>
> Foi para lá porque as sessões daquele dia já rodavam em worktrees criadas
> automaticamente pela ferramenta — `claude/newra-pipeline-news-collection-…`,
> `claude/render-pipeline-status-…` são nomes gerados, não escolhidos. **O
> ambiente encontrado virou regra escrita**, que é a mesma família do
> keep-alive: premissa herdada que ninguém remediu.
>
> **Worktree resolve um problema real, e não é o deste projeto:** duas branches
> abertas ao mesmo tempo — hotfix enquanto uma feature anda, build longo numa
> enquanto se edita outra, revisão de PR sem largar o trabalho, e
> principalmente **duas sessões do agente em paralelo**, que brigariam pela
> mesma árvore. Aqui é **uma fase, uma sessão, em sequência**: nada disso
> acontece.
>
> **A conta que ela deu:** quatro travadas seguidas para abrir sessão. A pior
> não dava erro — aninhada em `Newra News/.claude/worktrees/`, a ferramenta
> subia até a raiz do projeto que já conhecia e abria **a `main`, em silêncio**.
> As outras três eram a recusa do git em ter a mesma branch em dois lugares,
> que a interface traduzia por *"faça commit ou stash das alterações"* — um
> fallback genérico, com os dois check-outs limpos.
>
> **Se um dia a worktree voltar a fazer sentido** (duas sessões em paralelo é o
> gatilho), ela mora **ao lado** do repositório, nunca dentro dele.

**Confira em uma linha assim que a sessão abrir** — barato, e é o que pega o
modo de falha silencioso:

```bash
pwd && git branch --show-current
```

Tem de responder a pasta do repositório e a branch da fase. Se a branch vier
`main`, a sessão está no lugar errado: não trabalhe ali.

**O prompt de abertura, que é o que substitui o contexto perdido.** Duas frases
bastam, porque tudo o mais está neste documento:

> Vamos implementar a **Fase N** do `docs/Newra-News-Observability-Plan.md`.
> Leia o §19 (o ritual e a ordem), depois a seção da fase, e o §17 (armadilhas).

**O que uma sessão fria erra se ninguém avisar:**

- **Não usar `git stash` sem etiqueta.** O stash é compartilhado com qualquer
  outra árvore do mesmo repositório, e um `pop` pode trazer trabalho alheio.
  Commit temporário resolve melhor.
- **Este documento é a fonte, não a memória da sessão anterior.** Se algo aqui
  contradisser o que a sessão "lembra", o documento vence — e se o documento
  estiver errado, corrija o documento no mesmo PR.
- **Convenção escrita aqui não é justificativa.** Este §19 já mandou usar
  worktree por três semanas sem nunca dizer o que ela trazia — era o ambiente
  daquele dia, escrito como regra. Ao seguir uma instrução de processo daqui,
  se ela não vier com o motivo, **o motivo pode não existir**: pergunte antes
  de pagar o custo dela.

### O ritual de cada fase

**Uma fase, um PR, uma sessão.** Nunca duas fases no mesmo PR — a que quebrar
arrasta a outra no revert, e as fases 4 e 11 tocam schema, que `git revert`
sozinho não desfaz.

**As fases integram na `dev`, não na `main` — decidido em 05/09/2026.** A `main`
é o que está no ar; ela recebe `dev → main` quando o dono do projeto decide, e é
esse merge que publica. Mergear fase a fase na `main` é convidar janela de site
quebrado por mudança que ainda não precisava estar em produção.

**A `dev` é base de primeira classe no CI, e é isso que torna a decisão
possível:** `ci.yml` e `codeql.yml` disparam nas duas, então um PR de fase roda
Lint, Test, Build, `pnpm audit`, Gitleaks e CodeQL igual. **Smoke E2E e Migrate
ficam só na `main`** — o smoke mede o site no ar e migration se aplica a
produção uma vez. Consequência a não esquecer: **um lote com as fases 4 e 11
aplica as duas migrations juntas na promoção.**

1. **Ramificar da `dev` atualizada**, no repositório:

   ```bash
   git fetch origin --prune
   git checkout -B observability/fase-N-<assunto> origin/dev
   git branch -d observability/fase-<N-1>-<assunto>
   ```

   **É o primeiro passo porque a sessão pode abrir em qualquer branch** — a
   interface lembra a última usada. O `checkout -B` torna isso irrelevante:
   qualquer que seja o ponto de partida, a fase começa da `dev` do momento.

   O repositório já tem `node_modules` e os pacotes construídos. **Se algum dia
   for preciso montar um clone do zero, são três passos** — e pular um produz
   uma suíte que passa com o número errado:

   ```bash
   pnpm install --frozen-lockfile
   pnpm --filter @newranews/types build
   pnpm --filter @newranews/database build   # prisma generate && tsc
   ```

   **`pnpm db:generate` sozinho não basta**, e foi o erro cometido em
   05/09/2026: com `install` + `db:generate` + build de `types`, a suíte da API
   rodou **145 testes em vez de 868** — o resto morreu na coleta. Faltava o
   `dist` do `@newranews/database`; o `db:generate` produz o Prisma Client, não
   o JavaScript do pacote.

   **O sintoma é traiçoeiro porque é verde:** o vitest reporta os 145 que
   coletou como *passed*, não como falha. Só a contagem denuncia — por isso o
   passo 4 do ritual compara o número, e não o pass/fail.

   > **Confira que a `dev` não ficou para trás da `main` antes de ramificar.**
   > Ela já esteve **217 commits atrás**, e uma fase desenvolvida sobre `dev`
   > velha é uma fase desenvolvida contra código que não existe mais:
   >
   > ```bash
   > git rev-list --count origin/dev..origin/main   # 0 = alinhada
   > git push origin origin/main:refs/heads/dev     # fast-forward, se não for
   > ```
   >
   > O `push` só é fast-forward enquanto a `dev` não tiver commit próprio —
   > confira `git rev-list --count origin/main..origin/dev` antes, e **nunca
   > force**: se ela estiver à frente, o certo é abrir `dev → main`.
2. **Escrever a guarda antes do código, e vê-la reprovar.** É a regra da §2, e
   nesta sessão ela já pagou duas vezes: a guarda de contagem passava verde
   sobre um `treze` real, e passou a reprovar só depois de a varredura ler prosa
   corrida em vez de linha a linha.
3. **Implementar até a guarda ficar verde.**
4. **`pnpm test && pnpm lint && pnpm turbo typecheck`** — os três, localmente,
   antes do push.
5. **PR com base `dev` e o número da fase no título** —
   `gh pr create --base dev`. O corpo diz o que fecha, qual guarda trava, e qual
   gatilho numérico nasce. **O merge na `dev` fecha o PR e não fecha a fase:** o
   CI passou, e nada foi publicado.
6. **Depois da promoção `dev → main` e do deploy, o ritual do `CLAUDE.md`:**
   Lighthouse, baseline visual e smoke E2E. As fases 5, 9 e 11 mexem em tela ou
   em produto e **precisam** dos três; as de substrato (1, 3, 4) precisam só do
   smoke.

   > **O ritual é do lote promovido, não da fase.** Rodá-lo depois de um merge
   > na `dev` mede a produção **anterior** e devolve verde sobre mudança que não
   > está lá — o defeito mais caro que este projeto sabe produzir, e ele já
   > apareceu duas vezes em outra forma (o gate medindo cold start, e o gate
   > assertando a melhor amostra).

### A ordem, com o motivo de cada passo

**Bloco 1 — o alicerce, e nenhum toca schema.** Podem ir em paralelo.

| PR | Fase | Por que primeiro |
|---|---|---|
| ~~1~~ ✅ | **§14 — Fase 10, CI** — **entregue em 05/09/2026** | Não dependia de nada e era o mais barato. Cinco linhas de `permissions:`, seis SHAs, um `audit`. Fechou um risco de supply chain antes de o resto encostar no código. Item **47** do `docs/progress.md` |
| ~~2~~ ✅ | **§5 — Fase 1, logger** — **entregue em 05/09/2026** | Fechou o vazamento da DSN. Tudo depois dele loga direito de nascença. Item **48** do `docs/progress.md` |
| 3 | **§6 — Fase 2, pipeline no admin** | O dado já existe e ninguém vê. Sem rota nova, sem schema, sem migration |
| 4 | **§11.1 — Fase 7a, BFF** | Três `catch` vazios ganham log. É o que faz o `x-request-id` pagar no caminho da falha |

**Bloco 2 — a espinha. Estritamente em ordem.**

| PR | Fase | Trava |
|---|---|---|
| 5 | **§7 — Fase 3, taxonomia** | O `code` que a Fase 4 usa como fingerprint. Sem ele a tabela nasce com cardinalidade sem teto |
| 6a | **§8 — Fase 4, a migration** | PR só de schema. `ErrorEvent` + os dois índices do `PipelineLog` |
| 6b | **§8 — Fase 4, o código** | `recordError`, o buffer, a retenção na etapa 8 |
| 7 | **§9 — Fase 5, as telas** | Aqui a `/admin/security` nasce e o `toHaveLength` vai a 16 |

**Bloco 3 — depois da espinha, em qualquer ordem.**

- **§12 — Fase 8 (log de sucesso).** A mais barata das quatro: função pura, sem
  migration, e resolve "o dia deu certo?".
- **§15 — Fase 11 (saúde por fonte).** Migration + etapa 1 + painel. É a que
  responde à pergunta de trocar provedor, então adiante-a se essa decisão
  estiver perto.
- **§10 — Fase 6 (invariantes).** Depende da 4 e da 5 estarem no ar.
- **§13 — Fase 9 (portões).** **Por último, e é decisão, não sobra.**

### Por que a Fase 9 vai por último

É a única que pode **deixar o site sem conteúdo**. Antes dela, três coisas
precisam estar no ar:

1. **A Fase 4**, senão a decisão de cada portão não tem onde ser registrada.
2. **A Fase 5**, senão o bloqueio acontece e ninguém vê.
3. **A Fase 8**, senão um dia bloqueado é indistinguível de um dia que não
   rodou — e as duas causas pedem ações opostas.

E, mesmo com as três, o roteiro dela tem um passo a mais: **rodar os portões em
modo observador contra os briefings retidos antes de ligar o bloqueio.** Se
algum dos ~88 briefings reprovaria, o portão está errado — não o acervo. É a
lição da higiene de texto da Fase 12, em que a primeira versão da correção
descartaria 5.635 corpos e passava em todo teste de unidade.

### O que fazer antes do primeiro PR

- [x] **O IP (§3.2) — decidido em 05/09/2026: não encaminhar, não guardar.**
      Eventos agrupam por `userId` no autenticado e por `request.ip` no público;
      a tentativa anônima contra rota autenticada fica a cargo do
      `logServerError` da Fase 7a. **Nada muda no `api-proxy.ts`.**
- [x] **`aiTokensUsed` (§9) — decidido em 05/09/2026: remover por migration**,
      na Fase 5, onde a extensão do `response-schema-contract.test.ts` força a
      decisão. Gatilho para voltar atrás: mais de um briefing por dia, ou o
      primeiro modelo pago.
- [ ] Ler o §17 inteiro. São 26 armadilhas e a maioria custou um incidente.

**Sem decisão pendente. O primeiro PR pode abrir** — e a Fase 10 é a única que
não depende de nada neste plano, o que a torna a partida natural.

---

## §20 Onde acrescentar

Esta é a base. Os pontos abaixo estão **identificados e fora do escopo atual** —
é aqui que os seus acréscimos entram:

- **Alerta ativo.** E-mail, webhook, ou push. Depende de a tela existir
  primeiro (§3.4).
- **A decisão sobre IP.** Hash com sal diário, IP em claro, ou nada (§3.2). É
  decisão sua e muda o que a aba de segurança consegue responder.
- **Retenção do log de segurança** — pode precisar ser diferente dos 14 dias do
  `ErrorEvent`.
- **`report-uri` da CSP** nos dois apps (§3.2) — barato, e ninguém fez.
- **Exportar métrica** para um agregador, se um dia houver mais de uma
  instância.
- **Página de status pública** — o `/api/health` já existe e não tem cara.
- **Quarta aba**, quando a de segurança encher (§4.1).

---

## §21 Fontes da pesquisa

- [OWASP Top 10:2025 — A09 Security Logging and Alerting Failures](https://owasp.org/Top10/2025/A09_2025-Security_Logging_and_Alerting_Failures/)
- [OWASP Cheat Sheet — Logging Vocabulary](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html)
- [OWASP Cheat Sheet — Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [Google SRE Book — Monitoring Distributed Systems (os quatro sinais de ouro)](https://sre.google/sre-book/monitoring-distributed-systems/)
- [Splunk — SRE Metrics and the Four Golden Signals](https://www.splunk.com/en_us/blog/learn/sre-metrics-four-golden-signals-of-monitoring.html)
- [Dagster — Data Quality Metrics](https://dagster.io/learn/data-quality-metrics)
- [Soda — 12 Data Quality Metrics](https://soda.io/blog/data-quality-metrics-12-examples)
- [OWASP Cheat Sheet — LLM Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- [Ibotta — Pipeline quality checks, circuit breakers e outros mecanismos de validação](https://medium.com/building-ibotta/pipeline-quality-checks-circuit-breakers-and-other-validation-mechanisms-761fc5b1ebe4)
- [Datadog — LLM guardrails: best practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [GitHub Docs — Secure use reference (fixar action em SHA, `permissions`)](https://docs.github.com/en/actions/reference/security/secure-use)
- [Wiz — Hardening GitHub Actions: lições de ataques recentes](https://www.wiz.io/blog/github-actions-security-guide)
- Referência visual: [Customer Insight Dashboard Design, no Behance](https://www.behance.net/gallery/254606029/Customer-Insight-Dashboard-Design)
