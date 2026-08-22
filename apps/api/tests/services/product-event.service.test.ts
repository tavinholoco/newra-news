import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Category, type ProductEvent } from '@newranews/types';
import {
  ingestProductEvents,
  deleteExpiredProductEvents,
} from '../../src/services/product-event.service';

const createMany = vi.fn();
const deleteMany = vi.fn();

vi.mock('@newranews/database', () => ({
  prisma: {
    productEvent: {
      createMany: (...args: unknown[]) => createMany(...args),
      deleteMany: (...args: unknown[]) => deleteMany(...args),
    },
  },
}));

const base = {
  sessionId: 'bbbbbbbb-0000-0000-0000-000000000001',
  locale: 'pt-BR',
  path: '/pt-BR/news',
  occurredAt: '2026-08-22T12:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  createMany.mockResolvedValue({ count: 1 });
  deleteMany.mockResolvedValue({ count: 0 });
});

describe('ingestProductEvents', () => {
  it('promotes `type` to its own column and leaves the rest in the payload', async () => {
    // É por `type` que toda métrica filtra (`@@index([type, occurredAt])`); o
    // resto vive no Json, que é o que permite catorze formatos numa tabela só.
    const event: ProductEvent = {
      ...base,
      type: 'story_open',
      storyId: 'story-1',
      category: Category.HEALTH,
      position: 3,
      source: 'hero',
    };

    await ingestProductEvents([event]);

    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          type: 'story_open',
          sessionId: base.sessionId,
          locale: 'pt-BR',
          path: '/pt-BR/news',
          occurredAt: new Date(base.occurredAt),
          payload: {
            storyId: 'story-1',
            category: Category.HEALTH,
            position: 3,
            source: 'hero',
          },
        },
      ],
    });
  });

  it('keeps the payload empty for an event that carries nothing else', async () => {
    await ingestProductEvents([{ ...base, type: 'homepage_view' }]);

    const [{ data }] = createMany.mock.calls[0] as [
      { data: Array<{ payload: unknown }> },
    ];
    expect(data[0]?.payload).toEqual({});
  });

  it('never dedupes — two identical clicks are two clicks', async () => {
    // `skipDuplicates` apagaria a diferença entre "clicou uma vez" e "voltou e
    // clicou de novo", que é justamente o que a métrica quer medir.
    await ingestProductEvents([{ ...base, type: 'homepage_view' }]);

    const [arg] = createMany.mock.calls[0] as [Record<string, unknown>];
    expect(arg).not.toHaveProperty('skipDuplicates');
  });

  it('answers how many rows went in, not just that it worked', async () => {
    createMany.mockResolvedValue({ count: 7 });

    await expect(
      ingestProductEvents([{ ...base, type: 'homepage_view' }]),
    ).resolves.toEqual({ accepted: 7 });
  });
});

describe('deleteExpiredProductEvents', () => {
  it('cuts at 90 days by `occurredAt`, not `createdAt`', async () => {
    // O que a §4 limita é há quanto tempo o comportamento aconteceu, não
    // quando a linha chegou — uma fila atrasada não estica a retenção.
    await deleteExpiredProductEvents(new Date('2026-08-22T00:00:00.000Z'));

    expect(deleteMany).toHaveBeenCalledWith({
      where: { occurredAt: { lt: new Date('2026-05-24T00:00:00.000Z') } },
    });
  });

  it('returns how many were purged, for the pipeline to log', async () => {
    deleteMany.mockResolvedValue({ count: 42 });

    await expect(deleteExpiredProductEvents()).resolves.toBe(42);
  });
});
