import { Category } from '@newranews/database';

export interface RssSource {
  name: string;
  url: string;
  category?: Category;
  /**
   * **O fuso que o feed de fato usa no `pubDate`, quando o que ele declara é
   * mentira.** Com isto, a hora de parede do `pubDate` é lida neste deslocamento
   * e o rótulo do feed é ignorado. Só para feed medido: ver a ESPN, abaixo.
   */
  pubDateZone?: string;
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
  // **A ESPN escreve a hora de Brasília com o rótulo `EST`** (UTC−5): às 17:28
  // de Brasília o item mais novo vinha como `Fri, 25 Sep 2026 17:24:47 EST`,
  // que o `Date` lê como 22:24 UTC — duas horas no futuro. Todo item dela
  // ficava 2 h mais novo do que é, e o pipeline das 08:00 escolhe as 15 notícias
  // mais recentes por `publishedAt`: em 01/09/2026, 11 das 15 matérias citadas
  // no briefing eram da ESPN; em 15/09, 7; no ensaio de 25/09, 7. Medido no ensaio
  // de aceitação (Fase 12, M4). Se um dia o feed passar a escrever o
  // deslocamento certo, isto continua certo (a hora de parede é a mesma); se
  // passar a escrever UTC, isto a atrasa 3 h — e é hora de tirar a linha.
  { name: 'ESPN Brasil', url: 'https://www.espn.com.br/rss/', category: Category.SPORTS, pubDateZone: '-03:00' },
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
