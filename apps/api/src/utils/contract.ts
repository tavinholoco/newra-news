import type { z, ZodTypeAny } from 'zod';

/**
 * A guarda de deriva entre **o que a API serializa** e **o que o web declara**.
 *
 * `packages/types` é a fonte única: a API valida com Zod, o web consome o tipo
 * TypeScript. Nada verificava que os dois concordam, exceto numa rota — o
 * `SchemaMatchesSharedType` de `routes/events/schemas.ts`, escrito na Fase 8 e
 * que já pagou o próprio custo na primeira execução. Todas as outras rotas
 * podiam derivar em silêncio: o schema diz uma coisa, o tipo diz outra, os dois
 * compilam, e o defeito aparece como campo `undefined` numa tela — ou, pior,
 * como campo que **existe no tipo e nunca chega**, que foi exatamente o caso do
 * artigo na Fase 5, invisível por um dia com a `docs/api.md` descrevendo o
 * comportamento certo.
 *
 * Isto não gera código. Ele falha o `typecheck` no instante em que os dois
 * lados discordarem — que é a diferença entre uma convenção mantida por
 * disciplina e uma que o `tsc` recusa quebrar.
 */

/**
 * Enum de string vira a união dos seus literais; o resto passa igual.
 *
 * **Existe por causa de uma diferença de representação que é real e não é
 * deriva.** O `Category` de `packages/types` é um `enum` nominal; o das rotas é
 * `z.enum([...])`, uma união de literais — e o do Prisma é uma terceira união
 * de literais. Para o TypeScript, `Category.TECHNOLOGY` é atribuível a
 * `'TECHNOLOGY'`, mas `'TECHNOLOGY'` **não** é atribuível a `Category`: a
 * comparação bidirecional reprovaria em toda rota que menciona categoria, sem
 * que nada estivesse errado.
 *
 * A alternativa seria trocar `z.enum(CATEGORIES)` por `z.nativeEnum(Category)`
 * nas rotas — e aí o handler, que devolve o valor vindo do Prisma, precisaria
 * de um cast em cada rota. Isso **espalharia a ponte entre os dois enums**, que
 * a §11.1 pede para manter num lugar só: `services/editorial.mapper.ts`.
 *
 * Normalizar aqui custa um tipo e não perde nada do que a guarda existe para
 * pegar: membro acrescentado de um lado só muda o tamanho da união e continua
 * reprovando.
 */
export type Widen<T> = T extends string
  ? `${T}`
  : T extends ReadonlyArray<infer U>
    ? T extends unknown[]
      ? Array<Widen<U>>
      : ReadonlyArray<Widen<U>>
    : T extends object
      ? { [K in keyof T]: Widen<T[K]> }
      : T;

/**
 * `true` quando os dois lados descrevem a mesma coisa; senão, um objeto cuja
 * única serventia é aparecer na mensagem do `tsc`.
 *
 * A conferência é **bidirecional de propósito**. Só `Schema extends Shared`
 * deixaria passar campo que o tipo declara e o schema não produz — o defeito da
 * Fase 5, em que a tela esperava auditoria e fontes que a resposta descartava.
 * Só o inverso deixaria passar campo que a API manda e ninguém lê.
 */
export type Contract<Schema extends ZodTypeAny, Shared> =
  Widen<z.infer<Schema>> extends Widen<Shared>
    ? Widen<Shared> extends Widen<z.infer<Schema>>
      ? true
      : { contractError: 'o schema produz campo que o tipo compartilhado não declara' }
    : { contractError: 'o tipo compartilhado declara campo que o schema não produz' };

/**
 * Uma linha por contrato, ao lado do schema que ela protege.
 *
 * ```ts
 * assertContract<typeof getNewsByIdResponseSchema, ApiResponse<News>>(true);
 * ```
 *
 * O corpo é vazio porque não há nada a fazer em runtime: quem trabalha é a
 * resolução do argumento de tipo. Quando os dois lados discordam, `true` deixa
 * de ser atribuível ao parâmetro e o `tsc` imprime qual das duas direções
 * quebrou.
 *
 * Mora ao lado do schema, e não numa suíte de teste, por dois motivos: o
 * `typecheck` roda antes dos testes no CI, e um arquivo central de asserções
 * seria mais uma lista para alguém esquecer de atualizar — aqui, quem mexe no
 * schema tropeça na linha.
 */
export function assertContract<Schema extends ZodTypeAny, Shared>(
  _proof: Contract<Schema, Shared>,
): void {
  // Intencionalmente vazio — ver o bloco acima.
}
