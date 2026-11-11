/**
 * O corpo do briefing de **10/11/2026**, como está gravado em produção
 * (`Article.content`, lido no Neon em 11/11/2026; `modelVersion`
 * `openai/gpt-oss-20b` — o Groq serviu o dia).
 *
 * É o caso real que achou o defeito do P6 do plano de ação de 11/11: cinco
 * seções em `##`, cada uma com um `### Relevância`, e **um `# Síntese` no
 * fim**. `parseArticleBody` dava o `h2` à profundidade mais rasa onde quer que
 * ela estivesse, então o `#` do fim virava `h2` e empurrava os `##` de antes
 * para `h3` — e a página `/pt-BR/article/2026-11-10` saltava do `h1` do título
 * para um `h3` (`heading-order`). Guarda com caso real, não inventado.
 */
export const BRIEFING_2026_11_10 = `A terça-feira de hoje trouxe um panorama diversificado: a Justiça se despediu de um longo inquérito, os mercados se movimentam em meio a decisões monetárias e a economia apresenta resultados mistos, enquanto a segurança pública vive intensos episódios de violência e as redes sociais continuam a vibrar com a nova crise de confiança. No setor de saúde, sinais de retorno da Covid-19 nas capitais privadas chamam a atenção. Em tecnologia, o nome de um dos gigantes do setor de IA ganha o centro das atenções por uma polêmica inusitada.

## 1. A Justiça fecha o ciclo das fake news, mas a tensão permanece no STF

O **Supremo Tribunal Federal** encerrou, depois de **sete anos**, o inquérito sobre a divulgação de notícias falsas, decisão tomada pelo presidente **Edson Fachin**. O prazo longo se deveu à complexidade dos fatos investigados e à necessidade de separar o processo da figura de Alexandre de Moraes. Mesmo com o encerramento, o tribunal enfrenta outra polêmica: o caso **Master**, que continua a gerar debate sobre a atuação dos magistrados e a independência judiciária. A medida de Fachin — retirar o inquérito das mãos de Moraes e arquivar o processo — foi vista como um passo para restaurar a confiança nas instituições, mas não elimina a crítica ao procedimento, que muitos consideram insuficiente e demorado.

### Relevância
- **Credibilidade institucional**: a decisão reflete a tentativa de equilibrar a necessidade de investigação com o direito ao devido processo.
- **Impacto político**: a tensão entre o presidente do STF e a Procuradoria-Geral da República demonstra a fragilidade das relações internas no Judiciário.
- **Sentido público**: a população continua a questionar a eficácia das instituições ao lidar com desinformação.

## 2. Mercado e economia: volatilidade, decisão do Copom e resultados corporativos

Os índices futuros dos Estados Unidos operam de forma mista antes da divulgação de dados de inflação, sinalizando cautela entre os investidores. No Brasil, o **Copom** divulgou sua ata mais recente, destacando a manutenção das metas de inflação e a necessidade de ajustes nos juros. Enquanto isso, a **Embraer** registrou um lucro ajustado em queda de 15,6% no terceiro trimestre, porém apresentou receita de **R$ 12,1 bilhões**, um aumento de 11% em relação ao ano anterior, atingindo recorde histórico para o trimestre.

### Relevância
- **Indicadores globais**: a performance dos futuros norte‑americanos influencia diretamente o comportamento do **Ibovespa**, que os traders monitoram de perto.
- **Política monetária**: a ata do Copom sinaliza a postura do Banco Central em relação ao controle inflacionário, impactando o custo de crédito e a confiança do mercado.
- **Desempenho corporativo**: a queda de lucro da Embraer pode afetar os preços de suas ações, enquanto a alta de receita reforça a resiliência da empresa frente a desafios globais.

## 3. Segurança pública em foco: operações policiais, ataques rurais e acidentes de trânsito

A Polícia Federal lançou a **Operação Poké’Exa** para investigar ataques a propriedades rurais em **Mato Grosso do Sul**, seguindo uma série de crimes ocorridos em junho. Simultaneamente, a Polícia Civil de **Ceará** apreendeu **300 kg de cocaína**, duas armas de fogo e 100 munições em Barroquinha, evidenciando a continuidade do combate às drogas e ao crime organizado. No trânsito, um acidente na **BR‑316**, no Maranhão, tirou a vida de um motorista e feriu vários passageiros, enquanto na **TO‑080** entre Paraíso do Tocantins e Monte Santo, um carro capotou, resultando em uma adolescente morta e outras quatro feridas.

### Relevância
- **Combate ao crime organizado**: as operações mostram a expansão das atividades ilícitas e a necessidade de ação coordenada entre órgãos federais e estaduais.
- **Segurança rural**: ataques a fazendas ressaltam a vulnerabilidade de comunidades rurais e a urgência de políticas de proteção.
- **Trânsito**: a frequência de acidentes envolvendo grandes veículos reforça a necessidade de revisão das normas de circulação e fiscalização.

## 4. Saúde e sociedade: a reviravolta da Covid-19 e a percepção da democracia

Hospitais privados em São Paulo registraram **356 casos** de Covid‑19 entre o início do ano e a segunda-feira, indicando uma **volta da doença** em ambientes fechados e a necessidade de vigilância contínua. Paralelamente, uma pesquisa da **Quaest** revelou que **65%** dos brasileiros consideram a democracia a forma de governo preferível, enquanto **9%** acreditam que, em certas circunstâncias, uma ditadura poderia ser aceitável. Essa divisão mostra o debate em torno da governança e das ameaças à estabilidade política.

### Relevância
- **Ponto de atenção sanitário**: a reabertura de hospitais requer protocolos de isolamento e vacinação de reforço.
- **Engajamento cívico**: o resultado da pesquisa aponta para o fortalecimento do voto pela democracia, mas também evidencia uma parcela de população que permanece aberta a alternativas autoritárias.

## 5. Tecnologia em alta tensão: a acusação contra o CEO da Nvidia

A notícia de que o CEO da **Nvidia**, **Jensen Huang**, está sendo investigado por sua suposta relação extraconjugal com uma mulher que, segundo rumores, seria espiã chinesa, movimentou o setor de tecnologia. O caso levanta questões sobre segurança da informação, confiança corporativa e a vulnerabilidade das empresas de IA a conflitos pessoais.

### Relevância
- **Reputação corporativa**: a acusação pode afetar a imagem da Nvidia, especialmente em um mercado que valoriza a segurança e a transparência.
- **Segurança nacional**: a suspeita de espionagem coloca em pauta a necessidade de controles mais rígidos em empresas de alta tecnologia que lidam com dados sensíveis.
- **Impacto nos investidores**: a volatilidade dos preços das ações da Nvidia pode ser exacerbada por questões de governança corporativa.

# Síntese

A terça-feira apresentou um mosaico de acontecimentos que refletem a complexidade da realidade brasileira e mundial. Na esfera judiciária, a Justiça tenta recuperar a confiança ao encerrar um inquérito que perdurou mais de uma década. No mercado, a volatilidade global, a política monetária e os resultados corporativos demonstram a interconexão dos sistemas econômicos. A segurança pública continua a enfrentar desafios significativos, desde a atuação de organizações criminosas até a prevenção de acidentes de trânsito. Em saúde, a pandemia ainda deixa vestígios em hospitais privados, enquanto a democracia se consolida como a preferência política, apesar de pequenas fissuras. Finalmente, a tecnologia, em meio a uma crise de confiança, destaca os riscos de relações pessoais em ambientes corporativos de alta segurança. Esses episódios, embora distintos, convergem para pintar um panorama de um país em constante transformação e de um mundo que precisa equilibrar progresso, justiça e segurança.`;
