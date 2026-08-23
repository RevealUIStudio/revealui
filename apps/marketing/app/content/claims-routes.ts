// File → public route map for the claims-evidence index (locked design point
// 5, frontend-excellence Phase 5, Fable ruling 2026-07-16). /claims groups
// the ledger by this map: one anchor section per content file, ordered by
// route depth, each section titled by the page it proves.
//
// Every file in claims-evidence.ts's COVERED_FILES must have an entry here.
// scripts/validate/claims-evidence.ts fails the build when one is missing, so
// a newly covered file can never render on the ledger with no page to link
// to.
//
// Some covered files back copy that renders on more than one route, or that
// currently renders nowhere at all (audited 2026-07-17, see the per-entry
// notes below). This map is single-valued by design, one file maps to one
// canonical section; where a file's content is unwired, it is mapped to the
// route it was written for, and the drift is called out here rather than
// silently hidden.

export interface RouteEntry {
  readonly route: string;
  readonly pageTitle: string;
}

export const CONTENT_FILE_ROUTES: Readonly<Record<string, RouteEntry>> = {
  'home.ts': { route: '/', pageTitle: 'Home' },
  'quote-calculator.ts': { route: '/pricing', pageTitle: 'Pricing' },
  // HOME_PRIMITIVES_SECTION / HOME_PRIMITIVES render on "/" via
  // components/landing/Primitives.tsx.
  'primitives.ts': { route: '/', pageTitle: 'Home' },
  // Renders on both "/" (components/landing/Proof.tsx) and "/products"
  // (ProductsPage.tsx reuses the same component); "/" is the primary,
  // original placement.
  'proof.ts': { route: '/', pageTitle: 'Home' },
  'pricing-teaser.ts': { route: '/', pageTitle: 'Home' },
  // The receipt-motif hero moment renders on "/" via components/landing/Hero.tsx.
  'receipt.ts': { route: '/', pageTitle: 'Home' },
  // SITE.brandTagline renders on "/" in the Footer, under SITE.brand. SITE's
  // other exports (urls, METRICS) are used throughout the site but carry no
  // prose claims of their own.
  'site.ts': { route: '/', pageTitle: 'Home' },
  'products.ts': { route: '/products', pageTitle: 'Products' },
  'pricing.ts': { route: '/pricing', pageTitle: 'Pricing' },
  'pricing-faq.ts': { route: '/pricing', pageTitle: 'Pricing' },
  // Canonical URL for the operator content is /services (ServicesPage.tsx);
  // the same components also render inline on "/" behind
  // ?for=non-technical.
  'for-operators.ts': { route: '/services', pageTitle: 'Services' },
  'for-operators-how-it-works.ts': {
    route: '/for-operators/how-it-works',
    pageTitle: 'How it works',
  },
  'for-operators-managed.ts': {
    route: '/for-operators/managed',
    pageTitle: 'RevealUI Cloud (roadmap)',
  },
  'local-ai.ts': { route: '/local-ai', pageTitle: 'Local-first AI' },
  'fair-source.ts': { route: '/fair-source', pageTitle: 'Fair Source' },
  'philosophy.ts': { route: '/philosophy', pageTitle: 'Why RevealUI exists' },
  'roadmap.ts': { route: '/roadmap', pageTitle: 'Roadmap' },
  'claims.ts': { route: '/claims', pageTitle: 'The claims ledger' },
  'nav.ts': { route: '/', pageTitle: 'Home' },
  'status.ts': { route: '/status', pageTitle: 'Status' },
  'blog.ts': { route: '/blog', pageTitle: 'Blog' },
  'not-found.ts': { route: '/404', pageTitle: 'Page not found' },
  'contact.ts': { route: '/contact', pageTitle: 'Contact' },
  'legal/privacy.ts': { route: '/privacy', pageTitle: 'Privacy' },
  'legal/cookies.ts': { route: '/cookies', pageTitle: 'Cookie policy' },
  'legal/hipaa.ts': { route: '/legal/hipaa', pageTitle: 'HIPAA' },
  'legal/refund-policy.ts': { route: '/refund-policy', pageTitle: 'Refund policy' },
  'legal/security.ts': { route: '/security', pageTitle: 'Security' },
  'legal/sla.ts': { route: '/sla', pageTitle: 'Service level commitments' },
  'legal/subprocessors.ts': { route: '/subprocessors', pageTitle: 'Subprocessors' },
  'legal/support.ts': { route: '/support', pageTitle: 'Support' },
  'legal/terms.ts': { route: '/terms', pageTitle: 'Terms of service' },
} as const;

/** Number of non-empty path segments; "/" is depth 0. Zero authored regex. */
export function routeDepth(route: string): number {
  if (route === '/') return 0;
  return route.split('/').filter((segment) => segment.length > 0).length;
}
