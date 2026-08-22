import { ChevronRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { BreadcrumbStep } from '@/lib/json-ld';
import { cn } from '@/lib/utils';

interface BreadcrumbProps {
  /**
   * A mesma lista que vai para `breadcrumbJsonLd`. **É de propósito que seja a
   * mesma**: o Google pede que o dado estruturado descreva a trilha visível, e
   * duas listas paralelas divergem no primeiro degrau que alguém renomear.
   */
  steps: readonly BreadcrumbStep[];
  /** Rótulo do `<nav>` — a página traduz, o componente não sabe idioma. */
  ariaLabel: string;
  className?: string;
}

/**
 * A trilha de navegação das telas de leitura (§16).
 *
 * **Substitui o "← voltar" que estava ali, e não se soma a ele.** Dois
 * controles de volta na mesma linha seriam a mesma ação duas vezes; a trilha faz
 * o que o link fazia e ainda diz onde a página está.
 *
 * **Degrau sem `path` não é link.** É a página atual: leva `aria-current` e fica
 * como texto. Link para a própria página é destino que não muda nada, e para
 * quem navega por teclado é uma parada a mais sem função.
 *
 * **O separador é `aria-hidden`.** Quem ouve a página recebe a estrutura pelo
 * `<ol>`; o chevron narrado a cada degrau seria ruído.
 *
 * Server component: não há estado nem evento aqui, e o `Link` do next-intl é
 * quem cuida do prefixo de idioma.
 */
export function Breadcrumb({ steps, ariaLabel, className }: BreadcrumbProps) {
  return (
    <nav aria-label={ariaLabel} className={cn('min-w-0', className)}>
      {/* Uma linha, sempre. Com `flex-wrap`, o degrau atual pedia a largura
          inteira **antes** de truncar e ia sozinho para a segunda linha — a
          trilha ocupava 52px de altura numa tela de 1280. Sem quebra, os
          degraus de ancestral ficam `shrink-0` e só o atual encolhe, que é a
          ordem certa: perder o fim da manchete é aceitável, perder "Notícias"
          não. */}
      <ol className='flex items-center gap-x-1.5 text-body-sm text-ink-secondary'>
        {steps.map((step, index) => (
          <li
            key={`${step.name}-${index}`}
            className='flex min-w-0 items-center gap-x-1.5'
          >
            {index > 0 ? (
              <ChevronRight
                className='size-3.5 shrink-0 text-ink-muted'
                aria-hidden='true'
              />
            ) : null}

            {step.path === undefined ? (
              // `truncate` só no degrau atual: é o único que carrega manchete, e
              // manchete inteira empurra os degraus anteriores para fora da tela
              // no mobile.
              <span
                aria-current='page'
                className='truncate font-medium text-ink'
                title={step.name}
              >
                {step.name}
              </span>
            ) : (
              <Link
                // A Home é `''` no caminho canônico (`/pt-BR`, sem barra final,
                // que é o que entra no sitemap e no JSON-LD) e `'/'` no `Link`,
                // que é o que o next-intl entende como raiz do idioma.
                href={step.path === '' ? '/' : step.path}
                className='shrink-0 transition-colors duration-fast hover:text-link'
              >
                {step.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
