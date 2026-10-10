# Apresentação — Newra News (Portfólio)

> Material de apoio para apresentar o projeto em entrevistas, code reviews e
> portfólio. Complementa o README (o que o projeto é e como rodar) e o
> `docs/progress.md` (o histórico fase a fase); aqui o foco é o **pitch** e o
> **roteiro de apresentação**.
>
> Reescrito em **31/08/2026**, depois das Fases 0–12 da V2, e **atualizado em
> 10/10/2026** com o plano de observabilidade (Fases 1–13): o painel em três
> abas, os portões do pipeline, o batimento de fora, os números remedidos e os
> desafios novos. A versão de 16/08 descrevia a V1.

---

## Pitch (30 segundos)

> "Newra News é um portal de notícias que entrega um **briefing diário escrito
> por IA**: toda manhã um pipeline coleta centenas de matérias da NewsData.io e
> de onze feeds RSS, deduplica, classifica por categoria e usa o Gemini para
> escrever a síntese do dia em português — com as fontes citadas e o aviso de
> geração por IA na própria página. É um projeto fullstack completo — monorepo, API REST,
> frontend com ISR, CI/CD, observabilidade e deploy em produção — e o que ele
> demonstra de verdade não é a stack, é o **hábito de medir contra produção**:
> dos defeitos mais caros deste projeto, a maioria já estava no ar quando foi
> encontrada, e cada um virou uma guarda automatizada."

---

## Problema e solução

| | |
|---|---|
| **Problema** | Sobrecarga informacional: dezenas de portais, centenas de manchetes, pouco tempo para absorver. |
| **Solução** | Duas experiências: (1) **acervo de notícias** atualizado diariamente, navegável por categoria e busca; (2) **briefing do dia** escrito por IA, que contextualiza o cenário em poucos minutos e nomeia as matérias de onde saiu. |
| **Público** | Recrutadores e desenvolvedores que avaliam o portfólio; leitores que querem a síntese do dia sem abrir dez sites. |
| **Diferencial** | Confiança verificável: fontes nomeadas, data de geração visível, modelo declarado, e o material bruto a um clique. |

---

## Arquitetura (resumo)

```
Navegador
   │  HTTPS
   ▼
Vercel (Next.js 14 — SSG/ISR) ──► cron diário ──► API Route (CRON_SECRET)
   │                                                    │ 1. GET /api/health
   │  BFF (app/api/*)                                   │    acorda a instância
   │  Bearer JWT                                        │ 2. POST Bearer
   │                                                    │ 3. pede as páginas do dia
   ▼                                                    ▼    e confere o run nelas
                          Render (Fastify + TypeScript + Prisma)
                              │            │            │         │
                              ▼            ▼            ▼         ▼
                        NewsData.io   Gemini/Groq   PostgreSQL   Resend
                        + 11 feeds    (briefing      (Neon)      (newsletter)
                          RSS          do dia)
```

Não há keep-alive: a API dorme no plano free do Render, e quem precisa dela
quente acorda antes de chamar. Decisão medida — o ping de 5 em 5 minutos
consumia 744 h de uma cota de 750 h/mês e suspendeu a API por dois dias.

**De fora da stack**, um workflow do GitHub Actions (o Heartbeat, todo dia às
12:40 UTC) pergunta se o site, a API, o briefing de hoje, as duas Homes e o
login respondem — e a execução que reprova é o e-mail. É o mecanismo que
faltava nos três incidentes de agosto e setembro, todos descobertos por
acaso.

Seis diagramas Mermaid em [`docs/diagrams/`](diagrams/) — arquitetura do
sistema, mapa de rotas do frontend, fluxo de sessão, entidade-relacionamento,
sequência do pipeline e fluxo de dados.

### Decisões que valem destacar

- **Monorepo Turborepo + pnpm** — quatro packages compartilhados (`database`,
  `types`, `eslint-config`, `tsconfig`); tipagem única, sem duplicação entre
  os apps.
