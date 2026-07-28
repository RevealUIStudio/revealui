import type { MetadataRoute } from 'next';

/*
 * PWA manifest for the admin app.
 *
 * Served dynamically rather than as a static public/site.webmanifest because
 * admin is white-labelled: REVEALUI_BRAND_NAME / REVEALUI_TENANT_NAME rename
 * the product per tenant (see (frontend)/layout.tsx generateMetadata, which
 * derives its title the same way). A static file would pin every tenant kit's
 * home-screen label to "RevealUI admin".
 *
 * Next injects <link rel="manifest"> automatically; no layout change needed.
 * Icons are emitted into apps/admin/public by scripts/gen-brand-assets.cjs.
 */

// Env is read per request, matching the layout's own force-dynamic posture.
export const dynamic = 'force-dynamic';

export default function manifest(): MetadataRoute.Manifest {
  // `||` not `??`: Compose `${VAR:-}` interpolation delivers unset vars as
  // empty strings, which must fall through to the next candidate.
  const name = process.env.REVEALUI_BRAND_NAME || process.env.REVEALUI_TENANT_NAME || 'RevealUI';

  return {
    name: `${name} admin`,
    short_name: name,
    description: `Operations console for ${name}.`,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#060d1a',
    theme_color: '#060d1a',
    icons: [
      { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
