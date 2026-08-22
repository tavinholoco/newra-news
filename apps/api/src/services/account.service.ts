import { prisma } from '@newranews/database';
import type { Category, ThemePreference } from '@newranews/database';
import { countFavorites } from './favorite.service';
import { findSubscriberForUser } from './newsletter.service';

export interface PreferencesInput {
  categories?: Category[];
  theme?: ThemePreference;
}

/**
 * O que vale para quem ainda não escolheu nada.
 *
 * A linha de `UserPreference` só nasce no primeiro `PUT` — a leitura devolve o
 * padrão em vez de criar linha por visita, e assim "nunca mexeu" e "escolheu o
 * padrão" continuam sendo a mesma coisa para a tela, sem gravar escolha que o
 * leitor não fez.
 */
const DEFAULT_PREFERENCES = {
  categories: [] as Category[],
  theme: 'SYSTEM' as ThemePreference,
};

export async function getPreferences(userId: string) {
  const stored = await prisma.userPreference.findUnique({ where: { userId } });
  if (!stored) return { ...DEFAULT_PREFERENCES };

  return { categories: stored.categories, theme: stored.theme };
}

/**
 * Grava as preferências. Campo ausente no corpo **não** é campo apagado: a
 * tela pode salvar só o que mexeu, e a categoria escolhida ontem não some
 * porque hoje o leitor trocou o tema.
 */
export async function updatePreferences(userId: string, input: PreferencesInput) {
  const stored = await prisma.userPreference.upsert({
    where: { userId },
    create: {
      userId,
      categories: input.categories ?? DEFAULT_PREFERENCES.categories,
      theme: input.theme ?? DEFAULT_PREFERENCES.theme,
    },
    update: {
      ...(input.categories && { categories: input.categories }),
      ...(input.theme && { theme: input.theme }),
    },
  });

  return { categories: stored.categories, theme: stored.theme };
}

/**
 * Tudo que a tela de conta precisa, numa chamada — o mesmo motivo que fez a
 * Home ter `GET /api/home` em vez de duas requisições que montavam menos
 * página.
 *
 * Retorna null quando o `sub` do token não corresponde a usuário nenhum (conta
 * removida com sessão ainda válida); a rota responde 404.
 */
export async function getAccountOverview(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const [preferences, subscriber, saved] = await Promise.all([
    getPreferences(userId),
    findSubscriberForUser(userId, user.email),
    countFavorites(userId),
  ]);

  return {
    user,
    preferences,
    newsletter: {
      subscribed: subscriber?.status === 'ACTIVE',
      // O e-mail inscrito, que pode não ser o do login — a tela mostra qual é,
      // em vez de deixar o leitor adivinhar por que o estado é esse.
      email: subscriber?.email ?? null,
    },
    saved,
  };
}
