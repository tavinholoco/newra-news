/**
 * Em quanto tempo desistir — e por que os números são estes.
 *
 * **Nenhuma chamada `fetch` deste app tinha timeout.** Nem em `lib/api.ts`, nem
 * em `lib/api-proxy.ts`, nem nas 12 rotas de BFF, nem no callback de sign-in.
 * Some isso ao plano free do Render, que hiberna com ~15 min sem tráfego: uma
 * API dormindo — ou pendurada — segura a função da Vercel até o limite dela, e
 * o que o leitor vê é uma página que nunca responde. Com timeout, ele vê uma
 * página que diz que não conseguiu.
 *
 * A peça que faltava para isso valer alguma coisa já existe desde a Fase 10: o
 * `ApiError` separa *"a API não respondeu"* (`status === null`) de *"a API disse
 * não"*. `AbortSignal.timeout` faz o `fetch` lançar, o `catch` que já está lá o
 * transforma em `status: null`, e cada tela decide — a Home mantém a última
 * página boa (`nullUnlessPublishing`), o detalhe não vira 404
 * (`nullIfNotFound`), o cancelamento da newsletter não diz "link inválido".
 *
 * ## Por que dois números, e nesta ordem
 *
 * Uma chamada do navegador atravessa **duas** pernas: browser → BFF → API. Se
 * as duas desistissem juntas, quem estoura primeiro é imprevisível, e o
 * navegador receberia uma requisição abortada — sem status, sem corpo, sem nada
 * que a tela pudesse dizer. Com o interno estritamente menor, **é sempre a
 * perna de dentro que falha primeiro**, e o BFF ainda está vivo para devolver
 * um status de verdade.
 *
 * ## De onde saem os valores
 *
 * `API_TIMEOUT_MS = 8000` tem de caber entre dois números medidos:
 *
 * - **acima do cold start.** A auditoria da Fase 8 mediu **4,9 s** na primeira
 *   requisição contra 0,22 s numa API quente. Um timeout menor que isso
 *   transformaria toda primeira visita depois da hibernação em erro — trocaria
 *   uma espera por uma falha, que é pior;
 * - **abaixo do teto da função.** O plano Hobby da Vercel mata a função em 10 s.
 *   Desistir aos 8 s deixa margem para o `catch` rodar e a página desenhar o
 *   estado de falha; deixar a função ser morta não deixa.
 *
 * `BFF_TIMEOUT_MS = 12000` é o de fora, com folga sobre o de dentro.
 *
 * `PIPELINE_TRIGGER_TIMEOUT_MS = 20000` é outro caso: o disparo do pipeline
 * responde o **aceite** (`{ outcome, pipelineId, startedAt }`) e o trabalho
 * segue no servidor, então não se espera a execução.
 *
 * `PIPELINE_WARM_TIMEOUT_MS = 25000`, com retentativa, é o que veio antes dele
 * **desde 01/09/2026** — e existe porque o briefing daquele dia não saiu.
 *
 * O cron das 11h UTC é a hora em que a API mais provavelmente está dormindo: no
 * plano free do Render ela hiberna com ~15 min sem tráfego, e desde 31/08 o
 * keep-alive deixa a madrugada passar de propósito. Os 20 s do disparo cobrem
 * um cold start comum (4,9 s medidos), mas **não cobriram a primeira acordada
 * depois de um mês suspenso**: o disparo estourou, o `catch` devolveu 500, e o
 * dia ficou sem briefing — sem que nada além do briefing ausente denunciasse.
 *
 * Acordar antes de disparar troca uma aposta por duas etapas com prazo próprio.
 * O `GET /api/health` é a rota mais barata da API e não tem efeito colateral,
 * então repeti-la é seguro; o disparo só acontece depois que ela responde.
 *
 * ## Por que aqui, e não num workflow do GitHub
 *
 * A alternativa considerada era mover o disparo para o GitHub Actions, que
 * poderia acordar com retentativa. **O agendamento do GitHub nao serve para
 * isso**: medido em 01/09, o keep-alive rodou **2 vezes contra 46 esperadas**,
 * e a documentacao deles diz que execucao agendada em repositorio publico e
 * despriorizada e pode ser descartada em silencio. O cron da Vercel dispara;
 * o que faltava a ele era margem, e margem cabe aqui dentro.
 *
 * ## E por que isto não desliga a ISR
 *
 * Passar `signal` a um `fetch` de server component é seguro nesta versão, e foi
 * conferido no `patch-fetch.js` da `next@14.2.35`: o `signal` está na lista de
 * campos repassados ao `fetch` de origem, e é **removido quando a chamada é uma
 * revalidação em segundo plano** (`signal: isStale ? undefined : signal`). O
 * prazo vale para a requisição que alguém está esperando, e não para a
 * regeneração que acontece atrás — que é exatamente a semântica desejada.
 * Confira isto de novo ao subir para o Next 15.
 */

/** Servidor do Next → API. Acima do cold start medido, abaixo do teto da função. */
export const API_TIMEOUT_MS = 8_000;

/** Navegador → rota de BFF. Estritamente maior que o de dentro. */
export const BFF_TIMEOUT_MS = 12_000;

/** Disparo do pipeline: espera-se o aceite, não a execução. */
export const PIPELINE_TRIGGER_TIMEOUT_MS = 20_000;

/**
 * Acordar a API antes de disparar. Uma tentativa; ver `PIPELINE_WARM_ATTEMPTS`.
 *
 * 25 s cobre com folga o cold start medido (4,9 s) e ainda a acordada lenta
 * depois de uma suspensão longa, que foi o caso que derrubou o briefing de
 * 01/09/2026.
 */
export const PIPELINE_WARM_TIMEOUT_MS = 25_000;

/**
 * Quantas vezes tentar acordar antes de desistir e disparar mesmo assim.
 *
 * Duas, e o teto vem da soma: 2 × 25 s + 20 s de disparo = 70 s, dentro do
 * `maxDuration = 90` da rota do cron. Desistir e **tentar disparar do mesmo
 * jeito** é de propósito — a API pode ter acordado entre a última tentativa e
 * o POST, e um disparo que falha custa menos que um dia sem briefing.
 */
export const PIPELINE_WARM_ATTEMPTS = 2;
