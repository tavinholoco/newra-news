# Advisories aceitas — o que o `pnpm audit` não reprova, e por quê

O job de lint roda `pnpm audit --audit-level=high --prod` e **falha o CI** quando
aparece uma advisory *high* ou *critical* em dependência de produção. Este
documento é a única saída: uma advisory só deixa de reprovar depois de ganhar uma
linha aqui, e a linha exige quatro coisas — **por que não alcança este código**,
**quem aceitou**, **quando**, e **o que reabre a decisão**.

A lista silenciada em si mora no `package.json`, em `pnpm.auditConfig.ignoreGhsas`
— JSON não aceita comentário, então o identificador fica lá e o argumento fica
aqui. **Os dois não podem divergir**, e é a guarda
`apps/api/tests/build/workflow-hardening.test.ts` que impede: toda GHSA no
`package.json` precisa de linha nesta tabela, toda linha desta tabela precisa
estar no `package.json`, e nenhuma linha pode ficar sem motivo, sem data ou sem
gatilho.

> **Por que `--prod` e não a árvore inteira.** Sem o filtro são **35** advisories
> *high* em 17 pacotes, e a maioria esmagadora é ferramenta que nunca é
> publicada: `eslint@8`, `vitest@2`, o CLI do `shadcn`. Uma lista de exceção com
> 35 linhas é a armadilha 21 do §17 do plano de observabilidade — vira ruído,
> alguém desliga o passo, e ele deixa de existir de fato enquanto continua
> existindo no arquivo. Com `--prod` são **18**, e as 18 já tinham alcance
> analisado nos itens **9.S** e **10.S** do `docs/progress.md`.
>
> O outro lado fica com o **Dependabot**, que abre PR semanal para dependência de
> desenvolvimento também. A diferença entre os dois é o que cada um faz quando
> encontra: o `audit` **reprova o merge**, o Dependabot **propõe a atualização**.

## As três dívidas, e são só três

Dezoito advisories, quatro grupos, três gatilhos. Nenhuma delas é novidade desta
fase — o que é novo é o CI cobrar.

| Gatilho | Advisories | Onde o aceite foi escrito |
|---|---|---|
| **`next` 14 → 15** | 8 do `next` + 7 da cadeia de build que ele carrega | item 10.S do `docs/progress.md` |
| **`fastify` 4 → 5** | `fastify` e `find-my-way` | item 9.S |
| **UI do Swagger em produção** | `@fastify/static` | item 9.S |

No dia em que qualquer um dos três acontecer, as linhas correspondentes somem
sozinhas — a advisory sai do `audit`, e a guarda passa a reprovar por sobra.

## A tabela

