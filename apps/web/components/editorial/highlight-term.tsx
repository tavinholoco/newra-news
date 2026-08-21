import { Fragment } from 'react';

interface HighlightTermProps {
  text: string;
  /** O termo buscado. Vazio devolve o texto intacto. */
  term: string;
}

/** Escapa o que o usuário digitou antes de virar regex — `C++` não é quantificador. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Destaca o termo buscado dentro de uma manchete ou dek (§7).
 *
 * `<mark>` e não um `<span>` colorido: o elemento já significa "relevante para
 * o que se procura", então o leitor de tela também recebe a informação, e o
 * destaque não depende só de cor — que é o que a §15 cobra.
 *
 * A busca do backend é `contains` sem acento normalizado, então casar aqui pelo
 * literal produz exatamente o mesmo recorte que trouxe a matéria para a lista.
 * Casar de forma mais esperta destacaria trecho que não foi o motivo do
 * resultado, o que é pior do que não destacar.
 */
export function HighlightTerm({ text, term }: HighlightTermProps) {
  const trimmed = term.trim();
  if (!trimmed) return <>{text}</>;

  const parts = text.split(new RegExp(`(${escapeRegExp(trimmed)})`, 'gi'));
  if (parts.length === 1) return <>{text}</>;

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === trimmed.toLowerCase() ? (
          <mark
            key={index}
            className='rounded-sm bg-surface-accent px-0.5 text-ink'
          >
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
