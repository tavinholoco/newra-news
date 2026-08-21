import { ArticleSkeleton } from '@/components/editorial/article-skeleton';

export default function NewsDetailLoading() {
  return (
    <div className='container-editorial py-section'>
      <ArticleSkeleton showImage />
    </div>
  );
}
