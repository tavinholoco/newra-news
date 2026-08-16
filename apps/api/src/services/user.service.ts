import { prisma } from '@newranews/database';
import { env } from '../config/env';

export interface UpsertUserInput {
  email: string;
  name?: string | null;
  image?: string | null;
}

function roleForEmail(email: string): 'ADMIN' | 'USER' {
  const adminEmails = env.ADMIN_EMAILS.split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email) ? 'ADMIN' : 'USER';
}

/**
 * Cria o usuário no primeiro login (OAuth) ou atualiza nome/imagem/role nos
 * logins seguintes. O role segue ADMIN_EMAILS (lista de e-mails do ambiente),
 * então mudanças na lista valem no próximo sign-in.
 */
export async function upsertUser({ email, name, image }: UpsertUserInput) {
  const normalizedEmail = email.trim().toLowerCase();
  const role = roleForEmail(normalizedEmail);

  return prisma.user.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      name: name ?? null,
      image: image ?? null,
      role,
    },
    update: {
      name: name ?? undefined,
      image: image ?? undefined,
      role,
    },
  });
}