- **Pipeline de catorze etapas** — nove numeradas (coleta, normalização, dedup
  por URL, persistência, seleção das 15 mais recentes, geração por IA, artigo,
  cleanup aos 30 dias, métricas) mais cinco intercaladas: a **5.5**, o portão
  de entrada (volume contra a mediana de 7 dias, três fontes, um item de 24 h
  — ou o dia não gasta a chamada de IA), a **6.5**, o portão de saída (URL não
  ancorada e envelope vazado falham o dia sem fallback; idioma e teto caem
  para o Groq uma vez), a **7.5**, que envia a newsletter, a **8.5**, que
  **reaplica as regras de ingestão ao acervo já gravado**, e a **9.5**, que
  **confere as invariantes** — doze consultas agregadas perguntando se o que
  as etapas anteriores deveriam ter deixado está lá (retenção, um briefing por
  dia, run morto, métrica do dia, newsletter). A 8.5 é a que faz uma correção
  de regra valer para o passado — sem ela, consertar a ingestão só conserta o
  que entra a partir de amanhã.
- **Idempotência por dia** — o disparo do pipeline distingue `started`,
  `already-running` e `already-succeeded-today`, e o painel diz qual foi. Antes
  ele devolvia só o id, e a tela confirmava sucesso sem ter rodado nada.
- **IA com fallback automático** — Gemini principal, Groq de reserva; se os dois
  falham, o pipeline segue e só o briefing daquele dia não sai.
- **Resiliência de fontes** — NewsData.io mais 11 feeds RSS independentes,
  colhidos com `Promise.allSettled`: uma fonte fora do ar não derruba a coleta.
  E o sistema **lembra**: cada fonte grava uma linha por dia (`SourceHealth` —
  coletadas, novas, desfecho, latência, motivo), a falha rápida de rede ganha
  uma nova tentativa, e a `/admin/metrics` avisa a fonte em falha há três dias
  e a que está definhando.
- **ISR onde ela existe de fato** — as telas de leitura são estáticas, com
  `revalidate` de um dia, e o frescor vem do cron, que invalida as páginas do
  dia e confere que elas voltaram com o run novo. As duas de detalhe **não
  estavam** sendo guardadas até a Fase 11: sem `generateStaticParams`, o
  `export const revalidate` vale só para o cache de dados, nunca para o HTML.
  Hoje há guarda estática que reprova página com `revalidate` sem jeito de ser
  guardada.
- **Auth, i18n e admin** — OAuth Google/GitHub (next-auth v4 com JWT
  compartilhado web↔API), favoritos por usuário, site bilíngue pt-BR/en
  (next-intl, rotas `/pt-BR` e `/en`), painel de admin em três abas restrito a
  ADMIN.
- **Observabilidade como plano próprio** (`docs/Newra-News-Observability-Plan.md`,
  treze fases): log JSON com redação de segredo **pelo valor**, taxonomia de
  erro com `code` de conjunto fechado, um registro durável de falha que grava
  **uma linha por (fingerprint, hora)** — um 500 que dispara 10.000 vezes é uma
  linha com `count` —, o desfecho do run derivado dos eventos (`SUCCESS` deixou
  de mentir), as invariantes no fim de todo run, error boundaries que mostram o
  `digest` e o reportam, e a esteira com CodeQL, Dependabot, `pnpm audit` e
  actions fixadas em SHA. Tudo sobre o Postgres que já existia, sem serviço
  pago.

---

## Números reais

**Medidos em 10/10/2026, em execução local:**

- **Testes:** 2.553 em 194 suítes — 1.529 da API em 100, 1.024 do web em 94. A
  suíte não precisa de banco nem de rede, e `pnpm guard:mutations` quebra de
  propósito cada comportamento guardado para provar que a guarda reprova.
- **Cobertura:** API 98,63% stmts · 94,01% branch · 99,69% funcs; web 80,05% ·
  91,19% · 80,32%. Piso de 70% nos dois apps, com o CI reprovando abaixo.
- **E2E:** um arquivo de spec por fluxo — visitante, acervo, conta, newsletter
  e autorização —, rodando **contra produção** a cada push na `main`, não contra
  build local. Os fluxos com login ficam pulados por decisão (o segredo de
  sessão de produção não vai para o CI); o login é perguntado todo dia por uma
  sonda.

**Medidos em 10/10/2026, medianas de três execuções do Lighthouse CI:**

| Rota | Performance | LCP |
|---|---|---|
| `/pt-BR` | 95 | 2,87 s |
| `/news` | 92 | 2,95 s |
| `/article` | 94 | 2,88 s |
| `/about` | 96 | 2,72 s |
| `/en` | 93 | 2,72 s |
| `/news/[id]` | 96 | **2,42 s** |
| `/article/[date]` | 95 | 2,87 s |

