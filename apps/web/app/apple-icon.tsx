import { ImageResponse } from 'next/og';
import { SITE_NAME } from '@/lib/seo';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';
export const alt = SITE_NAME;

// Gerado do mesmo vetor de `public/logo/`, sem asset novo (§40.3). É um `.tsx`
// e não um PNG versionado: uma fonte só para a marca, e nada de binário no git.
//
// Ao contrário do `icon.svg`, aqui o canvas é quadrado e sem cantos
// arredondados — o iOS aplica a própria máscara, e arredondar de novo deixaria
// a borda dupla. O padding é a safe area: um ícone de app com a arte encostada
// na borda fica cortado pela máscara.
const BRAND_950 = '#6f2815';
const BRAND_500 = '#d96a34';

const MARK_PATH =
  'M0 112L0 1200A112 112 0 0 0 224 1200L224 112A112 112 0 0 0 0 112ZM30.44 188.76L286.44 460.76A112 112 0 0 0 449.56 307.24L193.56 35.24A112 112 0 0 0 30.44 188.76ZM960 112L960 1200A112 112 0 0 0 1184 1200L1184 112A112 112 0 0 0 960 112ZM1153.56 1123.24L897.56 851.24A112 112 0 0 0 734.44 1004.76L990.44 1276.76A112 112 0 0 0 1153.56 1123.24ZM592 362C592 541.34 706.66 656 886 656C706.66 656 592 770.66 592 950C592 770.66 477.34 656 298 656C477.34 656 592 541.34 592 362Z';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: BRAND_950,
        }}
      >
        <svg width='92' height='102' viewBox='0 0 1184 1312' fill='none'>
          <path fill={BRAND_500} fillRule='evenodd' d={MARK_PATH} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
