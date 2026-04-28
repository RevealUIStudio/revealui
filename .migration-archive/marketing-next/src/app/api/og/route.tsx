import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest): Promise<ImageResponse> {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') ?? 'RevealUI';
  const description =
    searchParams.get('description') ??
    'Agentic business runtime. Build your business, not your boilerplate.';

  return new ImageResponse(
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#09090b',
        color: '#fafafa',
        fontFamily: 'sans-serif',
        padding: '60px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 32,
            color: '#a1a1aa',
            textAlign: 'center',
            maxWidth: '800px',
          }}
        >
          {description}
        </div>
        <div
          style={{
            fontSize: 20,
            color: '#71717a',
            marginTop: '20px',
          }}
        >
          revealui.com
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
