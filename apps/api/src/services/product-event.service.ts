import { prisma } from '@newranews/database';
import type { Prisma } from '@newranews/database';
import {
  PRODUCT_EVENT_RETENTION_DAYS,
  type ProductEvent,
} from '@newranews/types';

/**
 * Separa o que é base do que é payload.
 *
 * O `type` sobe para coluna própria porque é por ele que toda consulta filtra
 * (`@@index([type, occurredAt])`); o resto do payload fica no `Json`, que é o
 * que permite catorze formatos numa tabela só.
 */
function toCreateInput(event: ProductEvent): Prisma.ProductEventCreateManyInput {
  const { sessionId, locale, path, occurredAt, type, ...payload } = event;

  return {
    type,
    sessionId,
    locale,
    path,
    occurredAt: new Date(occurredAt),
    payload: payload as Prisma.InputJsonValue,
  };
}

/**
 * Grava um lote de eventos.
 *
 * **`skipDuplicates` não serve aqui e não está ligado**: não há chave única
 * para colidir — dois `story_open` idênticos em segundos são dois cliques, e
 * descartar o segundo apagaria a diferença entre "clicou uma vez" e "voltou e
 * clicou de novo".
 *
 * Devolve quantos entraram, e é o que a rota responde. Ingestão que responde
 * `{ ok: true }` sem contar não deixa como saber que metade do lote sumiu.
 */
export async function ingestProductEvents(
  events: ProductEvent[],
): Promise<{ accepted: number }> {
  const { count } = await prisma.productEvent.createMany({
    data: events.map(toCreateInput),
  });

  return { accepted: count };
}

/**
 * Apaga evento cru mais velho que a retenção da §4.
 *
 * **Roda na etapa 8 do pipeline diário, junto do cleanup que já existe** — não
 * é job manual, e não é etapa nova: o mesmo bloco que apaga notícia aos 30 dias
 * e briefing aos 90 apaga evento aos 90. Solução que depende de alguém lembrar
 * de rodar volta a doer na próxima mudança de regra.
 *
 * Corta por `occurredAt` e não por `createdAt`: o que a §4 limita é há quanto
 * tempo o comportamento aconteceu, não quando a linha chegou.
 */
export async function deleteExpiredProductEvents(now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - PRODUCT_EVENT_RETENTION_DAYS);

  const { count } = await prisma.productEvent.deleteMany({
    where: { occurredAt: { lt: cutoff } },
  });

  return count;
}
