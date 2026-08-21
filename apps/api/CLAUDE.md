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
- GET /api/news — listar notícias (paginado, filtro por categoria, busca, data)
- GET /api/news/:id — notícia por ID
- GET /api/news/:id/related — relacionadas (mesma categoria em ±72h, com 2 níveis de fallback)
- GET /api/home — resposta agregada da Home da V2 (hero, briefing, top, trending, categorias, latest)
- GET /api/trending — etapa 1: recência (meia-vida 12h) + favoritos × 2
- GET /api/articles — listar artigos
- GET /api/articles/:date — artigo por data (YYYY-MM-DD)
- GET /api/articles/latest — artigo mais recente
- POST /api/jobs/daily-pipeline — trigger do pipeline (Bearer token, rate limit: 20 req/min)
- POST /api/jobs/renormalize-news — a mesma renormalização da etapa 8.5, sob
  demanda (Bearer `JOB_SECRET`). **O pipeline já faz isso todo dia** — esta rota
  serve para *inspecionar* (`dryRun`, o padrão, devolve o relatório sem gravar)
  e para casos pontuais, não é o mecanismo. Corpo: `dryRun`, `limit`, `sources`,
  `categoryMode` (`clear-only` por padrão)
- GET /api/jobs/:pipelineId — status de execução do pipeline
- GET /api/metrics/weekly — métricas agregadas dos últimos 7 dias
- GET /api/metrics/monthly — métricas do mês completo
- GET /api/metrics/dashboard — **admin (JWT + role ADMIN)**: hoje + última semana + último mês
- GET /api/dev/logs — observabilidade dev-only (JOB_SECRET): últimos runs + erros recentes (filtros status/since/limit)
- GET /api/dev/logs/:pipelineId — detalhe completo do run com eventos por etapa
- GET /dev/dashboard — página HTML dev-only (JOB_SECRET via header ou `?secret=`): runs, erros e status dos providers

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

## Pipeline Diário (10 etapas)
Coleta → Normalização → Deduplicação → Persistência →
Seleção → Geração IA → Persistência Artigo → Newsletter → Cleanup →
**Renormalização** → Métricas

Cleanup: News >30 dias, PipelineLogs >30 dias, Articles >90 dias

**A etapa 8.5 (renormalização) é o que faz uma correção de regra alcançar o que
já está gravado.** Consertar a ingestão só conserta o que entra; sem ela, uma
regra corrigida hoje levaria 30 dias para aparecer inteira, porque é quando o
cleanup apaga as linhas antigas. Rodando todo dia, o acervo converge sozinho no
dia seguinte a qualquer mudança de regra — sem ninguém lembrar de disparar nada.
Vem **depois** do cleanup de propósito: renormalizar linha que acabou de ser
apagada é trabalho jogado fora. É idempotente, então em regime ela varre e não
escreve nada.

## Ingestão: higiene de texto e categoria

Duas regras que não são óbvias no código e custaram uma Home errada em produção:

- **O texto do feed é limpo na entrada, em `providers/news/feed-text.ts`.** O
  que chega em `title`/`description` não é o que os nomes sugerem: título com
  quebra de linha literal, e `description` que abre repetindo o título, depois
  o crédito da foto, e só então o corpo. Limpar na ingestão é o único lugar
  onde se conserta uma vez — o campo alimenta o `dek` do contrato editorial, o
  resumo dos cards e o texto que o classificador lê.
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
- **O recorte é `CLASSIFIER_OWNED_SOURCES`**, derivado das fontes sem
  `category` fixa em `rss-sources.ts`. Fonte com categoria fixa teve a
  categoria escolhida pela configuração; recalcular ali destrói dado correto.
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
  linhas em toda execução.
- **`WORLD` é o balde genérico, e é onde matéria de polícia e trânsito deve
  cair.** Não há categoria para esse gênero no enum, e forçá-lo em outra é
  exatamente o defeito que foi corrigido.

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

## Testes
- Vitest com fastify.inject() para testes de rota
- Mocks para providers externos (NewsData, Gemini, Groq)
- Helper em tests/helpers/test-server.ts
- Cobertura: routes, services, providers, plugins, jobs
