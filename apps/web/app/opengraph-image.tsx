import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo';

export const runtime = 'edge';
export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          width: '100%',
          height: '100%',
          padding: '64px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '6px',
            background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
          }}
        />

        {/* Site name */}
        <div
          style={{
            fontSize: '64px',
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-2px',
            lineHeight: 1,
            marginBottom: '20px',
          }}
        >
          {SITE_NAME}
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: '26px',
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.4,
            maxWidth: '780px',
          }}
        >
          {SITE_DESCRIPTION}
        </div>

        {/* Powered by AI badge */}
        <div
          style={{
            position: 'absolute',
            top: '64px',
            right: '64px',
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '999px',
            padding: '8px 20px',
            fontSize: '18px',
            color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.5px',
          }}
        >
          Powered by AI
        </div>
      </div>
    ),
    { ...size },
  );
}
