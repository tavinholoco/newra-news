import type {
  Category,
  DailyBriefing,
  EditorialStory,
} from '@newranews/types';

/**
 * Fixtures dos blocos da Home (Fase 3).
 *
 * Ficam num arquivo só porque seis suítes montam a mesma `EditorialStory`; com
 * cópia local, um campo novo no contrato exigiria editar seis lugares e a
 * primeira suíte esquecida passaria a testar um tipo que não existe mais.
 */
export function makeStory(
  overrides: Partial<EditorialStory> = {},
): EditorialStory {
  return {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    title: 'Matéria de teste do bloco editorial',
    dek: 'Resumo da matéria de teste, com o tamanho de um dek real.',
    imageUrl: null,
    category: 'TECHNOLOGY' as Category,
    source: 'G1',
    sourceUrl: 'https://g1.globo.com/teste',
    publishedAt: '2024-01-01T12:00:00.000Z',
    updatedAt: '2024-01-01T12:00:00.000Z',
    readingTimeMinutes: 3,
    ...overrides,
  };
}

/** N matérias com `id` e `title` distintos — listas precisam de chaves únicas. */
export function makeStories(count: number): EditorialStory[] {
  return Array.from({ length: count }, (_, i) =>
    makeStory({
      id: `aaaaaaaa-0000-0000-0000-00000000000${i + 1}`,
      title: `Matéria ${i + 1}`,
    }),
  );
}

export function makeBriefing(
  overrides: Partial<DailyBriefing> = {},
): DailyBriefing {
  return {
    id: 'bbbbbbbb-0000-0000-0000-000000000001',
    date: '2024-01-01',
    title: 'O resumo do dia em uma leitura',
    summary: 'O que aconteceu hoje, organizado em três parágrafos curtos.',
    sourceCount: 12,
    readingTimeMinutes: 4,
    generatedAt: '2024-01-01T09:00:00.000Z',
    aiDisclosure: true,
    sources: [],
    ...overrides,
  };
}
