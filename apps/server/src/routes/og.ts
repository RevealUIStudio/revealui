/**
 * OG image generation endpoint.
 *
 * Renders a 1200×630 PNG with a title + description via satori (JSX → SVG)
 * and @resvg/resvg-wasm (SVG → PNG). The Inter Tight variable font is inlined
 * into the bundle via tsup's binary loader; satori extracts 400 + 700 weights
 * from the same buffer. The resvg WASM ships beside the built bundle (copy-resvg-wasm) and is read at runtime.
 *
 * Used by marketing + (future) blog post OG meta tags:
 *   <meta property="og:image"
 *         content="https://api.revealui.com/api/og?title=…&description=…">
 *
 * The endpoint is intentionally generic — no per-app branding gates here.
 * Customise via query params (title, description) and add new params + a
 * matching style branch when a consumer needs more visual variation.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { Hono } from 'hono';
import satori from 'satori';
import InterTightVariable from '../assets/fonts/InterTight-Variable.ttf';

// One-time WASM init for resvg. The same serverless instance reuses the
// initialised module across requests; the shared promise makes concurrent
// first-requests safe.
//
// The WASM bytes are read at runtime (not imported as an ES module) and
// compiled via `WebAssembly.compile`. The earlier approach of `import resvgWasm
// from '...wasm'` (inlined via tsup's binary loader) works in Vercel Edge /
// Cloudflare Workers because WASM imports are first-class there — but crashes
// in Node, where the experimental WASM ESM loader tries to resolve the
// wasm-bindgen `wbg` glue from the .wasm's import section and fails (no `wbg`
// npm package; it's expected to be the companion `index_bg.js` glue, which is
// unreachable when the .wasm is imported directly). Reading the bytes manually
// bypasses that path; `initWasm` supplies the `wbg` bindings internally.
//
// Resolution order: prefer the copy emitted next to the built bundle by the
// `copy-resvg-wasm` build step (dist/index_bg.wasm). That colocated file is the
// one shipped on Vercel — its `@vercel/nft` tracer can't follow a dynamic
// `import.meta.resolve` into node_modules, which left `/api/og` throwing ENOENT
// in production; `vercel.json` `includeFiles` ships the colocated copy into the
// function. In dev (tsx, running from src/) the colocated file does not exist,
// so fall back to the node_modules copy. `import.meta.resolve` is sync in
// Node 20.6+ (engines requires >=24.13).
function readResvgWasm() {
  // Prefer the copy emitted next to the built bundle by copy-resvg-wasm
  // (dist/index_bg.wasm). Fall back to the node_modules copy in dev (tsx from
  // src/). Read with try/catch rather than an existsSync probe to avoid a
  // check-then-read race.
  const colocated = join(dirname(fileURLToPath(import.meta.url)), 'index_bg.wasm');
  try {
    return readFileSync(colocated);
  } catch {
    const fromModules = fileURLToPath(import.meta.resolve('@resvg/resvg-wasm/index_bg.wasm'));
    return readFileSync(fromModules);
  }
}

let wasmInitPromise: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm(WebAssembly.compile(readResvgWasm()));
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
        fontFamily: 'Inter Tight',
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
  // in apps/server.
  const svg = await satori(node as unknown as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    // tsup's binary loader emits Uint8Array<ArrayBufferLike>; wrapping in
    // Buffer.from gives satori the Buffer<ArrayBufferLike> shape it expects
    // without copying the underlying memory.
    fonts: [
      { name: 'Inter Tight', data: Buffer.from(InterTightVariable), weight: 400, style: 'normal' },
      { name: 'Inter Tight', data: Buffer.from(InterTightVariable), weight: 700, style: 'normal' },
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
