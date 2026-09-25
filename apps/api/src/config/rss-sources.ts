import { Category } from '@newranews/database';

export interface RssSource {
  name: string;
  url: string;
  category?: Category;
}

export const rssSources: RssSource[] = [
  // Feeds genéricos — sem categoria fixa; a categoria de cada notícia é
  // classificada por palavras-chave (título/descrição) em category-classifier.service.ts
  { name: 'G1', url: 'https://g1.globo.com/rss/g1/' },
  { name: 'Folha de S.Paulo', url: 'https://feeds.folha.uol.com.br/mundo/rss091.xml' },
  { name: 'BBC Brasil', url: 'https://feeds.bbci.co.uk/portuguese/rss.xml' },
  // **A `Reuters` saiu em 24/08/2026, e não era URL errada: o domínio não
  // existe.** `feeds.reuters.com` devolve NXDOMAIN — a Reuters desligou os
  // feeds RSS públicos, e não há substituto. A fonte foi medida em zero itens
  // ao mapear o acervo na Fase 10, e continuou na lista porque
  // `Promise.allSettled` no `fetchFromRss` descarta a rejeição em silêncio:
  // cada execução do pipeline gastava uma resolução de DNS fadada a falhar e
  // ninguém via. O aviso por fonte que o provider passou a emitir é o que
  // torna a próxima visível.

  // Feeds especializados — categoria fixa no source
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: Category.TECHNOLOGY },
  { name: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/', category: Category.ECONOMY },
  { name: 'Valor Econômico', url: 'https://valor.globo.com/rss/valor/', category: Category.ECONOMY },
  { name: 'ESPN Brasil', url: 'https://www.espn.com.br/rss/', category: Category.SPORTS },
  { name: 'Trivela', url: 'https://trivela.com.br/feed/', category: Category.SPORTS },
  { name: 'Olhar Digital', url: 'https://olhardigital.com.br/feed/', category: Category.SCIENCE },
  { name: 'Superinteressante', url: 'https://super.abril.com.br/feed/', category: Category.SCIENCE },
  { name: 'Veja Saúde', url: 'https://saude.abril.com.br/feed/', category: Category.HEALTH },
  // **O `Drauzio Varella` saiu em 25/09/2026, e não por URL errada: o feed
  // responde 200 em menos de 0,6 s de fora do Render e falha em ~1,8 s
  // (`fetch failed`) saindo dele** — cara de bloqueio de IP de datacenter.
  // Falhou em 9 dos 12 runs de produção desde 05/09, quatro seguidos (o
  // gatilho "Fonte quebrada" do §16 do plano de observabilidade), e deixava a
  // etapa 1 degradada na maioria dos dias. Contribuía com ~8% dos itens de
  // Saúde. Medido no ensaio de aceitação (Fase 12, A7.05). Uma fonte nova de
  // Saúde entra depois de medida **saindo do Render**, não daqui.
];
