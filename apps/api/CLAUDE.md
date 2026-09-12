# Backend — Fastify API

## Arquitetura
- Fastify 4.x com TypeScript
- Padrão: routes → services → providers
- Routes: validação Zod + chamam services
- Services: lógica de negócio + acesso ao DB via Prisma
- Providers: clients de APIs externas organizados em subdiretórios

## Padrões de Código
- Cada rota em seu próprio arquivo com schema Zod adjacente
- Services são classes ou funções puras (sem dependência de Fastify)
- Providers organizados em `providers/news/` (NewsData.io, RSS) e `providers/ai/` (Gemini, Groq, ai-utils)
- Erros customizados em `src/utils/errors.ts` — ver "A taxonomia de erro" abaixo. **`code` é literal do tuple e nunca é interpolado**
- Logger em `src/utils/logger.ts` (pino) — ver "O log" abaixo. **`console.*` é erro de lint na API**
- Plugins registrados em src/plugins/

## Rotas
- GET /api/health — healthcheck (keep-alive)
- GET /api/news — listar notícias (paginado; filtros: categoria, busca, dia
  exato, período `from`/`to`, fonte; `sort` = `recent` | `oldest`)
- GET /api/news/facets — contagem por categoria e por fonte do recorte atual,
  para o `category-nav` e o filtro de fonte da `/news` (§7 do plano V2)
- GET /api/news/:id — notícia por ID
- GET /api/news/:id/related — relacionadas (mesma categoria em ±72h, com 2 níveis de fallback)
- GET /api/home — resposta agregada da Home da V2 (hero, briefing, top, trending, categorias, latest)
- GET /api/trending — etapa 1: recência (meia-vida 12h) + favoritos × 2
- GET /api/articles — listar artigos (com os campos de auditoria, sem `sources`)
- GET /api/articles/:date — artigo por data (YYYY-MM-DD) + `sources`
- GET /api/articles/latest — artigo mais recente + `sources`
- POST /api/jobs/daily-pipeline — trigger do pipeline (Bearer token, rate limit: 20 req/min)
- POST /api/jobs/renormalize-news — a mesma renormalização da etapa 8.5, sob
  demanda (Bearer `JOB_SECRET`). **O pipeline já faz isso todo dia** — esta rota
  serve para *inspecionar* (`dryRun`, o padrão, devolve o relatório sem gravar)
  e para casos pontuais, não é o mecanismo. Corpo: `dryRun`, `limit`, `sources`,
  `categoryMode` (`clear-only` por padrão)
- GET /api/jobs/:pipelineId — status de execução do pipeline (**Bearer `JOB_SECRET`**;
  era pública e devolvia a mensagem crua da falha — Fase 9)
- GET /api/metrics/weekly — métricas agregadas dos últimos 7 dias
- GET /api/metrics/monthly — métricas do mês completo
- GET /api/metrics/dashboard — **admin (JWT + role ADMIN)**: hoje + última semana + último mês
- GET /api/metrics/product — **admin**: métricas de **produto** (`ProductEvent`)
  — audiência, leitura, cliques por origem, categorias e buscas sem resultado.
  `days` de 1 a 90 (o teto é a retenção do evento cru)
- GET /api/metrics/http — **admin**: error rate, taxa de 4xx e latência
  (p50/p95/p99/max) do processo que está no ar, mais a lista por rota. As duas
  métricas técnicas da §26, que até a Fase 9 ninguém produzia. **Em memória** —
  ver "Observabilidade da API" abaixo
- POST /api/auth/upsert — cria o usuário no primeiro sign-in. Exige JWT com
  `purpose: "auth-upsert"`, e é a **única** rota que o aceita
- POST /api/events — ingestão de eventos de produto (**pública e anônima**,
  lote de 1 a 20, rate limit 30/min). Ver "Eventos de produto" abaixo
- GET /api/admin/pipeline/runs — **admin (JWT + role ADMIN)**: os últimos runs
  do pipeline + os que falharam, com os mesmos filtros do `/api/dev/logs`
  (`status`, `since`, `limit`). **Mesma consulta e mesmo schema** — o que muda é
  a porta: sessão em vez de segredo. Fase 2 do plano de observabilidade
- GET /api/admin/pipeline/runs/:pipelineId — **admin**: o run com os eventos por
  etapa. **Tudo sob `/api/admin` é admin-only por construção** — `authPlugin` e
  `requireAdmin` registram uma vez no grupo, e há guarda enumerando o roteador
- GET /api/dev/logs — observabilidade dev-only (JOB_SECRET): últimos runs + erros recentes (filtros status/since/limit)
- GET /api/dev/logs/:pipelineId — detalhe completo do run com eventos por etapa
- GET /dev/dashboard — página HTML dev-only: runs, erros e status dos providers.
  **`?secret=` saiu na Fase 9** — segredo em query string entra em log de acesso,
  histórico e `Referer`. Entra por `Authorization: Bearer` (curl) ou por
  `POST /dev/dashboard/session` (o formulário da página), que devolve um cookie
  `HttpOnly` com uma **assinatura de prazo**, nunca o segredo

## O prefixo `/api/admin` (Fase 2 do plano de observabilidade)

**A garantia é do grupo, não da rota.** `routes/admin/pipeline.ts` registra o
`authPlugin` e um `preHandler` com `requireAdmin` uma vez; toda rota do grupo
nasce protegida sem ninguém lembrar de repetir a linha. É o gêmeo, do lado da
API, do que o `admin/layout.tsx` faz do lado do web — e tem guarda:
`authorization-matrix.test.ts` enumera o `printRoutes()`, filtra o prefixo e
cobra `access: 'admin'` de cada linha, com uma asserção separada exigindo que o
filtro encontre alguma coisa.

