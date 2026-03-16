import { Category } from '@newranews/database';

export interface RssSource {
  name: string;
  url: string;
  category?: Category;
}

export const rssSources: RssSource[] = [
  { name: 'G1', url: 'https://g1.globo.com/rss/g1/' },
  { name: 'Folha de S.Paulo', url: 'https://feeds.folha.uol.com.br/mundo/rss091.xml' },
  { name: 'BBC Brasil', url: 'https://feeds.bbci.co.uk/portuguese/rss.xml' },
  { name: 'Reuters', url: 'https://feeds.reuters.com/reuters/topNews' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: Category.TECHNOLOGY },
];
