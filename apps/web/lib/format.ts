import type { Category } from '@newranews/types';

export const CATEGORY_LABELS: Record<Category, string> = {
  TECHNOLOGY: 'Tecnologia',
  POLITICS: 'Política',
  ECONOMY: 'Economia',
  SPORTS: 'Esportes',
  SCIENCE: 'Ciência',
  ENTERTAINMENT: 'Entretenimento',
  WORLD: 'Mundo',
  HEALTH: 'Saúde',
};

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