- **`authPlugin` não encapsula**, e é isso que faz o hook alcançar as rotas do
  arquivo: o `fp()` do export default marca a própria função com
  `skip-override`, então `await app.register(authPlugin)` acrescenta o
  `preHandler` ao contexto de quem chamou. Mesmo desenho do
  `routes/metrics/admin.ts`, onde `/weekly` e `/monthly` seguem públicas porque
  moram em outro `register`.
- **O `/api/dev/*` continua atrás do `JOB_SECRET`, de propósito.** Acesso por
  segredo é o caminho que funciona **quando não há sessão** — e isso importa
  mais justamente quando o que quebrou é o provedor de sessão. As duas portas
  dão na mesma consulta (`getDevLogs`) e devolvem o mesmo schema; há teste
  comparando os dois corpos, para que "duas portas, um contrato" seja algo que
  reprova e não um comentário.
- **`devLogsResponseSchema` deixou de ser exceção no `shared-type-contract`.**
  Enquanto só o painel dev o lia, o motivo escrito era `'painel dev, fora do
  produto'`; no instante em que uma tela do produto passou a ler aquele shape, o
  motivo deixou de ser verdade. Os tipos estão em `packages/types/src/pipeline.ts`
  e o `assertContract` mora ao lado dos schemas.

## Editorial (V2)
- Serviços em `services/{home,trending,related}.service.ts`, mapper compartilhado
  em `services/editorial.mapper.ts` (`News` → `EditorialStory`)
- **A ponte entre os dois enums `Category`** (Prisma e `packages/types`) mora no
  mapper, uma vez só — são idênticos em membros e nominalmente distintos para o
  TypeScript
- **`Cache-Control` só existe nestas rotas**, via `utils/cache.ts`. É header por
  rota e não hook global de propósito: um hook aplicaria política às rotas
  autenticadas, e `s-maxage` num proxy compartilhado ali seria vazamento entre
  sessões
- `getHome` não repete notícia entre blocos — a precedência resolve a disputa e
  o bloco perdedor desce o próprio ranking até preencher

## Artigo: o schema de resposta é o contrato

**O que não está no schema Zod não existe para quem consome**, por mais que o
serviço o carregue. O `article.service` lia os campos de auditoria e a lista de
fontes desde a Fase 0.5, mas `articleItemSchema` era o da V1 e o
`fastify-type-provider-zod` serializa pelo schema: `generatedAt`,
`promptVersion`, `modelVersion`, `status` e `sources` iam do banco para o lixo
na saída. A `docs/api.md` já descrevia o comportamento certo, então nada
denunciava a divergência. Ao mexer no `select` de um serviço, confira o schema.

- **`sources` só nos endpoints de detalhe** (`/:date` e `/latest`). Na listagem
  seriam ~15 linhas por artigo × 10 por página, sem nada as exibindo.
- **`position` é 0-based** — é o índice do `map` sobre as selecionadas. Numerar
  a lista na tela pede `position + 1`.
- **Os campos de fonte são cópias, não join.** O cleanup apaga `News` aos 30
  dias e o artigo vive 90; um join deixaria dois terços dos briefings retidos
  sem lista de fontes. Daí `newsId` ser ponteiro fraco.
- **Nulo é o estado normal** dos três campos de auditoria nos artigos anteriores
  à migration de 20/08 — a tela precisa desenhar sem a seção de transparência.

## Facetas do acervo (Fase 4)

- **Cada faceta ignora a própria dimensão.** A contagem por categoria não aplica
  o filtro de categoria — senão a escolhida mostraria o seu número e as outras
  sete zerariam, que é justamente a informação que faz alguém trocar. O mesmo
  vale para fonte. Busca e período valem para as duas: restringem o universo do
  qual se escolhe.
- **`buildNewsWhere` é compartilhado** entre listagem e facetas, com um `omit`
  para a dimensão contada. Montar o predicado duas vezes daria números que não
  batem com a lista logo abaixo deles, e os dois lados renderizam sem reclamar.
- **A rota não devolve um total do recorte.** Esse número é o `meta.total` da
  listagem, da mesma consulta que trouxe as matérias visíveis; um segundo total
  por outro caminho discorda do primeiro enquanto um dos dois está no ar.
- `/facets` é segmento literal e o roteador do Fastify o prioriza sobre `/:id`,
  que exige UUID e devolveria 400.
- Tem `Cache-Control` editorial: as facetas não mudam ao virar a página, então
  ficam fora da listagem para não recalcular dois `groupBy` a cada paginação.

## Pipeline Diário (10 etapas)
Coleta → Normalização → Deduplicação → Persistência →
Seleção → Geração IA → Persistência Artigo → Newsletter → Cleanup →
**Renormalização** → Métricas

Cleanup: News >30 dias, PipelineLogs >30 dias, Articles >90 dias,
**ProductEvents >90 dias** (por `occurredAt`) e **ErrorEvents >14 dias** (por
`windowStart`)

**A etapa 8.5 (renormalização) é o que faz uma correção de regra alcançar o que
já está gravado.** Consertar a ingestão só conserta o que entra; sem ela, uma
regra corrigida hoje levaria 30 dias para aparecer inteira, porque é quando o
cleanup apaga as linhas antigas. Rodando todo dia, o acervo converge sozinho no
dia seguinte a qualquer mudança de regra — sem ninguém lembrar de disparar nada.
Vem **depois** do cleanup de propósito: renormalizar linha que acabou de ser
apagada é trabalho jogado fora. É idempotente, então em regime ela varre e não
escreve nada.

## Ingestão: higiene de texto e categoria

Regras que não são óbvias no código, e que custaram uma Home errada em produção
e meio acervo com HTML na tela:

- **O texto do feed é limpo na entrada, em `providers/news/feed-text.ts`.** O
  que chega em `title`/`description` não é o que os nomes sugerem: título com
  quebra de linha literal, e `description` que abre repetindo o título, depois
  o crédito da foto, e só então o corpo. Limpar na ingestão é o único lugar
  onde se conserta uma vez — o campo alimenta o `dek` do contrato editorial, o
  resumo dos cards e o texto que o classificador lê.
