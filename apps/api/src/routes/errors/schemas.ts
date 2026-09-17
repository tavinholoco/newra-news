import { z } from 'zod';
import {
  CLIENT_ERROR_DIGEST_MAX_LENGTH,
  CLIENT_ERROR_MESSAGE_MAX_LENGTH,
  type ClientErrorReport,
} from '@newranews/types';
import { assertContract } from '../../utils/contract';

/**
 * O corpo de `POST /api/errors/client` (§11.3 do plano de observabilidade).
 *
 * **Estrito na forma, porque o conteúdo é do navegador.** Os tetos são os do
 * plano — 300 para a mensagem, 64 para o `digest` — e o `path` tem de ser um
 * pathname: começa em `/`, sem `?` e sem `#`. A query carregaria o termo de
 * busca (a mesma regra do `/api/events`), e o fragmento nunca chega a um
 * servidor por um caminho honesto. **Sem stack**: o do cliente é minificado e
 * não localiza nada; quem localiza o stack do servidor é o `digest`.
 *
 * `z.object` sem `passthrough` **descarta** o que não declara — um `userId`
 * ou um `email` anexado "para ajudar" não chega ao `context`. A guarda de
 * anonimato afirma isso sobre o resultado do parse.
 */
export const clientErrorReportSchema = z.object({
  message: z.string().min(1).max(CLIENT_ERROR_MESSAGE_MAX_LENGTH),
  digest: z.string().min(1).max(CLIENT_ERROR_DIGEST_MAX_LENGTH).optional(),
  path: z
    .string()
    .min(1)
    .max(512)
    .regex(/^\/[^?#]*$/, { message: 'path must be a pathname without query or fragment' }),
});

/**
 * A mesma guarda de compilação do `/api/events`, no corpo: o tipo em
 * `packages/types` é o que o reporter do web escreve, e este schema é o que
 * a API aceita. Um campo acrescentado de um lado só vira 400 em produção.
 */
assertContract<typeof clientErrorReportSchema, ClientErrorReport>(true);

/**
 * `202` e `{ accepted: true }`: o relato entrou no **buffer** do `ErrorEvent`,
 * que vai ao banco a cada 30 s. Nada foi criado no instante da resposta —
 * `201` mentiria, e "recorded" também. Ninguém lê este corpo (o reporter do
 * web é fire-and-forget), então ele não tem tipo compartilhado: está na
 * lista de exceções do `shared-type-contract.test.ts`, com o motivo.
 */
export const clientErrorAcceptedSchema = z.object({
  data: z.object({ accepted: z.literal(true) }),
});

export const errorResponseSchema = z.object({ error: z.string() });
