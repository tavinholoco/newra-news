# Plano de ação — o que a análise dos pipelines de 15/10 a 10/11/2026 achou

> **Origem:** análise pedida pelo dono em 10/11/2026 sobre os runs de produção
> (Neon), o log de CDN da Vercel, o GitHub Actions e sondas no site e na API.
> Escrito em 11/11/2026. **Nenhum item abaixo é escopo novo** — todo item é uma
> falha medida, com o número que a mostrou.
>
> **Regra da casa (§28 do plano V2):** todo achado sai como correção mergeada,
> guarda no CI, ou dívida com gatilho numérico. Cada PR entra na `dev`; a
> `main` só por promoção, que é do dono. Cada PR ganha um item no
> `docs/progress.md` (o último é o **104**).

## Veredito de partida

O pipeline entrega **um briefing por dia desde 22/10** (21/10 é o item 103,
já corrigido). Newsletter todo dia, invariantes sem violação desde 28/10,
nenhum `ErrorEvent` de API em 14 dias, coleta estável (~570 itens/dia).
**O que está errado é estrutural, e dois itens têm prazo:** as horas do
Render (agora) e o `gemini-2.5-flash` (01/12/2026).

## Os itens, por urgência

### P1 — 🔴 Robôs fora das matérias: GPTBot e Applebot · **decidido pelo dono em 11/11**

- **Falha:** a API do Render fica acordada **22–24 h/dia desde 02/11**
  (`DailyUptime`; eram 0,5–7 h até 25/10). **224,6 h em 10 dias de
  novembro**; só a API projeta ~685 h no mês, e o workspace tem 750 h
  divididas com o `NetsheetEngine`. É o caminho das suspensões de 29/08 e
  19/09. Causa medida no log de CDN de 12 h: **Applebot com 638 regenerações
  (MISS) de `/news/[id]`**, de 14 a 90 por hora, toda hora; **GPTBot com 754
  requisições numa rajada às 18 UTC**. Cada MISS chama a API. Tráfego humano
  ≈ 0 (1 `ProductEvent` humano desde 27/10).
- **Correção:** `apps/web/app/robots.ts` — o grupo do ClaudeBot passa a valer
  para os três (`userAgent: ['ClaudeBot', 'GPTBot', 'Applebot']`), com o
  mesmo `disallow` (otimizador de imagem + `/{locale}/news/`). O comentário
  ganha a data e os números de 10/11.
- **Guarda:** `apps/web/tests/lib/robots.test.ts` — cada um dos três fora de
  `/pt-BR/news/` e `/en/news/` e do otimizador; a listagem `/pt-BR/news`
  continua aberta; o grupo `*` não muda.
- **Promoção:** **urgente e sozinha** — cada dia custa ~23 h do Render.
  Promover é deploy novo, e o cache da ISR é por deploy: conferir antes o
  Usage de ISR Writes da Vercel (item D2 abaixo).
- **Como saber que funcionou:** `robots.txt` em produção com os três; log de
  CDN 48 h depois sem Applebot/GPTBot em `/news/` (`vercel logs requests
  --scope tavinholocos-projects --project newra-news-web --since 12h --json`);
  **`DailyUptime` abaixo de 10 h/dia em até 3 dias**. Se outro robô aparecer
  no lugar deles no log, é o mesmo tratamento — com o dono decidindo.

### P2 — 🟠 Sair do `gemini-2.5-flash` antes de 01/12/2026

- **Falha:** fallback para o Groq em **9 de 16 dias desde 26/10, 4 seguidos
  (07–10/11)** — o gatilho de "3 dias seguidos" do §16 já disparou. Os
  briefings do Groq saem ~25 % menores e fora do formato ("Introdução",
  "Conclusão", `---`, `#` no fim). E a página oficial de descontinuações dá
  **01/12/2026** como desligamento mais cedo do modelo, com roteamento
  automático para o substituto — depois disso o `modelVersion` gravado mente.
- **Correção:** reler a página de descontinuações e os limites do nível
  gratuito **antes** de escolher (não confiar na data nem no nome do
  substituto escritos aqui); **o modelo é decisão do dono**. Trocar
  `GEMINI_MODEL` no default do `apps/api/src/config/env.ts`, no
  `render.yaml`, no `.env.example` e na tabela do `docs/setup.md`.