- **O `content` também passa por lá desde a Fase 12, e antes não passava por
  nada.** Medido contra as 6.669 linhas de produção em 25/08: **63,7% com tag
  HTML**, **51,9% abrindo com um `<img>`** que a tela imprimia como texto, 5,5%
  terminando no rodapé de WordPress, 7,3% com o aviso de paywall do Valor, e
  **158 linhas — a ESPN inteira — com a palavra `null`**. `htmlToText` preserva
  o parágrafo (achatar tudo entrega um bloco de três mil caracteres);
  `stripPublisherBoilerplate` tira só o que o CMS injeta, nunca "leia mais", que
  é texto de repórter.
- **`description` é subtítulo e `content` é corpo — e o feed não sabe disso.**
  Metade do acervo manda **a matéria inteira nos dois campos** (G1, Folha,
  Valor, BBC, Trivela) e outra parte manda **a mesma frase única nos dois**
  (TechCrunch). O dek tinha **mediana de 594 caracteres e máximo de 33.073**.
  Quem separa é `splitDekAndBody`: texto longo repetido vira **corpo**, o dek
  vira a abertura dele (teto de 320, cortado em fronteira de parágrafo ou de
  frase), e `content: null` passa a significar "não há corpo além do subtítulo"
  — o que vale para 40% do acervo e a tela sabe desenhar.
- **Tratar "corpo igual ao dek" como corpo redundante descartaria 5.635
  matérias.** Foi a primeira versão da correção, e só um ensaio contra produção
  a pegou: o maior texto descartado tinha 33.073 caracteres. **Correção de dado
  se ensaia contra o acervo real antes de mergear** — teste de unidade sobre
  caso inventado passa nas duas versões.
- **O classificador lê o texto inteiro, nunca o dek recortado.** O piso de 5
  palavras distintas foi calibrado contra o corpo; alimentá-lo com 320
  caracteres mudaria a categoria de metade do acervo sem que nada acusasse. No
  renormalizador isso é `body ?? dek`, que é o texto inteiro nas duas passadas.
- **Palavra-chave de categoria tem de dizer do que a matéria _trata_, não como
  ela foi apurada.** `redes sociais`, `celular`, `internet`, `programacao`
  (grade de atrações!), `empresa`, `fundo`, `clube` e `ia` (`ia` casa o
  imperfeito de "ir") aparecem em qualquer pauta e classificaram matéria
  policial como Tecnologia. O classificador tem três defesas: teto de 2
  ocorrências por palavra, piso de **5 palavras distintas** para a descrição
  decidir sozinha (o número saiu de medição — ver abaixo), e **título vence
  corpo em empate**, porque a ordem de `CATEGORY_PRIORITY` só decide entre
  iguais.
- **Corrigir a ingestão só conserta o que entra.** Quem repara o que já está
  gravado é `services/news-renormalizer.service.ts`, chamado pela etapa 8.5 do
  pipeline, e ele faz as três coisas **na mesma ordem da ingestão** —
  decodifica, higieniza, e só então classifica. Reclassificar sobre a descrição
  suja daria um resultado diferente do que a mesma matéria teria se entrasse
  hoje.
- **O teto do classificador por palavra-chave é ~67%.** Medido em 21/08 com dez
  regras candidatas contra 3.688 linhas e um gabarito de 24 decisões conferidas
  à mão. O piso de 5 palavras distintas é o melhor desse conjunto (o anterior,
  de 3, dava 54%). A hipótese do "lide" — ler só os primeiros 600–800
  caracteres — foi medida e **perdeu**. Passar de 67% pede classificação por IA,
  não mais ajuste de piso.
- **Há dois recortes no renormalizador, e não são o mesmo.** A **varredura** é
  o acervo inteiro desde a Fase 12; a **reclassificação** continua restrita a
  `CLASSIFIER_OWNED_SOURCES`, derivado das fontes sem `category` fixa em
  `rss-sources.ts`. Fonte com categoria fixa teve a categoria escolhida pela
  configuração; recalcular ali destrói dado correto. O filtro antigo valia para
  a varredura inteira, e o HTML cru estava justamente nas fontes de categoria
  fixa que ele excluía — InfoMoney, Olhar Digital e Drauzio Varella com **100%
  do corpo em HTML**.
- **Tirar rótulo é seguro; pôr rótulo, não.** Medido contra as 3.688 linhas do
  acervo de produção: 320 demoções (rótulo → `WORLD`), todas certas na amostra,
  e 1.240 promoções, erradas perto de metade das vezes — corpo de milhares de
  caracteres cita "prefeitura" ou "festival" de passagem e limpa o piso. Por
  isso `categoryMode` é `clear-only` por padrão. Subir para `all` só faz sentido
  quando a classificação passar do teto de ~67%, o que pede IA e não mais ajuste
  de piso.
- **A categoria gravada no acervo não é o que nenhum dos dois classificadores
  produz.** O antigo, rodado hoje sobre o texto gravado, concorda com o banco em
  38% dos casos, e 83% do acervo está em `WORLD`. A ingestão classificava o
  texto **antes** de decodificar entidades, então o classificador era cego a
  toda palavra acentuada (`pol&iacute;tica`, `sa&uacute;de`). É por isso que
  comparar o classificador novo com o que está gravado mede dois bugs de uma
  vez, e não só a mudança de regra.
- **A normalização precisa ser ponto fixo.** `decodeEntities` decodifica até
  convergir (teto de 3 passadas) porque o acervo tem escape duplo
  (`&amp;eacute;`); enquanto parava na primeira, o job reescrevia as mesmas
  linhas em toda execução. **A separação dek/corpo tem a mesma exigência**, e
  foi verificada contra as 6.669 linhas: zero mudam na segunda passada.
