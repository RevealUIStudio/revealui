import type { Metadata } from 'next';

/**
 * Tenant identity for OpenGraph + social preview cards.
 *
 * Forge kits white-label by setting REVEALUI_BRAND_NAME or REVEALUI_TENANT_NAME.
 * The same env-resolution chain is used by BrandedAuthLayout and the admin
 * shell so all surfaces resolve to the same name.
 *
 * REVEALUI_BRAND_DESCRIPTION lets kits override the og:description; falls
 * back to the canonical RevealUI marketing line. Kits that prefer no
 * description can set REVEALUI_BRAND_DESCRIPTION='' (empty string opt-out).
 */
function getOpenGraphIdentity() {
  // `||` not `??` for the name: Compose `${VAR:-}` interpolation delivers
  // unset vars as empty strings, which must fall through. The description
  // keeps `??`: its empty string is a documented opt-out (see above).
  const name = process.env.REVEALUI_BRAND_NAME || process.env.REVEALUI_TENANT_NAME || 'RevealUI';
  const description =
    process.env.REVEALUI_BRAND_DESCRIPTION ??
    'Agentic business runtime. Build your business, not your boilerplate.';
  // Empty string = explicit opt-out (kits that don't want a description).
  return { name, description: description === '' ? undefined : description };
}

function buildDefaultOpenGraph(): NonNullable<Metadata['openGraph']> {
  const { name, description } = getOpenGraphIdentity();
  return {
    type: 'website',
    description,
    images: [
      {
        url: process.env.NEXT_PUBLIC_SERVER_URL
          ? `${process.env.NEXT_PUBLIC_SERVER_URL.trim()}/favicon.svg`
          : '/favicon.svg',
      },
    ],
    siteName: name,
    title: name,
  };
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  const defaultOpenGraph = buildDefaultOpenGraph();
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  };
};
