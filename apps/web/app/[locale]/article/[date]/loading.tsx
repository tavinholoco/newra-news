import { ArticleSkeleton } from '@/components/editorial/article-skeleton';

export default function ArticleDetailLoading() {
  return (
    <div className='container-editorial py-section'>
      {/* Sem imagem: o briefing não tem uma para chamar de sua — as fotos
          pertencem às matérias que o originaram. */}
      <ArticleSkeleton />
    </div>
  );
}