- **`WORLD` é o balde genérico, e é onde matéria de polícia e trânsito deve
  cair.** Não há categoria para esse gênero no enum, e forçá-lo em outra é
  exatamente o defeito que foi corrigido.

## Eventos de produto (pré-requisito da Fase 8)

A camada de analytics da parte 1 de `docs/v2/04-analytics-e-slots.md`. Este PR
entrega **só o banco e a API** — a camada `track()`, o consentimento e a
instrumentação vêm depois.

| Peça | Papel |
|---|---|
| `packages/types/src/analytics.ts` | o catálogo dos 14 eventos e os vocabulários fechados |
| `routes/events/schemas.ts` | a união discriminada em Zod + a guarda contra deriva |
| `services/product-event.service.ts` | gravação em lote e o expurgo por idade |
| `model ProductEvent` | uma tabela, `payload` em `Json` |

Regras que não são óbvias no código:

- **O vocabulário mora em `packages/types`, não aqui e não no web.** A API valida
  o mesmo conjunto que o web escreve; um `source` novo declarado só de um lado
  passaria pelo build dos dois e viraria 400 em produção.
- **`SchemaMatchesSharedType` é uma guarda de compilação, e ela já pagou.** Na
  primeira execução ela reprovou o `z.nativeEnum(Category)` importado do Prisma:
  aquele `Category` é união de literais e o de `packages/types` é um `enum` TS,
  que é nominal. Aqui não há ponte a fazer — o valor vai para o `payload` JSON,
  nunca para uma coluna enum —, então o schema valida contra o enum
  compartilhado. A ponte entre os dois continua onde sempre esteve, no
  `editorial.mapper`.
- **`discriminatedUnion` e não `union`.** Com ela o Zod escolhe o ramo pelo
  `type` e devolve o erro do campo que faltou; um `union` simples devolveria os
  catorze erros de uma vez.
- **`path` recusa query string.** A query carrega o termo de busca, que tem
  regra de higiene própria — deixá-lo entrar por ali seria a mesma informação
  por uma porta sem porteiro.
- **`type` é coluna e o resto é `Json`.** Toda métrica filtra por tipo numa
  janela de tempo (`@@index([type, occurredAt])`); catorze formatos em colunas
  seriam vinte campos nulos ou catorze tabelas.
- **Sem `skipDuplicates`.** Não há chave única para colidir, e dois `story_open`
  idênticos em segundos são dois cliques — descartar o segundo apagaria a
  diferença entre "clicou uma vez" e "voltou e clicou de novo".
- **A resposta diz quantos entraram.** `{ ok: true }` não deixaria descobrir que
  metade do lote sumiu.
- **A retenção é etapa 8, não etapa nova.** É o mesmo expurgo por idade que a
  notícia e o briefing já fazem. Etapa própria seria um segundo lugar para
  lembrar de olhar quando algo parasse — e ingestão sem expurgo é tabela que
  cresce para sempre. Corta por `occurredAt`, não `createdAt`: o que a §4 limita
  é há quanto tempo o comportamento aconteceu, não quando a linha chegou.
- **`sessions` não mede recorrência, e não dá para consertar.** O `sessionId`
  morre ao fechar a aba — é o que mantém a medição anônima. Quem mede audiência
  recorrente são `Subscriber` e `User`, que a `/metrics/product` lê à parte.
- **A agregação é em memória, a partir de uma consulta só.** SQL cru com
  operadores de JSON é o que menos se testa; seis `groupBy` são seis idas ao
  banco para uma tela. Mesma dívida consciente da `/api/favorites`, e a Fase 9
  deu o número que faltava: **~200.000 linhas na janela de 90 dias** (≈60 MB de
  objetos numa requisição, num plano de 512 MB) — a ~4 eventos por pageview,
  **~550 pageviews/dia**. Aí vira agregação em SQL.
- **Não há tabela de agregado diário, e é de propósito.** A §4 pede um agregado
  que sobreviva à retenção, mas hoje ninguém o leria — tabela sem consumidor é
  a armadilha da pílula de contagem da Fase 4 em outra forma. Ela entra com a
  tela que a exibir.

## Segurança do servidor (revisão da Fase 9)

Sete achados, sete guardas. O que está abaixo é o que **não** é óbvio lendo o
código corrigido — o motivo pelo qual ele está daquele jeito.

- **`trustProxy: 1` no `buildApp`, e é `1` e não `true`.** Sem `trustProxy`,
  `request.ip` é o peer do socket; atrás do proxy do Render, o proxy. Medido em
  produção: três requisições com `X-Forwarded-For` diferentes na mesma janela
  consumiram o **mesmo** balde (98/97/96). Como todo o tráfego server-side sai
  da Vercel, o teto de 30/min da `/api/events` era teto **global** de ingestão.
  `true` confiaria na ponta esquerda do XFF, que o cliente escreve — trocar por
  `true` reabre o buraco por outro lado.
- **A CSP global é `default-src 'none'`**, que é a que cabe num JSON. **Não
  afrouxe o global para caber uma página**: foi assim que o projeto ficou com
  `contentSecurityPolicy: false`. A única página HTML (`/dev/dashboard`) declara
  a sua por resposta, com nonce, e a UI do Swagger tem a dela sob o prefixo.
- **A UI do Swagger não é registrada em produção.** O documento OpenAPI continua
  sendo gerado sempre (é dele que as guardas leem); o que sai é a UI. Isso
  também tira `@fastify/static` — e as duas advisories **high** dele — do
  processo em produção. O `servers` sai de `API_PUBLIC_URL`; sem ele, anunciava
  `http://0.0.0.0:3001`.
