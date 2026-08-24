import { encode } from 'next-auth/jwt';
import type { BrowserContext } from '@playwright/test';

/**
 * **A sessão de teste é forjada, e é a única forma honesta de fazer isto.**
 *
 * Os dois fluxos com login da §25 — Conta e Admin — precisam de sessão, e a
 * sessão deste produto nasce de OAuth (Google/GitHub). Automatizar o consenti-
 * mento de um provedor num runner é frágil, quebra quando o provedor mexe na
 * tela, e exige guardar credenciais de uma conta real.
 *
 * O caminho que a §11.T já antecipava — *"os fluxos com login pedem uma conta de
 * teste e um segredo, o mesmo tipo de decisão que o `JOB_SECRET` e o
 * `CRON_SECRET` já resolveram"* — é assinar o cookie de sessão com o mesmo
 * `NEXTAUTH_SECRET`, que é exatamente o que o next-auth faz depois do OAuth.
 * O que se pula é o provedor; o resto do caminho é o de verdade: o cookie passa
 * pelo mesmo `getServerSession`, o BFF assina o mesmo JWT, a API valida do mesmo
 * jeito.
 *
 * ## O que isto custa, e por que os fluxos ficam desligados por padrão
 *
 * Rodar isto contra produção põe o **`NEXTAUTH_SECRET` de produção** dentro do
 * runner do CI. Quem tem escrita no repositório pode escrever um workflow que o
 * leia; segredo em Actions é mascarado no log, não protegido de um workflow
 * malicioso. Para um projeto de portfólio com um mantenedor isso é aceitável, e
 * é uma decisão de quem é dono do segredo — não do teste.
 *
 * Por isso: **sem os segredos, os specs autenticados são pulados, e o pulo é
 * barulhento** (o passo do workflow imprime quais fluxos correram). Guarda que
 * passa vazia sem ninguém notar é a armadilha que esta fase inteira foi caçar.
 *
 * ## Como ligar
 *
 * Três segredos no repositório, e um quarto para o fluxo de admin:
 *
 * | Segredo | O que é |
 * |---|---|
 * | `E2E_NEXTAUTH_SECRET` | o mesmo `NEXTAUTH_SECRET` da Vercel |
 * | `E2E_USER_ID` | o **id da API** (UUID) de uma conta de leitor de teste |
 * | `E2E_USER_EMAIL` | o e-mail dessa conta |
 * | `E2E_ADMIN_USER_ID` | o id de uma conta com `role: ADMIN` |
 *
 * O `E2E_USER_ID` é o id do banco, e não o do provedor — é a mesma distinção
 * que a §11.6 corrigiu no callback de sign-in. Com ele no token, o `jwt` não
 * dispara o upsert: a sessão já está confirmada.
 */

export interface TestIdentity {
  id: string;
  email: string;
  role?: 'USER' | 'ADMIN';
}

const secret = process.env.E2E_NEXTAUTH_SECRET;

/** Há segredo para forjar sessão de leitor? */
export const canSignIn = Boolean(secret && process.env.E2E_USER_ID);

/** E de admin? */
export const canSignInAsAdmin = Boolean(secret && process.env.E2E_ADMIN_USER_ID);

export const READER: TestIdentity = {
  id: process.env.E2E_USER_ID ?? '',
  email: process.env.E2E_USER_EMAIL ?? 'e2e@newranews.test',
  role: 'USER',
};

export const ADMIN: TestIdentity = {
  id: process.env.E2E_ADMIN_USER_ID ?? '',
  email: process.env.E2E_USER_EMAIL ?? 'e2e@newranews.test',
  role: 'ADMIN',
};

/**
 * O nome do cookie depende do esquema, e não é detalhe.
 *
 * O next-auth acrescenta o prefixo `__Secure-` quando a `NEXTAUTH_URL` é HTTPS,
 * e o navegador **recusa** um cookie com esse prefixo que não venha com
 * `secure`. Errar o nome aqui não dá erro: dá uma sessão que simplesmente não
 * existe, e um teste que reprova sem dizer por quê.
 */
function cookieName(baseURL: string): string {
  return baseURL.startsWith('https://')
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';
}

export async function signIn(
  context: BrowserContext,
  baseURL: string,
  identity: TestIdentity,
): Promise<void> {
  if (!secret) throw new Error('E2E_NEXTAUTH_SECRET não configurado');

  const token = await encode({
    secret,
    maxAge: 30 * 24 * 60 * 60,
    token: {
      // `id` é o id **da API**: com ele presente, o callback `jwt` não dispara
      // o upsert, que é o comportamento de uma sessão já confirmada.
      id: identity.id,
      sub: identity.id,
      email: identity.email,
      name: 'E2E',
      role: identity.role,
    },
  });

  const url = new URL(baseURL);
  await context.addCookies([
    {
      name: cookieName(baseURL),
      value: token,
      domain: url.hostname,
      path: '/',
      httpOnly: true,
      secure: url.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);
}
