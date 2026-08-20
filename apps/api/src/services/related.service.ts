import { prisma } from '@newranews/database';
import type { News } from '@newranews/database';
import type { EditorialStory } from '@newranews/types';
import { toEditorialStory } from './editorial.mapper';

/** Janela de proximidade temporal do primeiro nível, em horas. */
const WINDOW_HOURS = 72;

/**
 * Relacionadas de uma notícia (§5 dos contratos), em três níveis de
 * precedência:
 *
 *   1. mesma categoria, publicadas em ±72h;
 *   2. mesma categoria, fora da janela;
 *   3. mais recentes de qualquer categoria.
 *
 * Sem embeddings nem busca semântica. O acervo é de notícia diária, a
 * categoria já é sinal forte, e a §9 pede relacionadas **úteis**, não
 * relevância de estado da arte. Trocar isto por busca vetorial é decisão de
 * produto com custo de infraestrutura — não um detalhe de implementação.
 *
 * Devolve `null` quando a notícia base não existe, para a rota traduzir em 404.
 */
export async function getRelatedNews(
  id: string,
  limit: number,
): Promise<EditorialStory[] | null> {
  const base = await prisma.news.findUnique({ where: { id } });
  if (!base) return null;

  const collected: News[] = [];
  const seen = new Set<string>([base.id]);

  /** Acrescenta o que ainda cabe, sem repetir o que já entrou. */
  function absorb(rows: News[]) {
    for (const row of rows) {
      if (collected.length >= limit) return;
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      collected.push(row);
    }
  }

  const windowMs = WINDOW_HOURS * 3_600_000;
  const from = new Date(base.publishedAt.getTime() - windowMs);
  const to = new Date(base.publishedAt.getTime() + windowMs);

  // Nível 1 — mesma categoria, perto no tempo.
  absorb(
    await prisma.news.findMany({
      where: {
        category: base.category,
        id: { not: base.id },
        publishedAt: { gte: from, lte: to },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    }),
  );

  // Nível 2 — mesma categoria, qualquer data.
  if (collected.length < limit) {
    absorb(
      await prisma.news.findMany({
        where: {
          category: base.category,
          id: { notIn: [...seen] },
        },
        orderBy: { publishedAt: 'desc' },
        take: limit - collected.length,
      }),
    );
  }

  // Nível 3 — as mais recentes, de qualquer categoria. Uma notícia de
  // categoria pouco povoada não pode devolver uma lista vazia.
  if (collected.length < limit) {
    absorb(
      await prisma.news.findMany({
        where: { id: { notIn: [...seen] } },
        orderBy: { publishedAt: 'desc' },
        take: limit - collected.length,
      }),
    );
  }

  return collected.map((news) => toEditorialStory(news));
}