Acessibilidade, boas práticas e SEO em **100** nas sete. O gate reprova abaixo
de 90 em qualquer das quatro categorias, pela mediana. A notícia é a única rota
com LCP abaixo de 2,5 s — o alvo da §31 do plano da V2 —, e a `/news` é a que
raspa o piso: o payload da listagem pesa no runtime do App Router, e há
gatilho escrito para quando ela cair abaixo de 90 em duas medições agendadas.

**Medido em 10/10/2026, no banco de produção:** **7.386 notícias** no acervo
(a janela de 30 dias), de **123 veículos** distintos; **77 briefings** retidos.
De 01/10 a 09/10, **um briefing por dia, nove de nove**, com mediana de **548
matérias colhidas por dia** (409–574) — oito escritos pelo Gemini, um pelo
Groq. O comando que mede a higiene de texto do acervo é
`pnpm --filter @newranews/api archive:hygiene`.

---

## Stack e por quê

| Camada | Escolha | Motivo |
|---|---|---|
| Frontend | Next.js 14.2 + Tailwind 4 + Base UI + TanStack Query 5 | App Router com ISR, DX madura, ecossistema grande |
| Backend | Fastify 4 + Zod 3 + Prisma 5 | Leve e rápido no free tier, validação em runtime ponta a ponta, ORM type-safe |
| Banco | PostgreSQL 16 (Neon) | Serverless, gratuito, separado do backend — trocar de host não toca os dados |
| IA | Gemini 2.5-flash + Groq (fallback) | Qualidade em pt-BR, redundância e custo zero |
| Notícias | NewsData.io + 11 feeds RSS | Free tier amplo e independência de provedor |
| Infra | Vercel + Render + GitHub Actions | Deploy automático e sete workflows: CI, Gitleaks, CodeQL, Smoke E2E, Lighthouse, Migrate e Heartbeat |
| Observabilidade | pino 9 + tabelas próprias no Postgres | Sem serviço pago: o log vai para o stdout do Render e da Vercel, e o que precisa durar (falhas, auditoria, horas do plano, saúde por fonte) mora no banco que já existe, com expurgo por idade |

---

## Roteiro de apresentação (walkthrough)

