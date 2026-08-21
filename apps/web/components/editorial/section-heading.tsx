import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  title: string;
  /** `id` do heading, para o `aria-labelledby` da seção que o contém. */
  id?: string;
  /** Destino do "ver tudo". Sem ele, só o título é emitido. */
  href?: string;
  linkLabel?: string;
  className?: string;
}

/**
 * O cabeçalho de uma seção editorial: filete, título e o "ver tudo" (§6.1).
 *
 * O filete não é ornamento — é o que separa dois blocos numa página que não
 * pode usar sombra (§8 dos tokens). Cinco seções desenhando cada uma a sua
 * régua foi o começo do problema de hierarquia que a §2.2 descreve na V1.
 *
 * Não tem `'use client'` nem hook: renderiza no servidor quando o pai é server
 * component e entra no bundle quando o pai é client. As strings chegam
 * traduzidas por prop, dos dois lados.
 */
export function SectionHeading({
  title,
  id,
  href,
  linkLabel,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'mb-6 flex items-end justify-between gap-4 border-b border-line-strong pb-2',
        className,
      )}
    >
      <h2
        id={id}
        className='font-display text-h3 font-bold uppercase tracking-wide text-ink'
      >
        {title}
      </h2>

      {href && linkLabel ? (
        <Link
          href={href}
          className='inline-flex shrink-0 items-center gap-1 text-meta font-medium text-link transition-colors duration-base hover:text-link-hover'
        >
          {linkLabel}
          <ArrowRight className='size-3.5' aria-hidden='true' />
        </Link>
      ) : null}
    </div>
  );
}
