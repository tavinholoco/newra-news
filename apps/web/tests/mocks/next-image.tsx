import type { ImgHTMLAttributes } from 'react';

type MockImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean;
  priority?: boolean;
};

/**
 * Stand-in de `next/image` para as suítes de card.
 *
 * `fill` e `priority` são props do componente do Next, não atributos de DOM:
 * repassá-las cruas para o `<img>` faz o React avisar "Received `true` for a
 * non-boolean attribute" e **descartar** o atributo, o que deixaria qualquer
 * asserção sobre elas passando por engano. Aqui elas viram `data-*`, que é
 * atributo de verdade e pode ser afirmado.
 */
export function MockNextImage({ fill, priority, ...props }: MockImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      {...props}
      data-fill={String(Boolean(fill))}
      data-priority={String(Boolean(priority))}
    />
  );
}
