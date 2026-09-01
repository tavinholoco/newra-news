# Apresentação — Newra News (Portfólio)

> Material de apoio para apresentar o projeto em entrevistas, code reviews e
> portfólio. Complementa o README (o que o projeto é e como rodar) e o
> `docs/progress.md` (o histórico fase a fase); aqui o foco é o **pitch** e o
> **roteiro de apresentação**.
>
> Reescrito em **31/08/2026**, depois das Fases 0–12 da V2. A versão anterior
> era de 16/08 e descrevia a V1 — o site foi inteiramente redesenhado a partir
> de 20/08.

---

## Pitch (30 segundos)

> "Newra News é um portal de notícias que entrega um **briefing diário escrito
> por IA**: toda manhã um pipeline coleta centenas de matérias da NewsData.io e
> de doze feeds RSS, deduplica, classifica por categoria e usa o Gemini para
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
   ▼                                                    ▼
                          Render (Fastify + TypeScript + Prisma)
                              │            │            │         │
                              ▼            ▼            ▼         ▼
                        NewsData.io   Gemini/Groq   PostgreSQL   Resend
                        + 12 feeds    (briefing      (Neon)      (newsletter)
                          RSS          do dia)
```

Não há keep-alive: a API dorme no plano free do Render, e quem precisa dela
quente acorda antes de chamar. Decisão medida — o ping de 5 em 5 minutos
consumia 744 h de uma cota de 750 h/mês e suspendeu a API por dois dias.

Seis diagramas Mermaid em [`docs/diagrams/`](diagrams/) — arquitetura do
sistema, mapa de rotas do frontend, fluxo de sessão, entidade-relacionamento,
sequência do pipeline e fluxo de dados.

### Decisões que valem destacar

- **Monorepo Turborepo + pnpm** — quatro packages compartilhados (`database`,
  `types`, `eslint-config`, `tsconfig`); tipagem única, sem duplicação entre
  os apps.
- **Pipeline de onze etapas** — nove numeradas (coleta, normalização, dedup por
  URL, persistência, seleção das 15 mais recentes, geração por IA, artigo,
  cleanup aos 30 dias, métricas) mais duas intercaladas: a **7.5**, que envia a
  newsletter, e a **8.5**, que **reaplica as regras de ingestão ao acervo já
  gravado**. A 8.5 é a que faz uma correção de regra valer para o passado —
  sem ela, consertar a ingestão só conserta o que entra a partir de amanhã.
- **Idempotência por dia** — o disparo do pipeline distingue `started`,
  `already-running` e `already-succeeded-today`, e o painel diz qual foi. Antes
  ele devolvia só o id, e a tela confirmava sucesso sem ter rodado nada.
- **IA com fallback automático** — Gemini principal, Groq de reserva; se os dois
  falham, o pipeline segue e só o briefing daquele dia não sai.
- **Resiliência de fontes** — NewsData.io mais 12 feeds RSS independentes,
  colhidos com `Promise.allSettled`: uma fonte fora do ar não derruba a coleta,
  e o provider emite aviso por fonte no log.
- **ISR onde ela existe de fato** — as telas de leitura são estáticas e
  revalidam de hora em hora. As duas de detalhe **não estavam** sendo guardadas
  até a Fase 11: sem `generateStaticParams`, o `export const revalidate` vale só
  para o cache de dados, nunca para o HTML. Hoje há guarda estática que reprova
  página com `revalidate` sem jeito de ser guardada.
- **Auth, i18n e admin** — OAuth Google/GitHub (next-auth v4 com JWT
  compartilhado web↔API), favoritos por usuário, site bilíngue pt-BR/en
  (next-intl, rotas `/pt-BR` e `/en`), painel de métricas restrito a ADMIN.

---

## Números reais

**Medidos em 31/08/2026, em execução local:**

- **Testes:** 1.409 em 127 suítes — 804 da API em 61, 605 do web em 66. A suíte
  não precisa de banco nem de rede.
- **Cobertura:** API 98,77% stmts · 92,96% branch · 99,49% funcs; web 72,79% ·
  89,59% · 72,43%. Piso de 70% nos dois apps, com o CI reprovando abaixo.
- **E2E:** 29 specs em 5 arquivos, rodando **contra produção** a cada push na
  `main`, não contra build local.

**Medidos em 24/08/2026, medianas de três execuções do Lighthouse CI:**

| Rota | Score |
|---|---|
| `/pt-BR` | 94 |
| `/news` | 92 |
| `/article` | 96 |
| `/about` | 97 |
| `/en` | 95 |
| `/news/[id]` | 97 |
| `/article/[date]` | 97 |

O gate reprova abaixo de 90 em qualquer das quatro categorias. As duas telas de
detalhe são as melhores do produto — efeito de a Fase 11 as ter tirado do render
por requisição — e o briefing tem **o único LCP abaixo de 2,5 s do conjunto
(2,42 s)**.

**Medido em 25/08/2026, contra o acervo de produção:** 6.669 notícias, oito
categorias preenchidas.

> **Por que não há número de volume diário aqui.** A API está suspensa desde
> 29/08 — as horas do plano free do Render acabaram — e volta no dia 1º.
> Medição de produção sem produção no ar é chute; este documento prefere a
> lacuna. O comando que refaz a medição do acervo é
> `pnpm --filter @newranews/api archive:hygiene`.

---

## Stack e por quê

| Camada | Escolha | Motivo |
|---|---|---|
| Frontend | Next.js 14.2 + Tailwind 4 + Base UI + TanStack Query 5 | App Router com ISR, DX madura, ecossistema grande |
| Backend | Fastify 4 + Zod 3 + Prisma 5 | Leve e rápido no free tier, validação em runtime ponta a ponta, ORM type-safe |
| Banco | PostgreSQL 16 (Neon) | Serverless, gratuito, separado do backend — trocar de host não toca os dados |
| IA | Gemini 2.5-flash + Groq (fallback) | Qualidade em pt-BR, redundância e custo zero |
| Notícias | NewsData.io + 12 feeds RSS | Free tier amplo e independência de provedor |
| Infra | Vercel + Render + GitHub Actions | Deploy automático e seis workflows: CI, Gitleaks, Smoke E2E, Lighthouse, Migrate e Keep-alive |

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
   `apps/api/src/services/pipeline.service.ts` (as onze etapas) →
   `apps/api/src/providers/` (`newsdata`, `rss`, `gemini`, `groq`) →
   `apps/api/src/providers/news/feed-text.ts` (a separação de dek e corpo) →
   `apps/web/app/[locale]/page.tsx` (ISR) → `apps/web/lib/auth.ts` e
   `app/[locale]/signin` (OAuth) → `app/[locale]/admin` (painel).
6. **Fale de qualidade pelo que ela impede**, não pelo número: as guardas
   estáticas em `apps/web/tests/lib/` e `apps/api/tests/` existem uma a uma
   porque um defeito específico passou por elas antes — modo de renderização,
   tokens de design, matriz de estados, dependências de runtime, deriva da
   `docs/api.md` e a contagem de feeds.

---

## Os desafios que valem contar

Todos aconteceram, todos estão datados no `docs/progress.md`, e cada um virou
correção mergeada ou guarda no CI.

- **A conta que ninguém fez.** O keep-alive pingava a API a cada 5 min para ela
  não hibernar. O plano free do Render não cobra requisição — **cobra tempo de
  instância ligada**, 750 h/mês. Como 5 min < 15 min, o serviço nunca dormia:
  24 h × 31 dias = **744 h contra 750**, 0,8% de folga. Em 29/08 as horas
  acabaram e a API foi suspensa. O erro não foi ligar o keep-alive; foi nunca
  ter multiplicado. Hoje ele é janelado (06:00–00:00 BRT), o que derruba o
  consumo para ~566 h.
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
  ninguém ver. Hoje há aviso por fonte no log.
- **"Como garante qualidade?"** — CI com lint, typecheck, 1.409 testes e piso de
  cobertura; Lighthouse semanal com gate em 90 sobre sete rotas; smoke E2E
  contra produção a cada push na `main`; Gitleaks. E a parte que importa mais:
  **cada defeito caro virou guarda**, então a suíte cresce na direção dos erros
  que este projeto de fato comete.
- **"O que você faria diferente?"** — Teria feito a multiplicação do plano
  gratuito antes de configurar o keep-alive, e teria posto o README sob alguma
  guarda desde o começo: ele foi o único documento sem CI, e acumulou cinco
  afirmações falsas — incluindo um endereço de Swagger que não existe em
  produção desde a Fase 9.
- **"Próximos passos?"** — A Fase 13 (ajustes finos e release final): verificar
  o domínio no Resend para a newsletter alcançar assinantes reais, classificação
  de categoria por IA no lugar do classificador por palavra-chave (que tem teto
  de ~67%), opt-out de analytics na interface, e a subida para Next 15 e
  Fastify 5.

---

## Links úteis

- **Produção:** <https://newra-news-web.vercel.app> (frontend) ·
  <https://newra-news-api.onrender.com> (API)
- **Contrato da API:** [`docs/api.md`](api.md) — guardado contra deriva por
  teste. A UI do Swagger existe **só em desenvolvimento**, em `/api/docs`: em
  produção ela não é registrada, e foi assim que `@fastify/static` saiu do
  processo.
- **Código:** monorepo no GitHub, e a **`main` é a fonte da verdade** — a branch
  `dev` está parada desde a V1.
- **Docs:** progresso fase a fase (`docs/progress.md`) · setup
  (`docs/setup.md`) · plano da V2
  (`docs/Newra-News-V2-Frontend-Redesign-Plan.md`) · decisões de design
  (`docs/v2/`)