- **O `purpose` do JWT é conferido no plugin, e é simétrico.** `authPlugin()`
  recusa token que traga `purpose`; `authPlugin(app, { purpose: 'auth-upsert' })`
  recusa o de sessão. Conferir `purpose` dentro de um handler é o que havia
  antes, e escopo que só uma rota honra não é escopo.
- **O 5xx não conta o interior do servidor.** `AppError` fala (o servidor
  escolheu aquela mensagem) e o 4xx do Fastify fala (descreve a requisição de
  quem chamou); o 5xx devolve frase fixa mais `x-request-id`, e o erro inteiro
  vai para o log. Erro de Prisma carrega nome de tabela, trecho de SQL e, em
  falha de conexão, a string de conexão.
- **`content-type` com caractere de controle é recusado com 415 na porta.**
  Mitigação de uma advisory **high** da `fastify@4` (bypass de validação de
  corpo por TAB no `Content-Type`), corrigida upstream só na `fastify@5`. Sai
  quando a major entrar.
- **`assertJobSecret` compara em tempo constante**, e é o **único** lugar que
  compara o `JOB_SECRET`. Havia três cópias inline; duas não passavam por aqui.

### A fronteira do prompt — o feed escreve no mesmo canal das instruções

**É o risco mais próprio deste produto**, porque a saída do modelo vai ao ar
sozinha: o Stage 7 persiste, o 7.5 manda e-mail aos assinantes, a Home exibe.
Nenhuma revisão humana no meio, e o material é escrito por terceiros — 12 feeds
RSS mais a NewsData.io, centenas de itens por dia.

Três camadas, e as três precisam continuar existindo:

1. **fronteira declarada** — o material vai entre `MATERIAL_START` e
   `MATERIAL_END`, e o system prompt manda tratar o que está entre eles como
   dado, nunca como instrução;
2. **o material não falsifica a fronteira** — `neutralizeMaterialDelimiters`
   troca um delimitador escrito dentro de um item, e a quebra de linha some (é
   com ela que se falsifica o rótulo de campo do item seguinte). É a única
   camada que trata *bypass*; as outras tratam persuasão;
3. **a saída fora do formato é recusada** — `parseMarkdownResponse` exige o
   `# ` e um corpo, e lança `MalformedArticleError`. Antes ela aceitava
   qualquer coisa: sem `# `, pegava a primeira linha não vazia como título.

- **O que a IA escreve também passa por higiene, e são dois campos só.**
  `parseMarkdownResponse` grava `title` e `summary` **sem marcador de ênfase**,
  e deriva o `summary` da primeira linha que é **prosa** — pulando régua, item
  de lista e rótulo de seção. O `content` fica intacto de propósito: é o único
  dos três que passa por renderizador na tela. Medido em 01/09/2026 nos 88
  briefings retidos: **34,1% dos títulos** e **21,6% dos subtítulos** com
  marcador, **19,3% dos títulos** abrindo com `**TÍTULO:**`, e **17,0% dos
  subtítulos** sendo só `Introdução:` ou `---`. Reprocessados com a regra nova,
  os 15 degenerados viram frase de abertura de verdade.
- **Isto conserta o e-mail da newsletter, que a web não alcança.**
  `newsletter.service.ts` lê `article.title` e `article.summary` direto do banco
  e escapa HTML antes de enviar — um `**` ali sai como asterisco na caixa de
  entrada de quem assina. A limpeza de exibição da web (`lib/markdown-text.ts`)
  cobre os 90 dias já gravados; esta cobre todo consumidor dos novos.

**O que a camada 2 deliberadamente não faz: filtrar frase suspeita.** Lista de
palavra proibida em texto jornalístico é falso positivo garantido — uma matéria
*sobre* injeção de prompt seria a primeira censurada — e não fecha nada, porque
a mesma ordem se escreve de mil maneiras. Há teste afirmando isso.

**`buildArticleUserPrompt` é o único lugar que monta o prompt.** Cada provider
fazia `ARTICLE_USER_PROMPT + formatNewsItems(items)` por conta própria; um
terceiro provider nasceria sem o fechamento do bloco, e material sem fechamento
segue até o fim do texto — a condição exata que a fronteira existe para impedir.

**O sufixo entra no hash de `ARTICLE_PROMPT_VERSION`.** Mexer na fronteira é
mudança de segurança, e dois briefings gerados sob regras diferentes precisam
ser distinguíveis pelo campo de auditoria que a §18.4 grava.

## O log (Fase 1 do plano de observabilidade)

`src/utils/logger.ts` — uma instância de pino, e todo o resto passa por ela.

- **`console.*` é erro de lint**, com **uma** exceção escrita: `config/env.ts`,
  que roda antes de o logger existir e termina em `process.exit(1)`. Guarda em
  `tests/security/secrets-in-logs.test.ts`, que também varre `src/` e recusa
  exceção sem motivo. **A varredura usa `ts.createSourceFile`, e não regex nem
  scanner de caracteres:** a primeira versão tratava aspas como delimitador de
  string e a aspa de um literal de regex (`.replace(/"/g, …)`) apagava 481
  linhas do `src/` — com um `console.warn` real passando verde dentro delas.
- **A fiação tem guarda própria**, em `server-hardening.test.ts`: o serializer
  correto não vale nada se o `buildApp` não o usar. Ela compara
  `app.log[pino.symbols.serializersSym].err` — porque `app.log` **não é** a
  instância passada, é um `child({ reqId })` dela.
- **O serializer de `err` é quem fecha o vazamento de segredo, não o `redact` do
  pino.** O `redact` trabalha por *caminho* (`req.headers.authorization`); a DSN
  do Prisma chega dentro de `err.message`, que é texto livre. Os dois são
  necessários e nenhum substitui o outro.
- **`redactSecrets` conhece o valor de cada segredo do ambiente**, e não só o
  formato — é isso que o tira da corrida armamentista de regex. O que sobrevive
  é diagnóstico de propósito: `name`, `code`, `statusCode`, o host da DSN e a
  palavra `Bearer`.
