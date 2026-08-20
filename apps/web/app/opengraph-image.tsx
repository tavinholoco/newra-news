import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo';

export const runtime = 'edge';
export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Derivado do vetor da marca, sem asset novo (§40.3). Valores hexadecimais
// literais porque o `ImageResponse` roda no edge, fora do CSS — não há
// `var(--brand-950)` aqui. São a camada 1 de `styles/tokens.css`:
const BRAND_950 = '#6f2815';
const BRAND_600 = '#c94f22';
const BRAND_500 = '#d96a34';
const PAPER = '#faf9f7';
const MIST_400 = '#a8afb5';

const MARK_PATH =
  'M0 112L0 1200A112 112 0 0 0 224 1200L224 112A112 112 0 0 0 0 112ZM30.44 188.76L286.44 460.76A112 112 0 0 0 449.56 307.24L193.56 35.24A112 112 0 0 0 30.44 188.76ZM960 112L960 1200A112 112 0 0 0 1184 1200L1184 112A112 112 0 0 0 960 112ZM1153.56 1123.24L897.56 851.24A112 112 0 0 0 734.44 1004.76L990.44 1276.76A112 112 0 0 0 1153.56 1123.24ZM592 362C592 541.34 706.66 656 886 656C706.66 656 592 770.66 592 950C592 770.66 477.34 656 298 656C477.34 656 592 541.34 592 362Z';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '72px',
          background: BRAND_950,
          fontFamily: 'sans-serif',
        }}
      >
        {/* Faixa de marca no topo — o mesmo par do placeholder de imagem dos
            cards, para o compartilhamento parecer o site. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '10px',
            background: `linear-gradient(90deg, ${BRAND_600}, ${BRAND_500})`,
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <svg width='56' height='62' viewBox='0 0 1184 1312' fill='none'>
            <path fill={BRAND_500} fillRule='evenodd' d={MARK_PATH} />
          </svg>
          <div
            style={{
              fontSize: '34px',
              fontWeight: 700,
              color: PAPER,
              letterSpacing: '-0.5px',
            }}
          >
            {SITE_NAME}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: '60px',
              fontWeight: 700,
              color: PAPER,
              letterSpacing: '-1.5px',
              lineHeight: 1.1,
              marginBottom: '24px',
              maxWidth: '900px',
            }}
          >
            {SITE_DESCRIPTION}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '24px',
              color: MIST_400,
            }}
          >
            <span>Artigo do dia gerado por IA</span>
            <span>·</span>
            <span>Atualizado diariamente</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