- **Atenção ao Render:** o `render.yaml` é Blueprint, mas a configuração da
  API vive no painel (CLAUDE.md, "As duas plataformas publicam pela
  `main`"). Depois da promoção, **conferir no painel** (Environment) que o
  valor mudou; se não, o dono muda à mão.
- **Ensaio:** uma geração real com o modelo novo exige a chave de verdade no
  `apps/api/.env` (as locais são placeholders) — pedir ao dono, ou medir no
  primeiro run depois da promoção (evento da etapa 6 e `modelVersion`).
- **Como saber que funcionou:** nos 7 runs seguintes, fallback para o Groq em
  no máximo 1.

### P3 — 🟠 Tirar o cron interno do topo da hora

- **Falha:** os runs que começam às **11:00:00 UTC** (cron interno, `0 8 * * *`
  em São Paulo) caem no Gemini **8 de 9 vezes**; os de **~11:30** (cron da
  Vercel), **1 de 7**. Correlação, causa não provada. O cron interno só
  dispara porque a API está acordada às 11:00 (P1).
- **Correção:** `CRON_SCHEDULE` para `20 8 * * *` (11:20 UTC) no
  `render.yaml`, no default do `env.ts` e no `docs/setup.md` — e no painel do
  Render, como no P2. Mesmo PR do P2. A disputa com o cron da Vercel já é
  tratada pela idempotência (`already-running` → espera).
- **Como saber que funcionou:** junto com o P2.

### P4 — 🟠 Seleção com teto por fonte

- **Falha:** `selectTopItems` (`apps/api/src/services/pipeline.service.ts`)
  pega as **15 mais recentes**, e às 08:00 BRT quem publicou por último é o
  G1: **61,6 % das citações desde 10/10, contra 25,7 % da colheita**.
  NewsData (~19 % da colheita), TechCrunch e Trivela nunca foram citados. O
  portão 5.5 mede **3 fontes (o mínimo) na maioria dos dias** e **bloqueou os
  runs das 11:00 de 02/11 e 06/11** ("2 distinct sources < 3, even among
  30"); o cron das 11:30 refez e passou. E itens da ESPN chegam **~0,9 h no
  futuro** e furam o topo da ordenação.
- **Correção:** teto por fonte na seleção (sugestão: **3 de 15**; o número é
  do dono), completando por recência quando faltar fonte; e a chave de
  ordenação com `publishedAt` limitado a "agora".
- **Guarda:** testes de unidade (teto, preenchimento quando há poucas
  fontes, item do futuro); o teste do portão continua cobrando o bloqueio
  quando a colheita é pobre de verdade.
- **Ensaio antes de mergear:** a seleção nova aplicada às colheitas dos
  últimos 30 dias de produção (leitura no Neon) — fontes distintas por dia e
  fatia do G1, antes e depois.
- **Como saber que funcionou:** 7 runs com ≥ 5 fontes na etapa 5.5, G1 abaixo
  de 35 % das citações, nenhum bloqueio de diversidade.

### P5 — 🟡 A etapa 8.5 e a janela de 85 s do cron

- **Falha:** a etapa 8.5 leva **~49 s de um run de ~75 s** varrendo ~10,5 mil
  linhas para **mudar zero**. Os runs vão de 76 a 144 s, e o cron da Vercel
  espera **85 s** (`PIPELINE_SETTLE_MAX_MS`, `apps/web/lib/timeouts.ts`).
  Quando é ele quem dispara, um run mais longo fica sem o `refresh()`. Em
  **02/11 o run levou 85,05 s**, a sonda do login ficou na véspera e o
  Heartbeat reprovou (o único vermelho em 15 dias).
- **Correção:** a 8.5 não refaz a varredura que não pode mudar nada — marcar
  no evento da etapa a versão das regras de normalização
  (`apps/api/src/services/news-renormalizer.service.ts`) e varrer o acervo
  inteiro só quando a versão mudar; nos outros dias, só o que entrou desde a
  última varredura. A ingestão já normaliza o que é novo, e "a correção
  alcança o acervo" continua valendo, porque mudar a regra muda a versão.
  Subir a janela de 85 s não é saída: `maxDuration` é 290 e o aquecimento
  pode levar 75 s.
- **Guarda:** mesma versão → sem varredura completa; versão nova → varredura
  completa; e o teste que já cobra a cessão do event loop continua.
- **Como saber que funcionou:** a 8.5 abaixo de 5 s nos dias sem regra nova,
  run abaixo de 40 s, `login` do Heartbeat verde todo dia.

### P6 — 🟡 `heading-order` no corpo do briefing

- **Falha:** `/pt-BR/article/2026-11-10` salta de **h1 para h3**. O Groq pôs
  `# Síntese` no fim do texto, e `parseArticleBody`
  (`apps/web/components/editorial/article-body.tsx`) dá o `h2` ao `#` mais
  raso **onde quer que ele esteja**, empurrando os `##` anteriores para `h3`.
  O Lighthouse de segunda pode cobrar (`heading-order`), e fica mais
  provável quanto mais o Groq for usado.
- **Correção:** o primeiro heading do corpo é `h2`, e nenhum heading sobe
  mais de um nível em relação ao anterior.
- **Guarda:** o corpo de 10/11 como fixture (armadilha: guarda com caso real,
  não inventado), e os testes atuais do `parseArticleBody` verdes.
- **Como saber que funcionou:** acessibilidade 100 em `/article/[date]` no
  próximo Lighthouse.

### P7 — 🟡 O alarme que faltou: horas da API por e-mail

- **Falha:** as horas subiram de 5 para 24 por dia e **ninguém soube por 9
  dias**. O gráfico existe na `/admin` (13.9), mas ninguém o lê, e o
  `/api/metrics/http` é só de admin — o Heartbeat, que manda e-mail, não
  alcança o número.
- **Correção (o desenho é decisão do dono):** expor as horas de ontem e do
  mês numa rota pública de saúde (o número não é sensível) e o Heartbeat
  ganhar a pergunta `hours`: reprova se ontem passou de **16 h** ou se a
  projeção do mês passa de **600 h** (limiares sugeridos).
- **Guarda:** `apps/api/tests/scripts/heartbeat.test.ts` cobrindo os dois
  limiares; contrato de resposta da rota.

### P8 — Pendências miúdas (triagem, sem PR próprio)

- **Dependabot:** #303 (dependência de produção, aberto desde 26/10), #306 e
  #307, todos com o CI verde — triar e mergear na `dev`.
- **"Loading chunk failed":** 27 relatos em 14 dias, quase todos em
  `/news/[id]`, com os chunks respondendo 200 — ruído de robô. Reconferir o
  `ErrorEvent` de origem `WEB` 7 dias depois do P1; só vira ação se
  continuar.
- **Um 500 isolado** em `/news/[id]` às 14:07 UTC de 10/11 (hoje 200):
  reconferir no log da Vercel depois do P1.
- **Folha em `ETIMEDOUT`** em 03 e 04/11: a nova tentativa do 13.5 cobre;
  sem ação.
- **Heartbeat atrasando 5–10 h** (agendado para 12:40 UTC, roda entre 17:00
  e 22:40): é a fila do `schedule` do GitHub, documentada. Sem ação, a menos
  que deixe de rodar.
- **Checkout local da `dev` 13 commits atrás:** `git pull --ff-only` e
  `pnpm install` no começo da sessão.

## Só do dono

- **D1 — Render:** `render login` (a CLI está `unauthorized`) e **Billing →
  free instance hours por serviço**; registrar o total na `/admin`. A última
  leitura é de **09/10**.
- **D2 — Vercel:** **Usage → ISR Writes** (o gráfico diário desde 27/10) e
  **Image Optimization**, antes de cada promoção.
- **D3 — Decisões:** o modelo do P2, o teto por fonte do P4, os limiares do
  P7.
- **D4 — Promoções `dev → main`:** a do P1 já; a do resto antes de 01/12.

## Ordem dos PRs

| PR | Itens | Prazo |
|---|---|---|
| 1 | P1 (robots) | já, com promoção sozinha |
| 2 | P2 + P3 (modelo e horário) | antes de 01/12 |
| 3 | P4 (seleção) | — |
| 4 | P5 (etapa 8.5) | — |
| 5 | P6 (headings) | antes do Lighthouse de segunda, se possível |
| 6 | P7 (alarme de horas) | — |

Depois da promoção do lote: o ritual de fechar (Lighthouse, Smoke automático,
baseline só se mudou tela), a janela de 7 runs medindo os critérios de cada
item, um item no `docs/progress.md` por PR e o topo do bloco "Status Atual" do
`CLAUDE.md`.