- **O serializer é lista de permissão.** Propriedade acrescentada a um erro não
  é serializada — o `primaryError` que o `ai.service` pendura na exceção do
  fallback seria um segundo erro sem passar por redação nenhuma.
- **Uma linha por requisição**, escrita pelo `onResponse` do
  `plugins/observability.ts`; o par padrão do Fastify está desligado
  (`disableRequestLogging: true`). O nível casa com o status, o que faz
  `LOG_LEVEL=warn` deixar no log só o que deu errado.
- **`pipelineLogId` em toda linha escrita durante um run**, por
  `AsyncLocalStorage` aberto em `runPipeline` e lido pelo `mixin` do pino —
  nenhuma função ganhou parâmetro. **Não há `reqId` no store**: quem tem
  requisição já escreve por `request.log`, cujo child logger o carrega.
- **O tipo do export é `FastifyBaseLogger`, e trocá-lo por `pino.Logger` quebra
  o build.** O tipo concreto fixa o parâmetro de logger do `FastifyInstance`, e
  toda função que recebe o app default (`registerDailyPipelineJob`, helpers de
  teste) deixa de casar. A suíte não vê; só o `tsc`.
- **O vocabulário de níveis mora em `config/env.ts`**, não aqui: é o schema quem
  valida, e o logger já importa aquele arquivo (o contrário seria ciclo). O
  `LogLevel` é derivado da tupla, nunca digitado de novo.
- **`LOG_LEVEL` não tem default no schema.** `utils/logger.ts` resolve a
  ausência para `info` **só** em `development` e `production`; qualquer outra
  coisa é `silent`. Escrito como `!== 'test'`, toda suíte que faz
  `vi.mock('../../src/config/env')` pela metade acordaria o logger em `info` e
  despejaria JSON no stdout do CI — medido, em duas suítes.

## A taxonomia de erro (Fase 3 do plano de observabilidade)

`src/utils/errors.ts` — `AppError` com `code`, `category`, `cause?` e
`context?`, e a decisão de nível de log num lugar só.

- **`code` é literal do tuple e nunca é interpolado.** Não é estilo: a Fase 4
  grava uma linha de `ErrorEvent` por `(fingerprint, hora)`, e enquanto o
  conjunto de códigos for finito a tabela tem teto qualquer que seja o tráfego.
  Um código montado com o id da notícia trocaria "uma linha por falha distinta"
  por "uma linha por notícia". **O corolário vale igual: código que ninguém
  lança não entra no tuple.** As duas metades têm guarda em
  `tests/utils/error-taxonomy.test.ts`, escrita com `ts.createSourceFile` —
  literal contra template é gramática, não texto.
- **O nível sai de `logLevelFor`, e a categoria vence o status.** 5xx é `error`;
  `authorization` é `warn` (o `authz_fail` do vocabulário do OWASP); o resto
  abaixo de 500 é `debug`, porque um 404 em `/news/:id` é resultado normal e
  afogaria o sinal. **A exceção é `internal`, que é `error` mesmo em 4xx** —
  `AUTH_NOT_CONFIGURED` é um 401 que recusa *todo* token e é configuração
  quebrada, não recusa; esta variável já falhou em silêncio em produção.
- **O `authPlugin` responde sem deixar o erro subir**, então o handler global
  nunca o vê. Ele chama `logAppError` antes de responder, e a resposta continua
  **uniforme** (`Invalid or missing token` para as três causas): quem chamou não
  precisa saber qual porta bateu; quem separa é o `code`, do lado de dentro.
  Corolário para quem for mexer no handler central: procure antes as saídas
  laterais — `preHandler`, `onRequest`, `setNotFoundHandler`, o hook de
  `content-type`.
- **O contrato do fio não muda.** `errorResponseSchema` continua `{ error }`;
  `code` no corpo seria campo em `ApiError` que nenhuma tela lê. Gatilho para
  reverter: a primeira tela que ramifique por qual falha foi.
- **`setNotFoundHandler` existe pela `docs/api.md`, não pela métrica.** A rota
  continua sendo `unmatched` no mapa do `observability.ts` (é o balde certo —
  senão o mapa ganha uma linha por endereço de robô). O que ele conserta é o
  corpo: o padrão do Fastify devolvia três campos e ecoava o caminho pedido, e
  era a única resposta de erro da API fora do contrato documentado.
- **O serializer de `err` é quem carrega a taxonomia para o log**, e desde esta
  fase ele também serializa o **`cause`, um nível e sem `stack`** — o undici
  lança `TypeError: fetch failed` e o `ECONNREFUSED` está só ali dentro (achado
  da Fase 7a). Um nível é o que mantém a lista de permissão de pé.
- **O `/dev/dashboard` é o único formulário de senha do produto, e agora deixa
  rastro.** Senha errada no `POST /dev/dashboard/session` escreve
  `DASHBOARD_SECRET_INVALID` em `warn` — antes era um **303 mudo**, e 303 < 400,
  então a linha de acesso o punha em `info` junto do tráfego normal. **O palpite
  não entra no log.** Abrir a página sem credencial nenhuma **não** loga: é o
  caminho normal, e uma linha por visita ensina a ignorar o log.
- **Defesa que dispara calada é defesa que ninguém sabe que disparou.** A
  recusa de `Content-Type` com caractere de controle (mitigação da GHSA da
  `fastify@4`) escreve `CONTENT_TYPE_REJECTED` em `warn`, e a categoria é
  `authorization` **porque o nível é o que importa**: `validation` sairia em
  `debug`, e produção roda em `LOG_LEVEL=info`. **O cabeçalho forjado não entra
  no log.**
