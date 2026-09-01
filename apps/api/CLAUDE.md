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
- Erros customizados em src/utils/errors.ts
- Logger via Fastify built-in (pino)
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
- GET /api/dev/logs — observabilidade dev-only (JOB_SECRET): últimos runs + erros recentes (filtros status/since/limit)
- GET /api/dev/logs/:pipelineId — detalhe completo do run com eventos por etapa
- GET /dev/dashboard — página HTML dev-only: runs, erros e status dos providers.
  **`?secret=` saiu na Fase 9** — segredo em query string entra em log de acesso,
  histórico e `Referer`. Entra por `Authorization: Bearer` (curl) ou por
  `POST /dev/dashboard/session` (o formulário da página), que devolve um cookie
  `HttpOnly` com uma **assinatura de prazo**, nunca o segredo

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
**ProductEvents >90 dias** (por `occurredAt`)

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
