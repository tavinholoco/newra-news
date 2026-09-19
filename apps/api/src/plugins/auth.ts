import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { verifyAuthJwt } from '../utils/jwt';
import { AppError, ForbiddenError, UnauthorizedError, logAppError } from '../utils/errors';
import { routePatternOf } from '../utils/request-route';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      sub?: string;
      email?: string;
      role?: string;
      purpose?: string;
    };
  }
}

/**
 * Para que serve o token — e é a claim que **esta** montagem aceita.
 *
 * `'session'` é o token que o BFF do Next assina a cada requisição de leitor
 * logado, e ele **não carrega `purpose` nenhum**. `'auth-upsert'` é o token de
 * uso único que cria o usuário no primeiro sign-in.
 */
export type AuthPurpose = 'session' | 'auth-upsert';

export interface AuthPluginOptions {
  /** Padrão: `'session'` — recusa qualquer token que traga `purpose`. */
  purpose?: AuthPurpose;
}

/**
 * Exige `Authorization: Bearer <jwt>` (JWT assinado pelo frontend com
 * AUTH_JWT_SECRET) e expõe `request.user` com o payload verificado.
 *
 * ## Escopo que só uma rota honra não é escopo
 *
 * Até a revisão da Fase 9 o `purpose` era conferido **dentro do handler** do
 * `/api/auth/upsert` e ignorado em todas as outras: o token de `auth-upsert`
 * — que existe para uma chamada só, no primeiro sign-in — passava no
 * `/api/favorites` e no `/api/account` exatamente como um token de sessão. Não
 * havia exploração, porque quem assina os dois é o mesmo servidor de confiança;
 * mas a claim existe justamente para escopar, e escopo conferido num lugar só
 * é convenção, não guarda.
 *
 * A conferência subiu para cá e virou **simétrica**: o padrão (`'session'`)
 * recusa token que traga `purpose`, e a montagem que quer o token de upsert
 * pede `{ purpose: 'auth-upsert' }` e recusa o de sessão. Nenhuma das duas
 * pontas do frontend mudou — o BFF já assinava a sessão sem `purpose`.
 */
export async function authPlugin(app: FastifyInstance, opts: AuthPluginOptions = {}) {
  const expected: AuthPurpose = opts.purpose ?? 'session';

  app.decorateRequest('user', null);

  /**
   * **A recusa passa pelo log, e a resposta continua a mesma.**
   *
   * Este `preHandler` responde sem deixar o erro subir, então o handler global
   * do `app.ts` nunca o vê: era a mesma família dos quatro `catch` vazios que a
   * Fase 7a fechou no BFF, e o pior deles — `AUTH_JWT_SECRET` ausente faz
   * `verifyAuthJwt` recusar **todo** token com esta mesma frase, e conta e
   * admin caem juntos sem uma linha em lugar nenhum.
   *
   * O que muda é só o log: a resposta segue uniforme de propósito, porque quem
   * chamou não precisa saber se o token expirou, veio de outro escopo ou se o
   * servidor está sem segredo. Quem separa as três é o `code`, do lado de
   * dentro.
   *
   * **Sem `error` é recusa sem exceção** — cabeçalho ausente, escopo errado —,
   * e aí a linha é a do `AUTH_TOKEN_INVALID`. Com um erro que **não** é da
   * família, ele vira `cause`: `verifyAuthJwt` só lança `UnauthorizedError`
   * hoje, e descartar em silêncio o dia em que ele lançar outra coisa seria
   * abrir de novo o buraco que esta função existe para fechar.
   */
  const refuse = (request: FastifyRequest, reply: FastifyReply, error?: unknown) => {
    const denial =
      error instanceof AppError
        ? error
        : new UnauthorizedError('Invalid or missing token', { cause: error });
    // `requestId` porque é o que liga a linha do `ErrorEvent` à do log — e
    // esta é a porta de maior volume da API (todo 401 passa aqui). Era a única
    // que não o passava; achado da verificação pós-merge da Fase 4.
    logAppError(request.log, denial, {
      route: routePatternOf(request),
      requestId: request.id,
    });
    return reply.status(401).send({ error: 'Invalid or missing token' });
  };

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return refuse(request, reply);
    }

    let payload: Record<string, unknown>;
    try {
      payload = await verifyAuthJwt(auth.slice(7));
    } catch (error) {
      return refuse(request, reply, error);
    }

    const purpose = typeof payload.purpose === 'string' ? payload.purpose : undefined;
    // `'session'` é a ausência da claim; qualquer outro valor é um token de
    // outro escopo e não serve aqui.
    const actual: string = purpose ?? 'session';
    if (actual !== expected) {
      return refuse(request, reply);
    }

    request.user = {
      sub: typeof payload.sub === 'string' ? payload.sub : undefined,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      role: typeof payload.role === 'string' ? payload.role : undefined,
      purpose,
    };
  });
}

/**
 * A **terceira porta** do papel ADMIN, e a única que decide de verdade.
 *
 * São três, e é defesa em profundidade, não redundância: a página do Next
 * esconde a tela (sessão do next-auth), o BFF recusa antes de assinar
 * (`proxyToApi` com `requireRole`), e esta recusa o token. As duas primeiras
 * são conveniência — quem tiver `AUTH_JWT_SECRET` fala direto com a API e pula
 * as duas. **Esta é a que sobra**, e por isso não pode ser a que alguém esquece.
 *
 * Havia quatro cópias inline de `if (request.user?.role !== 'ADMIN')` — o mesmo
 * padrão que a revisão da 11.2 encontrou do lado do BFF, onde três rotas de
 * admin tinham cada uma a sua cópia do proxy e as cópias já divergiam. Uma
 * função, quatro chamadas, e a matriz de autorização da Fase 9 continua
 * enumerando o roteador e exigindo linha para cada rota.
 */
export function requireAdmin(request: FastifyRequest): void {
  if (request.user?.role !== 'ADMIN') {
    throw new ForbiddenError('Admin access required');
  }
}

/**
 * O `sub` de uma sessão que já passou pelo `preHandler` — ou a recusa.
 *
 * Chegar aqui exige assinatura válida, e quem assina é o BFF: um token sem
 * `sub` é sessão inutilizável **emitida por nós**, daí `category: 'internal'`
 * (o leitor está logado e toda rota de conta responde 401, em silêncio — ver
 * `AUTH_SESSION_INCOMPLETE` em `utils/errors.ts`).
 *
 * Havia duas cópias desta conferência (`routes/favorites`, `routes/account`), e
 * a Fase 5 precisava de uma terceira — o `DELETE /api/news/:id` passou a gravar
 * **quem** apagou, e auditoria sem ator não é auditoria. Três cópias inline é o
 * padrão que a revisão da Fase 9 desfez para o `requireAdmin`; a de `account`
 * continua própria porque também exige o e-mail.
 */
export function requireSubject(request: FastifyRequest): string {
  const sub = request.user?.sub;
  if (!sub) {
    throw new UnauthorizedError('Invalid or missing token', {
      code: 'AUTH_SESSION_INCOMPLETE',
      category: 'internal',
    });
  }
  return sub;
}

export default fp(authPlugin);