- **`verifyAuthJwt` guarda a razão do jose no `cause`.** `JWTExpired`,
  `JWSSignatureVerificationFailed` e `JWSInvalid` pedem ações opostas — relógio,
  segredo divergente, cliente quebrado —, e a mensagem na resposta continua uma
  só, porque dizer qual foi ajuda quem está adivinhando.
- **`/api/health/providers`: o status responde "não deu", o log responde "por
  quê".** `invalid` colapsa chave recusada, provedor fora do ar e timeout; o
  `ProviderStatus` **não muda** (é contrato declarado, serializado por schema) e
  a razão vai para o log, com o nome do provider. **A URL da sonda nunca entra na
  linha** — ela carrega a chave, e depender do redator seria depender de ele
  conhecer aquele valor.
- **`app.inject()` não passa pelo parser HTTP, e isso já enganou uma guarda.**
  O `light-my-request` entrega o objeto de headers direto ao Fastify; o parser do
  Node **apara o espaço em branco do fim** do valor de um header. A guarda do
  `content-type` provava a defesa com `application/json<TAB>` — forma que o fio
  **nunca entrega**. Onde a coisa em teste é o tratamento de um header cru, teste
  por porta efêmera, não por `inject`. E note que **um status compartilhado por
  duas origens não prova de quem é a resposta**: o Fastify devolve 415 sozinho
  para aquele header, e o que distingue é a frase fixa do nosso hook contra a
  dele, que **ecoa o header forjado de volta**. Item 58 do `docs/progress.md`.
- **`ErrorContext` é `Record<string, escalar>` de propósito.** O `context` vai
  para o log e, na Fase 4, para uma coluna; objeto aninhado é como um segundo
  erro inteiro entra sem passar por redação nenhuma.

## O registro durável de falha (Fase 4 do plano de observabilidade)

`src/services/error-event.service.ts` e o `model ErrorEvent`. Fecha o buraco de
que **o único vestígio de um 500 era uma linha do stdout do Render** — que rola
para fora, não sobrevive a um deploy e não responde "isto já aconteceu antes?".

| Peça | Papel |
|---|---|
| `services/error-event.service.ts` | o buffer, o fingerprint, o flush e o expurgo |
| `plugins/error-events.ts` | o intervalo de 30 s e o flush no `onClose` |
| `utils/errors.ts` (`logAppError`) | a fiação do lado da API |
| `services/pipeline-event.service.ts` (`logPipelineEvent`) | a fiação do lado do pipeline |

Regras que não são óbvias no código:

- **`recordError` é síncrona por contrato, e há teste sobre a forma da função.**
  Ela muta um `Map` e retorna `undefined`. Escrever no banco dentro do
  tratamento de um erro *de banco* é falha auto-amplificante — e o dia em que
  ela virar `async`, alguém acrescenta um `await` no handler e põe a ida ao
  banco no caminho que já falhou.
- **Uma linha por `(fingerprint, hora)`**, com `count`. Um 500 que dispara
  10.000 vezes numa hora é uma linha: a tabela cresce com *falhas distintas ×
  24*, nunca com o tráfego.
- **O fingerprint é `origin:severity:code:route`**, e as quatro peças são de
  conjunto finito. A **severidade entrou na implementação**, fora do desenho: o
  pipeline registra a mesma etapa como `WARN` e como `ERROR`, e sem ela as duas
  colidiriam com a segunda apagando a gravidade da primeira.
- **`route` é escopo, não só rota**: o padrão da rota na API, `stage-8.5` no
  pipeline. URL crua ou id de recurso trocariam o teto por "uma linha por
  notícia" — há guarda pelo parser cobrando que nenhum `code` chegue interpolado
  ao `recordError`.
- **O nível decide o que vira linha, e `debug` não vira.** É `logLevelFor`
  outra vez: um 404 em `/news/:id` é resultado normal, e gravá-lo encheria a
  tela com a única falha que não é falha. **Gatilho para mudar:** a primeira vez
  que a pergunta for "que endereço estão pedindo e não existe?".
- **A fiação mora nos dois pontos únicos**, `logAppError` e `logPipelineEvent`,
  e não nos `catch`. Enumerar `catch` à mão é a forma de guarda que este projeto
  já viu falhar por omissão. **Exceção declarada:** o ramo do 500 cru no
  `app.ts`, que não passa por `logAppError` porque não é `AppError` — e é a
  falha mais grave que a API sabe produzir, então a chamada é explícita ali.
- **A mensagem e o `context` passam por `scrubMessage`/`scrubErrorContext`, do
  `utils/logger.ts`.** São as mesmas funções do serializer, e não uma cópia: o
  modo de falha de uma segunda cópia é a coluna vazar, de forma **durável**, o
  segredo que o log aprendeu a esconder.
- **O flush do `onClose` tem prazo (`ERROR_EVENT_CLOSE_TIMEOUT_MS`).** Esperar
  sem limite põe uma ida ao banco no caminho do desligamento, e a hora em que há
  erro acumulado é justamente a hora em que o banco é o suspeito. Medido ao
  escrever a fase: sem prazo, uma suíte de rota travou o `afterAll` em 10 s.
- **A falha do flush é escrita pelo `baseLogger` direto**, nunca por
  `logAppError` — aquele chama `recordError`, e o laço se fecharia exatamente
  quando o banco está fora. Há teste sobre isso.
- **`code` e `category` são texto no banco**, e o conjunto fechado mora em
  `utils/errors.ts`. Enum do Postgres cobraria uma migration por código novo, e
  cada fase seguinte do plano acrescenta pelo menos um.
- **`origin: WEB` e `origin: INVARIANT` ainda não têm produtor** — são das
  Fases 7b/7c e 6. O enum descreve o desenho; a coluna aceita o que existe hoje.
