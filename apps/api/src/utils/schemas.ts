import { z } from 'zod';
import type { ApiError } from '@newranews/types';
import { assertContract } from './contract';

/**
 * **O corpo de erro é um só, em todas as rotas.**
 *
 * A §11.2 perguntava se as 12 rotas de BFF repassam o *corpo* de erro do mesmo
 * jeito — quem lê `{ error }` e quem lê outra coisa. A resposta é que há um
 * formato só desde a Fase 2, e a linha abaixo é o que o mantém assim: o
 * `ApiError` de `packages/types` é o que o web declara, e o `proxyToApi`
 * repassa o corpo verbatim.
 *
 * A única resposta que acrescenta campo é o 500, que traz `requestId` junto —
 * e ela não usa este schema, porque `errorResponseSchema` é o que as rotas
 * declaram e o 500 sai do error handler, sem schema.
 */
export const errorResponseSchema = z.object({
  error: z.string(),
});

assertContract<typeof errorResponseSchema, ApiError>(true);
