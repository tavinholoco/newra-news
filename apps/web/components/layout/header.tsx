import { Suspense } from 'react';
import { TopBar } from '@/components/layout/top-bar';
import { Masthead } from '@/components/layout/masthead';
import { EditorialNav } from '@/components/layout/editorial-nav';

/**
 * O shell do topo, nas três linhas da §10: informação de sistema, marca e
 * busca, assuntos. É o que separa navegação editorial de barra de aplicativo —
 * a V1 empilhava tudo numa faixa de 64 px.
 *
 * `sticky` sem altura declarada: o menu mobile se ancora por `top-full` e o
 * `<main>` cresce por flex, então nada aqui dentro precisa saber quanto o
 * header mede.
 *
 * `isolate` cria o contexto de empilhamento explicitamente, em vez de deixá-lo
 * como efeito colateral do `z-index` — é o que mantém o scrim do menu acima do
 * conteúdo da página e abaixo do painel.
 */
export function Header() {
  return (
    <header className='sticky top-0 z-header isolate border-b border-line-strong bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80'>
      <TopBar />
      <Masthead />
      {/* `useSearchParams` dentro de página estática exige fronteira de
          Suspense — sem ela o build do Next falha na pré-renderização.

          O fallback repete a estrutura de um item da faixa em vez de declarar
          a altura em pixels: assim ele acompanha a escala tipográfica e o
          padding sem ninguém remedir nada, e não há salto de layout. */}
      <Suspense
        fallback={
          <div className='container-editorial' aria-hidden='true'>
            <span className='inline-flex border-b-2 border-transparent px-3 py-2.5 text-body-sm'>
              &nbsp;
            </span>
          </div>
        }
      >
        <EditorialNav className='border-b-0' />
      </Suspense>
    </header>
  );
}
