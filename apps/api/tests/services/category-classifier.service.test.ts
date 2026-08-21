import { describe, it, expect } from 'vitest';
import { Category } from '@newranews/database';
import { classifyCategory } from '../../src/services/category-classifier.service';

describe('classifyCategory', () => {
  it('should classify TECHNOLOGY by keywords', () => {
    const category = classifyCategory(
      'Google anuncia novo smartphone com chip de inteligência artificial',
      'A empresa apresentou o aparelho em evento de tecnologia.',
    );

    expect(category).toBe(Category.TECHNOLOGY);
  });

  it('should classify POLITICS by keywords', () => {
    const category = classifyCategory(
      'Senado aprova projeto de lei com impacto nas eleições',
      'Deputados e senadores votaram a proposta em Brasília.',
    );

    expect(category).toBe(Category.POLITICS);
  });

  it('should classify ECONOMY by keywords', () => {
    const category = classifyCategory(
      'Dólar cai e Bolsa sobe com juros do Banco Central',
      'Investidores reagem à nova taxa de inflação e aos lucros das empresas.',
    );

    expect(category).toBe(Category.ECONOMY);
  });

  it('should classify SPORTS by keywords', () => {
    const category = classifyCategory(
      'Futebol: time vence clássico e assume a liderança do campeonato',
      'O clube venceu por 2 a 0 com gol no segundo tempo.',
    );

    expect(category).toBe(Category.SPORTS);
  });

  it('should classify SCIENCE by keywords', () => {
    const category = classifyCategory(
      'Cientistas anunciam nova descoberta sobre o planeta Marte',
      'Pesquisa da NASA revela dados inéditos sobre a superfície do planeta.',
    );

    expect(category).toBe(Category.SCIENCE);
  });

  it('should classify ENTERTAINMENT by keywords', () => {
    const category = classifyCategory(
      'Novo filme de estúdio famoso estreia nos cinemas com elenco premiado',
      'A série ganhou novo episódio e a cantora lançou um álbum na mesma semana.',
    );

    expect(category).toBe(Category.ENTERTAINMENT);
  });

  it('should classify HEALTH by keywords', () => {
    const category = classifyCategory(
      'Campanha de vacinação contra a dengue avança nos hospitais',
      'Médicos reforçam que pacientes com sintomas devem procurar tratamento.',
    );

    expect(category).toBe(Category.HEALTH);
  });

  it('should fall back to WORLD when no keyword matches', () => {
    const category = classifyCategory(
      'Notícia genérica de interesse geral',
      'Apenas uma descrição sem termos específicos de nenhuma área.',
    );

    expect(category).toBe(Category.WORLD);
  });

  it('should be case-insensitive', () => {
    const category = classifyCategory('FUTEBOL: CLUBE VENCE PARTIDA', 'resumo');

    expect(category).toBe(Category.SPORTS);
  });

  it('should be insensitive to accents', () => {
    const category = classifyCategory(
      'Saúde: vacinação contra a gripe começa no SUS',
      'Médicos recomendam tratamento precoce dos sintomas.',
    );

    expect(category).toBe(Category.HEALTH);
  });

  it('should give more weight to title than description', () => {
    const category = classifyCategory(
      'Futebol: time vence e assume a liderança do campeonato',
      'Enquanto isso, a bolsa cai e investidores aguardam os juros do Banco Central.',
    );

    expect(category).toBe(Category.SPORTS);
  });

  it('should classify from description alone when title is generic', () => {
    const category = classifyCategory(
      'Acompanhe ao vivo',
      'Novo estudo da universidade analisa espécies descobertas no laboratório.',
    );

    expect(category).toBe(Category.SCIENCE);
  });

  // Repetição conta, mas até um teto de 2 por palavra. Somar toda ocorrência
  // era o que deixava uma palavra citada nove vezes num texto longo decidir a
  // categoria sozinha.
  it('should count repeated keywords only up to the cap', () => {
    const category = classifyCategory(
      'Saúde pública: saúde em primeiro lugar na saúde da população',
      'resumo',
    );

    expect(category).toBe(Category.HEALTH);
  });

  it('should not let one keyword repeated many times outweigh a broader match', () => {
    // 'show' nove vezes (teto 2 → 2 pontos) contra cinco palavras distintas de
    // saúde no corpo. A abrangência ganha da repetição — e cinco é o piso
    // medido para a descrição decidir sozinha.
    const category = classifyCategory(
      'Balanço da semana',
      `${'show '.repeat(9)} doença tratamento diagnóstico hospital vacina`,
    );

    expect(category).toBe(Category.HEALTH);
  });

  it('should use priority order to break ties', () => {
    // "pesquisa" (Science) e "tratamento" (Health) empatam em 2 pontos no título;
    // a descrição não pontua → a prioridade (Science antes de Health) decide.
    const category = classifyCategory('Pesquisa sobre tratamento', 'resumo');

    expect(category).toBe(Category.SCIENCE);
  });
});

