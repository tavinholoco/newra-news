import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import type { ApiResponse, AuthUpsertResult } from '@newranews/types';
import { signAuthJwt } from '@/lib/jwt';
import { API_TIMEOUT_MS } from '@/lib/timeouts';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/**
 * Quanto esperar antes de tentar de novo criar o usuario na API.
 *
 * O callback `jwt` roda toda vez que a sessao e lida — nas paginas de conta, no
 * guard de `/admin` e em cada rota de BFF. Sem espera, uma API fora do ar
 * acrescentaria uma chamada de 8 s **a cada requisicao** daquele leitor. Cinco
 * minutos e curto o bastante para a sessao se consertar dentro da mesma visita
 * e longo o bastante para nao virar martelo.
 */
const UPSERT_RETRY_COOLDOWN_MS = 5 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    }),
  ],
  /**
   * **A duração era o default silencioso do next-auth, e agora é decisão.**
   *
   * O que o next-auth entrega sozinho já está certo e fica onde está: o cookie
   * é `httpOnly` (nenhum script lê a sessão), `sameSite: 'lax'` (não viaja em
   * requisição de outro site, exceto navegação de topo por GET) e ganha
   * `secure` + prefixo `__Secure-` quando a `NEXTAUTH_URL` é HTTPS. **Não
   * declarar `cookies` à mão é parte da decisão** — fixar o nome aqui tiraria
   * o prefixo em produção e derrubaria toda sessão viva no deploy seguinte.
   *
   * O que faltava era o prazo escrito. Trinta dias é o default, e continua
   * sendo o número certo para este produto — a sessão só dá acesso a salvar
   * matéria e trocar preferência, o login é OAuth (não há senha a proteger) e
   * expirar semanalmente cobraria um round-trip no provedor por um ganho que
   * não existe. `updateAge` renova o token no máximo uma vez por dia: sem ele,
   * toda requisição reescreveria o cookie.
   */
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  // Página customizada de sign-in (app/[locale]/signin) com os botões
  // Google/GitHub localizados. Sem isso, signIn() sem provider cai num loop
  // na home (dead-end) e a página padrão do next-auth não é localizada.
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    /**
     * **A sessão não afirma uma identidade que a API não confirmou.**
     *
     * O usuário é criado na API por `POST /api/auth/upsert`, com um JWT de
     * escopo `auth-upsert` — a API fica em outro host e não recebe o cookie do
     * next-auth. Até a Fase 10 esse `upsert` acontecia **só no primeiro
     * sign-in**, e a falha dele deixava dois estados ruins, que a suíte
     * congelou de propósito para que a decisão da 11 fosse visível:
     *
     * - **falha de rede ou resposta não-ok** → `token.id` ficava `undefined`, a
     *   pessoa parecia logada e toda ação de conta devolvia 401 pelo BFF —
     *   por trinta dias, que é a duração da sessão;
     * - **200 sem `data`** → `token.id` caía no id do **provedor**, e esse é o
     *   caso caro: o BFF assinava um JWT com um `sub` que não existe no banco,
     *   `GET /api/account` devolvia 404 e **salvar uma matéria estourava a
     *   chave estrangeira** — 500 numa tela que dizia estar logada.
     *
     * As duas saem daqui. O id do provedor **nunca** vira `token.id`, e o
     * upsert é retentado enquanto a API não tiver confirmado — não num job, e
     * sim na próxima vez que a sessão for lida, que é exatamente quando o dado
     * passa a fazer falta. Com `UPSERT_RETRY_COOLDOWN_MS`, uma API fora do ar não
     * acrescenta uma chamada a cada requisição: acrescenta uma a cada cinco
     * minutos, e a sessão se conserta sozinha na primeira que passar.
     */
    async jwt({ token, user }) {
      const confirmedByApi = typeof token.id === 'string' && token.id.length > 0;
      const cooling = Date.now() < (token.upsertRetryAfter ?? 0);

      if (!confirmedByApi && !cooling) {
        // No primeiro sign-in a identidade vem do provedor; nas retentativas,
        // do próprio token — que é onde o next-auth guarda o que já sabe.
        const identity = {
          sub: user?.id ?? token.sub ?? '',
          email: user?.email ?? token.email ?? '',
          name: user?.name ?? token.name,
          image: user?.image ?? token.picture,
        };

        try {
          const jwt = await signAuthJwt({
            sub: identity.sub,
            email: identity.email,
            name: identity.name,
            image: identity.image,
            purpose: 'auth-upsert',
          });

          const response = await fetch(`${API_BASE_URL}/auth/upsert`, {
            method: 'POST',
            // Este é o `fetch` mais caro do produto para o leitor: no primeiro
            // sign-in ele acontece com a pessoa olhando a tela de carregamento
            // do provedor OAuth. Sem prazo, uma API dormindo pendurava o login
            // inteiro — e, nas retentativas, a página de conta junto.
            signal: AbortSignal.timeout(API_TIMEOUT_MS),
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({
              email: identity.email,
              name: identity.name,
              image: identity.image,
            }),
          });

          if (response.ok) {
            // `Partial` porque isto é JSON de rede, e o tipo descreve o
            // contrato, não a garantia: uma resposta 200 sem `data` é possível
            // e o `?.` abaixo é quem trata. O tipo compartilhado entra aqui
            // para que a rota da identidade deixe de ser a única que o web lia
            // por uma forma escrita à mão — ver `AuthUpsertResult`.
            const body = (await response.json()) as Partial<
              ApiResponse<AuthUpsertResult>
            >;
            // **Sem `?? identity.sub`.** O id do provedor não é o id da API, e
            // gravá-lo aqui era o que fazia o BFF assinar um `sub` inexistente.
            if (body.data?.id) {
              token.id = body.data.id;
              token.role = body.data.role;
              delete token.upsertRetryAfter;
            }
          }
        } catch {
          // Falha de rede, TLS ou prazo estourado. Não derruba o login: a
          // pessoa continua navegando, e a retentativa abaixo cuida do resto.
        }

        if (typeof token.id !== 'string') {
          token.upsertRetryAfter = Date.now() + UPSERT_RETRY_COOLDOWN_MS;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // Pode sair `undefined`, e o tipo diz isso. É o estado "a API ainda não
        // confirmou esta conta", e quem o trata é o `proxyToApi`, que responde
        // 401 em vez de assinar um token para um usuário que não existe.
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
