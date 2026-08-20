# Baseline visual da V1

Referência de como o portal era antes do redesign da V2.0 (plano §30). A Fase 1
troca os design tokens globalmente, então esta é a última fotografia da V1.

- **Commit da V1:** `373f96f`
- **Capturado em:** 20/08/2026
- **Rotas:** 12 (as 11 rotas de página menos `/admin`, mais o 404 e a home em inglês)
- **Larguras:** 375 / 768 / 1440 px, página inteira
- **Temas:** claro em tudo; escuro em `home`, `news` e `article-detail`

Regenerar:

```bash
./scripts/dev-bootstrap.sh          # banco, envs, migrations, seed e imagens
pnpm dev                            # api :3001 · web :3000
cd apps/web && FORMAT=jpeg WIDTHS=375,768,1440 pnpm visual:baseline
```

O script é `apps/web/scripts/capture-visual-baseline.mjs`. Sem `FORMAT`/`WIDTHS`
ele captura PNG nas 5 larguras da §30 — é assim que as comparações entre etapas
da V2 devem rodar. O conjunto versionado aqui usa JPEG e 3 larguras porque é um
registro histórico, não material de pixel-diff: em PNG nas 5 larguras o
diretório fica com 16 MB, e o repositório inteiro tem 1,3 MB.

As três larguras cobrem todos os saltos de layout que a V1 realmente tem. Acima
de 1280 px o `mx-auto max-w-7xl` congela a coluna de conteúdo, então 1440 e 1920
diferem apenas na margem lateral.

## Como ler estas imagens

Duas ressalvas importam na comparação com a V2:

1. **As imagens dos cards são placeholders gerados, não fotos.** O seed aponta
   cada notícia para `/seed/<categoria>.png`, gerado por
   `scripts/generate-seed-images.mjs` — gradientes de matiz variado, um por
   categoria. Eles existem para o card ter o **peso visual** de um card com
   foto; não representam o recorte real das imagens de produção, que é o que a
   §13 discute. O que eles corrigem é mais importante para esta comparação: sem
   imagem, todo card caía no fallback `from-brand-600 to-brand-400` e a tela
   ficava uma parede de laranja que não existe na produção — e que escondia,
   entre outras coisas, o badge de categoria cujo contraste reprova AA.
2. **O `/favorites` aparece como tela de login.** A rota redireciona anônimos
   para `/signin`, e a captura roda sem sessão. O estado autenticado de
   favoritos e dashboard não está na baseline.

O que as imagens mostram bem, e é o que o redesign ataca: a grade uniforme de
três colunas sem hierarquia editorial, todos os cards com o mesmo peso visual,
e a ausência de qualquer distinção entre a manchete principal e o resto do feed.
