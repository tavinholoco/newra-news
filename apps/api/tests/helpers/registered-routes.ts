import type { FastifyInstance } from 'fastify';

/**
 * As rotas que o roteador de fato registrou, na forma `GET /api/news/:id`.
 *
 * O `printRoutes` desenha a árvore; o parse reconstrói o caminho a partir da
 * indentação, que é como a árvore codifica a hierarquia. Morava dentro de
 * `authorization-matrix.test.ts`; virou helper quando a **costura com o BFF**
 * (`bff-route-seam.test.ts`) passou a perguntar sobre a mesma superfície — um
 * segundo parser seria um segundo lugar para quebrar em silêncio.
 *
 * `HEAD` e `OPTIONS` ficam de fora: o Fastify os deriva de todo `GET`, e
 * ninguém decide política de acesso para eles.
 */
export function registeredRoutes(instance: FastifyInstance): string[] {
  const registered: string[] = [];
  const stack: Array<{ depth: number; segment: string }> = [];

  for (const line of instance.printRoutes({ commonPrefix: false }).split('\n')) {
    if (line.trim().length === 0) continue;
    const depth = (line.match(/^[│\s]*[└├]??─*\s?/)?.[0] ?? '').length;
    const content = line.replace(/^[│\s]*[└├]?─*\s?/, '');
    const [segment, methodsPart] = content.split(' (');

    while (stack.length > 0 && (stack[stack.length - 1]?.depth ?? 0) >= depth) {
      stack.pop();
    }
    stack.push({ depth, segment: segment ?? '' });
    if (!methodsPart) continue;

    const path = stack.map((entry) => entry.segment).join('');
    const normalized = path.length > 1 ? path.replace(/\/$/, '') : path;
    for (const method of methodsPart.replace(')', '').split(', ')) {
      if (method === 'HEAD' || method === 'OPTIONS') continue;
      registered.push(
        `${method} ${normalized.startsWith('/') ? normalized : `/${normalized}`}`,
      );
    }
  }

  return [...new Set(registered)];
}