1. **Abra a home** (<https://newra-news-web.vercel.app>) — o briefing do dia em
   destaque e o acervo abaixo.
2. **Mostre a listagem** `/news` — filtros por categoria com contagem por
   faceta, busca, paginação com o estado na URL.
3. **Abra o briefing do dia** — fontes citadas, aviso de geração por IA, data de
   geração e modelo declarados.
4. **Troque o idioma** no masthead — as rotas `/pt-BR` e `/en` são geradas
   estaticamente por idioma, com metadados localizados.
5. **Explore o código** nesta ordem:
   `docs/diagrams/system-architecture.mermaid` →
   `apps/api/src/services/pipeline.service.ts` (as catorze etapas) →
   `apps/api/src/services/pipeline-gates.service.ts` e
   `apps/api/src/providers/ai/output-guard.ts` (os dois portões) →
   `apps/api/src/providers/` (`newsdata`, `rss`, `gemini`, `groq`) →
   `apps/api/src/providers/news/feed-text.ts` (a separação de dek e corpo) →
   `apps/web/app/[locale]/page.tsx` (ISR) → `apps/web/lib/auth.ts` e
   `app/[locale]/signin` (OAuth) → `app/[locale]/admin` (as três abas).
6. **Fale de qualidade pelo que ela impede**, não pelo número: as guardas
   estáticas em `apps/web/tests/lib/` e `apps/api/tests/` existem uma a uma
   porque um defeito específico passou por elas antes — modo de renderização,
   tokens de design, matriz de estados, dependências de runtime, deriva da
   `docs/api.md`, a contagem de feeds, a costura BFF↔API e a matriz de
   autorização. E cada uma foi **vista reprovando**: `scripts/guard-mutations.mjs`
   guarda a quebra de propósito de cada uma, e o `pnpm guard:mutations` a
   reaplica.

---

## Os desafios que valem contar

Todos aconteceram, todos estão datados no `docs/progress.md`, e cada um virou
correção mergeada ou guarda no CI.

- **A conta que ninguém fez.** O keep-alive pingava a API a cada 5 min para ela
  não hibernar. O plano free do Render não cobra requisição — **cobra tempo de
  instância ligada**, 750 h/mês. Como 5 min < 15 min, o serviço nunca dormia:
  24 h × 31 dias = **744 h contra 750**, 0,8% de folga. Em 29/08 as horas
  acabaram e a API foi suspensa. O erro não foi ligar o keep-alive; foi nunca
  ter multiplicado. Desde 01/09 não há keep-alive nenhum — e a conta ainda não
  estava inteira: as 750 h são do **workspace**, que a API divide com outro
  serviço, e foi isso que a suspendeu de novo em 19/09. Hoje a `/admin` mostra
  as duas partes, com a projeção do mês.
- **`revalidate` que não revalidava.** Rota com segmento dinâmico e sem
  `generateStaticParams` é renderizada a cada requisição, e a linha
  `export const revalidate = 3600` no topo do arquivo passa a valer só para o
  cache de dados. Não há erro nem aviso — a tabela do build diz `ƒ` e o arquivo
  diz 3600. Medido em produção: `x-vercel-cache: MISS` nas três tentativas,
  enquanto a Home respondia `HIT` com `Age: 1491`.
- **Um token de espaçamento que apagou a navegação.** No Tailwind v4,
  `--spacing-block` gera o eixo de espaço inteiro — e `inline-<valor>` ali é
  `inline-size`. A folha ganhou **dois** `.inline-block` na mesma
  especificidade, e venceu o último: as quatro abas de `/account` mediam 33 px,
  com o texto vazando por cima do vizinho. A classe existia, o `display` era
  aplicado, e a largura vinha de outro lugar.
- **A correção de dado que quase apagou 5.635 matérias.** Metade do acervo chega
  com a matéria inteira no campo de subtítulo *e* no de corpo. Tratar "corpo
  igual ao dek" como corpo redundante teria descartado 5.635 corpos, o maior com
  33 mil caracteres. Só um ensaio contra produção pegou — um teste de unidade
  sobre caso inventado passava nas duas versões.
- **Um balde de rate limit para todos os leitores.** `request.ip` no Fastify não
  é o cliente sem `trustProxy`: é o peer do socket, que atrás do proxy do Render
  é o proxy. Três requisições com `X-Forwarded-For` diferentes consumiam o mesmo
  balde. Corrigido com `trustProxy: 1` — e não `true`, que confia na ponta
  esquerda da cadeia, escrita pelo cliente.
- **A 404 sem folha de estilo.** O Next prende o chunk de um `.css` à entrada
  que o importa, e o `_not-found` da raiz não passa pelo layout de idioma. A
  página que **todo endereço errado alcança** ia ao ar em Times New Roman.
  Importar o mesmo arquivo nos dois lugares não resolve: o Next deduplica.
- **O botão que confirmava sem ter feito.** O disparo do pipeline é idempotente
  por dia e devolvia só o id — com um run já concluído, a tela imprimia
  "Pipeline disparado com sucesso" e nada rodava. Resposta que não distingue
  "fiz" de "não precisei fazer" vira tela que mente.
- **O gate de segredo que varria zero commits, com ✅ verde.** O scan do
  Gitleaks no push usava `--no-merges --first-parent` — fixo no código da
  action —, e todo push de merge saía `0 commits scanned`. Quinze medições
  seguidas; a promoção de 09/10, refeita à mão, eram 15 commits. Hoje o push
  roda o binário (sha256 conferido) sobre o intervalo exato do push, e o resumo
  diz quantos commits entraram.
- **A métrica de leitura que media robôs.** O painel marcava 1.034 leituras
  até o fim contra **zero** aberturas. O cruzamento com produção mostrou que
  só 4% eram as nossas ferramentas: 1.015 sessões eram robôs que executam
  JavaScript, com os três limiares de rolagem disparados no mesmo segundo e
  nenhum outro evento — renderizar e sair. A leitura passou a contar só depois
  da primeira rolagem, e o denominador virou a tela vista, não o clique no
  card.
- **O aviso que publicava o link injetado.** O portão de saída do briefing
  distinguia "URL inventada" (bloqueia) de "URL que estava no material" (só
  avisa) — e o ensaio que mandava a ordem e o link no título de uma matéria
  mostrou o briefing com o link indo ao ar com um `WARN`. Copiar do material é
  justamente como a injeção chega. Hoje toda URL na saída bloqueia, e falha o
  dia **sem** tentar no segundo modelo: repetir o material envenenado em outro
  modelo é repetir o ataque.

---

## Possíveis perguntas (e direção da resposta)

- **"Por que Next.js + Fastify e não um framework só?"** — Frontend e backend
  desacoplados escalam e sobem independentemente, e mostram proficiência em REST
  puro, não só em server actions. O custo dessa escolha é real e está medido:
  os dois deploys disparam juntos no merge e **não terminam juntos**, e há uma
  classe de defeito que só existe nessa fresta — foi assim que a `/news` foi ao
  ar com as oito categorias zeradas. O smoke E2E existe para pegar exatamente
  isso.
- **"Como o briefing é gerado?"** — `config/ai-prompts.ts` define o prompt; o
  `ai.service` tenta Gemini e cai para Groq; a saída é validada. O prompt fixa
  um subconjunto fechado de Markdown, e a época dele é versionada — porque o
  que o modelo escreve **muda**: uma nota no código dizia, com razão na época,
  que o briefing só usava `###`; meses depois eram 60% com negrito, 20% com
  separador e 8% com listas, tudo aparecendo como caractere na tela.
- **"E se a API de notícias cair?"** — RSS é fonte independente e o
  `Promise.allSettled` isola a falha por fonte. A lição foi a Reuters: o
  domínio deixou de existir, `Promise.allSettled` descartava a rejeição em
  silêncio, e cada execução gastava uma resolução de DNS fadada a falhar sem
  ninguém ver. Hoje cada fonte grava uma linha por dia, e a tela diz há
  quantos dias ela está fora.
- **"Como você sabe que algo quebrou em produção?"** — Em agosto, não sabia:
  três incidentes (a API suspensa, um dia sem briefing, o event loop travado
  por 45 s) foram descobertos por acaso, e foi isso que abriu o plano de
  observabilidade. Hoje: o Heartbeat manda e-mail na mesma manhã; a
  `/admin/security` agrupa as falhas por fingerprint; e as invariantes
  perguntam todo dia se o que deveria ter acontecido aconteceu — a retenção
  que roda e não apaga, o dia sem briefing, o run morto.
- **"Como garante qualidade?"** — CI com lint, typecheck, 2.553 testes, piso de
  cobertura, `pnpm audit` e CodeQL; Lighthouse semanal com gate em 90 sobre
  sete rotas; smoke E2E contra produção a cada push na `main`; Gitleaks em todo
  PR e todo push. E a parte que importa mais: **cada defeito caro virou
  guarda, e cada guarda foi vista reprovando** — a suíte cresce na direção dos
  erros que este projeto de fato comete.
- **"O que você faria diferente?"** — Teria feito a multiplicação do plano
  gratuito antes de configurar o keep-alive, e teria posto o README sob alguma
  guarda desde o começo: ele foi o único documento sem CI, e acumulou cinco
  afirmações falsas — incluindo um endereço de Swagger que não existe em
  produção desde a Fase 9.
- **"Próximos passos?"** — A release final da V2 (a baseline visual
  recapturada, o `CHANGELOG.md` e a primeira tag), verificar o domínio no
  Resend para a newsletter alcançar assinantes reais, classificação de
  categoria por IA no lugar do classificador por palavra-chave (que tem teto de
  ~67%), opt-out de analytics na interface, e a subida para Next 15 e Fastify 5.
  O plano de observabilidade tem um item só aberto, com data.

---

## Links úteis

- **Produção:** <https://newra-news-web.vercel.app> (frontend) ·
  <https://newra-news-api.onrender.com> (API)
- **Contrato da API:** [`docs/api.md`](api.md) — guardado contra deriva por
  teste. A UI do Swagger existe **só em desenvolvimento**, em `/api/docs`: em
  produção ela não é registrada, e foi assim que `@fastify/static` saiu do
  processo.
- **Código:** monorepo no GitHub. O trabalho integra na **`dev`** por PR, e a
  **`main`** — o que está no ar — só recebe promoção `dev → main`; é esse merge
  que publica, aplica as migrations e roda o smoke contra produção.
- **Docs:** progresso fase a fase (`docs/progress.md`) · arquitetura
  (`docs/architecture.md`) · setup (`docs/setup.md`) · plano da V2
  (`docs/Newra-News-V2-Frontend-Redesign-Plan.md`) · plano de observabilidade
  (`docs/Newra-News-Observability-Plan.md`) e a matriz do ensaio de aceitação
  (`docs/observability-acceptance.md`) · decisões de design (`docs/v2/`)