- **`pipelineLogId` vem do `AsyncLocalStorage`** que o `runPipeline` abre, e é o
  **último visto** dentro da janela. Por isso não é chave estrangeira: uma FK
  afirmaria um vínculo que o coalescimento torna falso, e impediria o expurgo do
  run.
- **A categoria de uma falha de etapa é inferida do provider**, porque os
  providers ainda lançam `Error` cru. **Gatilho para apagar a inferência:**
  converter `gemini`, `newsdata`, `resend` e o `pipeline.service` para
  `AppError` — a dívida que a Fase 3 deixou escrita. A *"Collection degraded"*
  da etapa 1 é `upstream` por construção: o provider mora dentro de cada
  `FetchWarning`, não no topo do `context`, e a primeira inferência a chamava de
  `internal`.
- **`code` é tipo, não `string`** — `RecordedErrorCode`, a união dos literais
  da taxonomia com as três constantes do service. Um `code` interpolado deixa
  de compilar; a guarda pelo parser continua porque enumera os call sites.
- **`pipelineLogId` é explícito quando quem chama sabe**, e `logPipelineEvent`
  sempre soube. O `AsyncLocalStorage` é reserva: o enterro do run morto roda
  fora do contexto do run, e pela reserva sozinha gravava `null`.
- **`routePatternOf` (`utils/request-route.ts`) é o único lugar que escreve
  `'unmatched'`.** O balde é chave no mapa de métricas e no `route` do
  `ErrorEvent`; havia seis cópias, e a guarda reprova a sétima.
- **Três falhas que não tinham registro, e agora têm:** o Gemini falhando com
  o Groq entregando (`WARN` da etapa 6 — o run continua `SUCCESS` e
  `pipelineErrors` não muda; "sucesso degradado" é da Fase 8); o `catch` final
  do pipeline quando o próprio `update` para `FAILED` falha (o evento vai para o
  buffer **antes** da ida ao banco); e o disparo interno do cron falhando antes
  de existir run (`stage-0`, a convenção para "o run inteiro").

## Observabilidade da API

`GET /api/metrics/http` (admin) e o `x-request-id` em toda resposta.

- **Nada é persistido, e é decisão.** A alternativa era uma escrita no Prisma
  por requisição para responder algo que se pergunta uma vez por semana — a
  armadilha da tabela sem leitor, de novo. **Gatilho para persistir:** mais de
  uma instância no Render, ou a primeira pergunta que exija comparar duas
  semanas.
- **`since` e `uptimeSeconds` não são enfeite.** A janela zera a cada deploy e a
  cada hibernação; sem eles, `errorRate: 0` logo depois de um deploy pareceria
  saúde e seria ausência de amostra.
- **A chave é o padrão da rota** (`GET /api/news/:id`), nunca a URL. URL crua
  seria uma linha por notícia e um mapa sem teto.
- **Os percentis vêm de histograma**, então são o **teto do balde** em que o
  percentil cai. O `max` é o valor real, e é ele que denuncia o cold start.
- **O `x-request-id` de quem chama é respeitado**, o que permite seguir uma
  requisição do BFF até aqui. O BFF ainda não o envia — costura da Fase 11.

## As guardas que enumeram a superfície

Três testes desta fase seguem o mesmo formato, e é o formato que impede buraco
novo: **enumeram a superfície e exigem decisão para cada item.**

| Guarda | Enumera | Exige |
|---|---|---|
| `tests/routes/api-docs-drift.test.ts` | as rotas do roteador | linha na `docs/api.md` |
| `tests/routes/response-schema-contract.test.ts` | as colunas do Prisma | campo no schema de resposta, ou motivo escrito |
| `tests/security/authorization-matrix.test.ts` | as rotas do roteador | linha na matriz de autorização |

**Cada uma tem uma asserção que segura as outras**: um parser que devolvesse
lista vazia faria a guarda passar para sempre, então há um teste afirmando que a
enumeração encontra algo. Ao copiar o padrão, copie essa parte também.

**Guarda sobre migration é estática** (lê o `.sql`, não aplica): a suíte roda
sem banco de propósito. O replay de verdade é manual, e o de 23/08 está no item
34 do `docs/progress.md`.

## Providers
```
providers/
├── types.ts          # RawNewsItem, GeneratedArticle
├── news/
│   ├── newsdata.provider.ts
│   └── rss.provider.ts
└── ai/
    ├── gemini.provider.ts
    ├── groq.provider.ts
    └── ai-utils.ts   # formatNewsItems, parseMarkdownResponse
```

## O artefato que o Render executa

`startCommand: node apps/api/dist/server.js`. **Node puro, sem loader e sem
resolvedor de TypeScript** — e é isso que separa este ambiente do `tsc` e do
Vitest.

- **Pacote do workspace importado em runtime precisa emitir JavaScript.** Import
  de `type` some na compilação; import de **valor** vira `require()` no `dist`.
  O `@newranews/types` apontava `main` para `./src/index.ts` e o servidor morria
  no boot — com `tsc` verde e a suíte inteira passando. Guarda em
  `tests/build/runtime-deps.test.ts`, e ela é **estática**: `turbo test` tem
  `dependsOn: ["^build"]`, que constrói as dependências e **não** o `apps/api` —
  uma guarda que dependesse do `dist` nunca rodaria no CI.
- **Boot quebrado não derruba a API: congela a versão anterior.** O Render
  reprova o health check e mantém a build antiga servindo, então o sintoma é
  "rota nova dá 404" e não "site fora do ar". Para saber o que está no ar,
  probe uma rota que só exista na versão nova.
- **Plano free hiberna com ~15 min sem tráfego.** O `uptime` do `/api/health`
  reflete o primeiro acesso depois do sono, não o último deploy.

## Testes
- Vitest com fastify.inject() para testes de rota
- Mocks para providers externos (NewsData, Gemini, Groq)
- Helper em tests/helpers/test-server.ts
- Cobertura: routes, services, providers, plugins, jobs