| Advisory | Pacote | Por que não alcança esta configuração | Aceito em | Gatilho de revisão |
|---|---|---|---|---|
| GHSA-h25m-26qc-wcjf | `next` | DoS na desserialização de RSC — o app não tem nenhuma Server Action, e a premissa é teste | 23/08/2026 | a primeira Server Action, ou `next@15` |
| GHSA-q4gf-8mx6-v5v3 | `next` | DoS com Server Components — mesma premissa: não há Server Action neste app | 23/08/2026 | a primeira Server Action, ou `next@15` |
| GHSA-8h8q-6873-q5fj | `next` | DoS com Server Components — mesma premissa: não há Server Action neste app | 23/08/2026 | a primeira Server Action, ou `next@15` |
| GHSA-m99w-x7hq-7vfj | `next` | DoS no App Router via Server Actions, e o app não usa nenhuma | 23/08/2026 | a primeira Server Action, ou `next@15` |
| GHSA-89xv-2m56-2m9x | `next` | SSRF em Server Actions rodando em *custom server* — não há nem um nem outro | 23/08/2026 | Server Action ou servidor próprio, ou `next@15` |
| GHSA-c4j6-fc7j-m34r | `next` | SSRF por upgrade de WebSocket, e o app não serve WebSocket em rota nenhuma | 23/08/2026 | servir WebSocket, ou `next@15` |
| GHSA-36qx-fr4f-26g5 | `next` | Bypass de middleware no **Pages Router** com i18n, e este app é App Router inteiro | 23/08/2026 | migrar para Pages Router, ou `next@15` |
| GHSA-p9j2-gv94-2wf4 | `next` | SSRF em `rewrites` com host escolhido pelo atacante, e o `next.config` não declara `rewrites` | 23/08/2026 | o primeiro `rewrite`, ou `next@15` |
| GHSA-xwg4-73v4-xw9w | `nanoid` | Só entra pelo `postcss` que o `next@14` usa para processar CSS **em build**, sobre a folha de estilo do próprio projeto — o tamanho nunca vem de fora | 05/09/2026 | `next@15`, que traz a cadeia atualizada |
| GHSA-28wg-ghj8-5hjv | `nanoid` | Laço infinito com `size` negativo, e o único chamador é o `postcss` do build com valor fixo | 05/09/2026 | `next@15`, que traz a cadeia atualizada |
| GHSA-2v37-7h3g-55p8 | `nanoid` | Laço infinito com `size` zero, e o único chamador é o `postcss` do build com valor fixo | 05/09/2026 | `next@15`, que traz a cadeia atualizada |
| GHSA-6g55-p6wh-862q | `postcss` | Leitura de arquivo por `sourceMappingURL` em comentário de CSS — exige CSS de terceiro, e o build só processa a folha versionada neste repositório | 05/09/2026 | processar CSS que venha de fora, ou `next@15` |
| GHSA-r28c-9q8g-f849 | `postcss` | Travessia de caminho no auto-carregamento de source map — mesma condição: o CSS processado é só o do repositório | 05/09/2026 | processar CSS que venha de fora, ou `next@15` |
| GHSA-73wf-gq98-2v4g | `browserslist` | Crash por `browserslist-stats.json` não confiável, e o projeto não usa custom stats — a consulta vem do `package.json` | 05/09/2026 | adotar custom stats, ou `next@15` |
| GHSA-c83g-rgw3-j3cx | `browserslist` | Crescimento de memória por consultas distintas, num processo de build que termina — a consulta é uma só e é fixa | 05/09/2026 | consulta dinâmica de browserslist, ou `next@15` |
| GHSA-jx2c-rxcm-jvmq | `fastify` | Bypass de validação por `content-type` com tab — **mitigado na porta**: `content-type` com caractere de controle é recusado com 415 antes de o parser ser escolhido, e há guarda em `apps/api/tests/security/content-type-bypass.test.ts` | 23/08/2026 | a major `fastify@5`, dívida da Fase 13 |
| GHSA-c96f-x56v-gq3h | `find-my-way` | DDoS com HTTP/2, e a API não serve HTTP/2 — o `buildApp` não passa a opção | 23/08/2026 | servir HTTP/2, ou `fastify@5` |
| GHSA-83w8-p2f5-377r | `@fastify/static` | Bypass de route guard por travessia — o pacote só entra pelo `@fastify/swagger-ui`, que **deixou de ser registrado em produção** na Fase 9 (`isDocsUiEnabled`) | 23/08/2026 | reabrir a UI do Swagger em produção |

> **Quem aceita:** Pedro Levi. As linhas de 23/08/2026 vêm dos itens 9.S e 10.S do
> `docs/progress.md`, onde cada "não alcança" já era uma afirmação sobre o código
> — e onde cada premissa virou teste. As de 05/09/2026 são a cadeia de build que
> o `next@14` carrega, e saem junto com ele.

## Como acrescentar uma linha

1. Rode `pnpm audit --audit-level=high --prod` e leia o **caminho** da advisory,
   não só o nome do pacote. O que decide é por onde ela entra.
2. Responda por escrito: *o que este código precisaria fazer para a advisory
   alcançá-lo?* Se a resposta for "nada, já alcança", **não há linha a escrever**
   — há uma atualização a fazer.
3. Acrescente o identificador em `pnpm.auditConfig.ignoreGhsas`, no
   `package.json` da raiz, e a linha aqui.
4. Rode `pnpm --filter @newranews/api test tests/build/workflow-hardening.test.ts`.
   Ela reprova se os dois arquivos discordarem, ou se a linha estiver sem motivo,
   sem data ou sem gatilho.
