// Sourced from: app/components/NavBar.tsx, app/components/Footer.tsx (Phase 1c, no copy changes).
// Per docs/lanes/marketing-overhaul/plan.md §4.4.

import { SITE } from './site';
import type { NavLink } from './types';

export const NAV_LINKS: readonly NavLink[] = [
  { label: 'Products', href: '/products' },
  { label: 'Marketplace', href: '/marketplace' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: SITE.urls.docs },
  { label: 'Blog', href: '/blog' },
] as const;

export const NAV_AUTH = {
  login: { label: 'Log in', href: SITE.urls.adminLogin },
  signup: { label: 'Start free', href: SITE.urls.signup },
} as const;

export interface FooterColumn {
  readonly heading: string;
  readonly links: readonly NavLink[];
}

export const FOOTER_COLUMNS: readonly FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Products', href: '/products' },
      { label: 'Marketplace', href: '/marketplace' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Documentation', href: SITE.urls.docs },
      { label: 'Blog', href: '/blog' },
      { label: 'Roadmap', href: '/roadmap' },
    ],
  },
  {
    heading: 'Community',
    links: [
      { label: 'GitHub', href: SITE.urls.repo, external: true },
      { label: 'Discussions', href: SITE.urls.repoDiscussions, external: true },
      { label: 'Forum', href: SITE.urls.forum, external: true },
      { label: 'Sponsor', href: '/sponsor' },
      { label: 'RevealUI Studio (agency) →', href: SITE.urls.agency, external: true },
      { label: 'Contact', href: '/contact' },
    ],
  },
] as const;

export const FOOTER_TAGLINE =
  'Agentic business runtime. Users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.' as const;

export const FOOTER_LEGAL = {
  operator: 'REVEALUI STUDIO L.L.C.',
  operatorHref: SITE.urls.agency,
  jurisdiction: 'Tennessee',
} as const;

export const FOOTER_LEGAL_LINKS: readonly NavLink[] = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
] as const;
