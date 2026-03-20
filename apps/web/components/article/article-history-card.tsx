import Link from 'next/link';
import type { Article } from '@newranews/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Calendar, Newspaper } from 'lucide-react';
import { formatArticleDate, toDateSlug } from '@/lib/format';

interface ArticleHistoryCardProps {
  article: Article;
}

export function ArticleHistoryCard({ article }: ArticleHistoryCardProps) {
  return (
    <Link href={`/article/${toDateSlug(article.date)}`} className='group block'>
      <Card className='h-full border-l-4 border-l-brand-600 transition-shadow duration-200 group-hover:shadow-md'>
        <CardHeader>
          <CardTitle className='font-display line-clamp-2 text-base leading-snug group-hover:text-brand-600'>
            {article.title}
          </CardTitle>
          <CardDescription className='line-clamp-3'>
            {article.summary}
          </CardDescription>
        </CardHeader>

        <CardFooter className='mt-auto gap-3 text-xs text-muted-foreground'>
          <span className='flex items-center gap-1'>
            <Calendar className='h-3 w-3' />
            {formatArticleDate(article.date)}
          </span>
          <span className='flex items-center gap-1'>
            <Newspaper className='h-3 w-3' />
            {article.newsCount} fontes
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
