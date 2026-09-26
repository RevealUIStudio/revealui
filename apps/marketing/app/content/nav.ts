// Sourced from: app/components/NavBar.tsx, app/components/Footer.tsx (Phase 1c, no copy changes).
// Per the internal marketing-overhaul plan §4.4.

import { STUDIO_BLOG_HREF } from '@revealui/contracts/nav-docs-boundary';
import { COMMUNITY, SITE } from './site';
import type { NavLink } from './types';

export const NAV_LINKS: readonly NavLink[] = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: SITE.urls.docs },
] as const;

/** Public product footer. Blog is the Studio site. Legal lives in the one-line strip. */
export const PRODUCT_FOOTER_LINKS: readonly NavLink[] = [
  { label: 'Docs', href: SITE.urls.docs, external: true },
  // nav-product-blog-points-studio-2026-09-26
  { label: 'Blog', href: STUDIO_BLOG_HREF, external: true },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Templates', href: '/templates' },
  { label: 'Support', href: '/support' },
] as const;

export const NAV_AUTH = {
  login: { label: 'Log in', href: SITE.urls.adminLogin },
  signup: { label: 'Start free', href: SITE.urls.signup },
} as const;

export interface FooterColumn {
  readonly heading: string;
  readonly links: readonly NavLink[];
}

const communityLinks: readonly NavLink[] = [
  { label: 'GitHub', href: SITE.urls.repo, external: true },
  { label: 'Discussions', href: SITE.urls.repoDiscussions, external: true },
  ...(COMMUNITY.substack.url
    ? ([{ label: 'Substack', href: COMMUNITY.substack.url, external: true }] as const)
    : []),
  { label: 'Contact', href: '/contact' },
];

export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Products', href: '/products' },
      { label: 'Services', href: '/services' },
      { label: 'Local AI', href: '/local-ai' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Documentation', href: SITE.urls.docs },
      // nav-product-blog-points-studio-2026-09-26
      { label: 'Blog', href: STUDIO_BLOG_HREF, external: true },
      { label: 'Roadmap', href: '/roadmap' },
      { label: 'Philosophy', href: '/philosophy' },
    ],
  },
  {
    heading: 'Community',
    // Broadcast list (Substack) only; Skool stays invite-only and off the public footer.
    links: communityLinks,
  },
  {
    heading: 'Trust',
    links: [
      { label: 'Status', href: '/status' },
      { label: 'Support', href: '/support' },
      { label: 'SLA', href: '/sla' },
      { label: 'Security', href: '/security' },
      { label: 'Subprocessors', href: '/legal/subprocessors' },
      { label: 'Cookies', href: '/cookies' },
      { label: 'HIPAA', href: '/legal/hipaa' },
    ],
  },
] as const;

export const FOOTER_TAGLINE =
  'The agentic business runtime startups operate on their own domain. Existing tools report in, you keep the stack.' as const;

export const FOOTER_SOLO_OPERATOR_NOTE =
  'Built by one engineer in Tennessee. See our SLA for response times.' as const;

export interface FooterServiceLink {
  readonly prefix: string;
  readonly label: string;
  readonly href: string;
}

// Quiet pathway line, moved out of the hero (frontend-excellence Phase 1
// hero declutter). Studio SKUs stay on revealuistudio.com; this product
// footer does not publish an agency-licensing path.
export const FOOTER_SERVICE_LINKS: readonly FooterServiceLink[] = [
  { prefix: 'Want it built for you?', label: 'See services.', href: '/services' },
] as const;

// Every marketing page links to /claims, the public claims ledger (frontend-
// excellence Phase 5). This file is on COVERED_FILES so the ledger sentence
// is itself indexed.
export const FOOTER_CLAIMS_LEDGER_NOTE = {
  prefix: 'Every sentence on this site is indexed against the code.',
  linkLabel: 'See the claims ledger.',
  href: '/claims',
} as const;

export const FOOTER_NEWSLETTER = {
  heading: 'Stay in the loop',
  body: 'Product updates and engineering insights. No spam.',
} as const;

export const FOOTER_LEGAL = {
  operator: 'REVEALUI STUDIO L.L.C.',
  operatorHref: SITE.urls.agency,
  jurisdiction: 'Tennessee',
} as const;

export const FOOTER_LEGAL_LINKS: readonly NavLink[] = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Cookies', href: '/cookies' },
  { label: 'Terms', href: '/terms' },
  { label: 'Refund', href: '/refund-policy' },
] as const;