/**
 * Regressões medidas contra a resposta de `/api/home` de produção em
 * 21/08/2026, quando a Home da V2 passou a agrupar por categoria e o erro saiu
 * da grade indiferenciada da V1 para a primeira dobra.
 *
 * Os textos abaixo são recortes das matérias reais, preservando as palavras que
 * disparavam a classificação errada.
 */
describe('classifyCategory — vocabulário ambiente não decide categoria', () => {
  it('should not file a police story under TECHNOLOGY for saying "redes sociais"', () => {
    const category = classifyCategory(
      'Primas desaparecidas no PR: principal suspeito é morto em abordagem',
      'A família usou as redes sociais para pedir informações. As redes sociais ' +
        'foram usadas na divulgação e a polícia analisou o celular e a internet.',
    );

    expect(category).toBe(Category.WORLD);
  });

  it('should not file a homicide story under TECHNOLOGY for mentioning a phone chip', () => {
    const category = classifyCategory(
      'Justiça converte em preventiva prisão de suspeito de matar esposa',
      'O celular da vítima teve o chip retirado, e as redes sociais foram apagadas.',
    );

    expect(category).toBe(Category.WORLD);
  });

  // "poço sem fundo" é um buraco no chão, não um fundo de investimento — e a
  // palavra estava no **título**, então nem o piso de descrição a segurava.
  it('should not file a car recovery under ECONOMY for the homonym "fundo"', () => {
    const category = classifyCategory(
      'Mergulhadores encontram em ‘poço sem fundo’ carro intacto roubado',
      'O carro estava no fundo do poço. O fundo tem mais de 30 metros.',
    );

    expect(category).toBe(Category.WORLD);
  });

  it('should not file a traffic crash under ECONOMY for naming the bus company', () => {
    const category = classifyCategory(
      'Roda se solta de ônibus em movimento e atinge carro estacionado',
      'A empresa de ônibus informou que vai apurar o caso.',
    );

    expect(category).toBe(Category.WORLD);
  });

  it('should not file a domestic violence story under SPORTS for saying "clube"', () => {
    const category = classifyCategory(
      'Piauí tem mais de 200 agressores de mulheres monitorados por tornozeleira',
      'O agressor foi flagrado perto do clube onde a vítima estava. ' +
        'O clube acionou a polícia e o clube reforçou a segurança.',
    );

    expect(category).toBe(Category.WORLD);
  });

  // "programação" quer dizer grade de atrações muito mais vezes do que código.
  it('should not file a cultural listing under TECHNOLOGY for "programação"', () => {
    const category = classifyCategory(
      'Conheça a festa que fez São Tomé das Letras trocar o silêncio pela música',
      'A programação tem shows, música e banda. A programação segue no domingo ' +
        'com artistas locais e um festival de rua.',
    );

    expect(category).toBe(Category.ENTERTAINMENT);
  });
});

describe('classifyCategory — evidência de título vence evidência de corpo', () => {
  // Caso real: Entretenimento pelo título ("influenciador") empatava com
  // Política por quatro palavras soltas no corpo, e a ordem de prioridade
  // entregava a matéria para Política.
  it('should prefer the category the title points at when scores tie', () => {
    const category = classifyCategory(
      'Justiça concede habeas corpus a influenciador e impõe medidas cautelares',
      'O caso passou pela câmara, e um deputado, um vereador e dois candidatos ' +
        'comentaram a decisão.',
    );

    expect(category).toBe(Category.ENTERTAINMENT);
  });

  it('should still classify from the description when the title says nothing', () => {
    const category = classifyCategory(
      'Agenda cultural do fim de semana',
      'Tem música, show, festival, banda e cantor na cidade.',
    );

    expect(category).toBe(Category.ENTERTAINMENT);
  });

  // O piso medido: cinco palavras distintas. Duas não classificam.
  it('should fall back to WORLD when the description is below the measured floor', () => {
    const category = classifyCategory(
      'Incêndio atinge área de mata no parque',
      'A secretaria de saúde acompanha o caso e cita risco de tratamento.',
    );

    expect(category).toBe(Category.WORLD);
  });
});

describe('classifyCategory — negócios continuam sendo economia', () => {
  it('should classify a debt negotiation by its business vocabulary', () => {
    const category = classifyCategory(
      'Braskem diz que negociações com credores se intensificaram',
      'A companhia informou que segue em conversas com os credores.',
    );

    expect(category).toBe(Category.ECONOMY);
  });

  it('should classify a dividend announcement', () => {
    const category = classifyCategory(
      'Ser Educacional aprova dividendos intermediários; veja o valor',
      'O pagamento foi aprovado pelo conselho.',
    );

    expect(category).toBe(Category.ECONOMY);
  });
});
