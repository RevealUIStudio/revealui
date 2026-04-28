/**
 * OG image generation endpoint.
 *
 * Renders a 1200×630 PNG with a title + description via satori (JSX → SVG)
 * and @resvg/resvg-wasm (SVG → PNG). Geist Regular + Bold are inlined into
 * the bundle via tsup's binary loader.
 *
 * Used by marketing + (future) blog post OG meta tags:
 *   <meta property="og:image"
 *         content="https://api.revealui.com/api/og?title=…&description=…">
 *
 * The endpoint is intentionally generic — no per-app branding gates here.
 * Customise via query params (title, description) and add new params + a
 * matching style branch when a consumer needs more visual variation.
 */

import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import { Hono } from 'hono';
import satori from 'satori';
import GeistBold from '../assets/fonts/Geist-Bold.ttf';
import GeistRegular from '../assets/fonts/Geist-Regular.ttf';

// One-time WASM init for resvg. The same serverless instance reuses the
// initialised module across requests; the shared promise makes concurrent
// first-requests safe.
let wasmInitPromise: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm(resvgWasm);
  }
  return wasmInitPromise;
}

const WIDTH = 1200;
const HEIGHT = 630;
const DEFAULT_TITLE = 'RevealUI';
const DEFAULT_DESCRIPTION = 'Build a business your agents can run.';
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 220;

function clamp(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

interface SatoriNode {
  type: string;
  props: {
    style?: Record<string, string | number>;
    children?: SatoriNode | SatoriNode[] | string;
  };
}

function buildNode(title: string, description: string): SatoriNode {
  return {
    type: 'div',
    props: {
      style: {
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#09090b',
        padding: '60px',
        fontFamily: 'Geist',
      },
      children: {
        type: 'div',
        props: {
          style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          },
          children: [
            {
              type: 'div',
              props: {
                style: {
                  fontSize: 72,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(135deg, #f97316, #ea580c)',
                  backgroundClip: 'text',
                  color: 'transparent',
                  textAlign: 'center',
                },
                children: title,
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  fontSize: 32,
                  color: '#a1a1aa',
                  textAlign: 'center',
                  maxWidth: '900px',
                  lineHeight: 1.3,
                },
                children: description,
              },
            },
            {
              type: 'div',
              props: {
                style: {
                  fontSize: 20,
                  color: '#71717a',
                  marginTop: '20px',
                },
                children: 'revealui.com',
              },
            },
          ],
        },
      },
    },
  };
}

const app = new Hono();

app.get('/', async (c) => {
  await ensureWasm();

  const title = clamp(c.req.query('title') ?? DEFAULT_TITLE, MAX_TITLE_LENGTH);
  const description = clamp(
    c.req.query('description') ?? DEFAULT_DESCRIPTION,
    MAX_DESCRIPTION_LENGTH,
  );

  const node = buildNode(title, description);

  // satori's signature is typed against React's ReactNode. We construct a
  // ReactNode-compatible object tree manually to avoid a runtime React dep
  // in apps/api.
  const svg = await satori(node as unknown as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    // tsup's binary loader emits Uint8Array<ArrayBufferLike>; wrapping in
    // Buffer.from gives satori the Buffer<ArrayBufferLike> shape it expects
    // without copying the underlying memory.
    fonts: [
      { name: 'Geist', data: Buffer.from(GeistRegular), weight: 400, style: 'normal' },
      { name: 'Geist', data: Buffer.from(GeistBold), weight: 700, style: 'normal' },
    ],
  });

  // Resvg returns a Uint8Array<ArrayBufferLike>; wrap in Buffer so the
  // Response constructor accepts it without a type assertion.
  const png = Buffer.from(new Resvg(svg).render().asPng());

  return new Response(png, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // 24h browser cache + 24h CDN cache. OG images are referenced from
      // social-media crawlers and rarely change for a given title/description
      // combination, so aggressive caching is fine.
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
    },
  });
});

export default app;
