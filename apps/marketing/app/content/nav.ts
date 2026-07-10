// Sourced from: app/components/NavBar.tsx, app/components/Footer.tsx (Phase 1c, no copy changes).
// Per the internal marketing-overhaul plan §4.4.

import { SITE } from './site';
import type { NavLink } from './types';

export const NAV_LINKS: readonly NavLink[] = [
  { label: 'Products', href: '/products' },
  { label: 'Local AI', href: '/local-ai' },
  { label: 'Governance', href: '/governance' },
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
      { label: 'Services', href: '/services' },
      { label: 'Local AI', href: '/local-ai' },
      { label: 'Governance', href: '/governance' },
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
      { label: 'RevealUI Studio (agency) →', href: SITE.urls.agency, external: true },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'Trust',
    links: [
      { label: 'Status', href: '/status' },
      { label: 'Support', href: '/support' },
      { label: 'Security', href: '/security' },
      { label: 'Subprocessors', href: '/legal/subprocessors' },
    ],
  },
] as const;

export const FOOTER_TAGLINE =
  'Agentic business runtime. People, content, offers, payments, and agents, pre-wired, open source, and ready to deploy.' as const;

export const FOOTER_SOLO_OPERATOR_NOTE =
  'Built by one engineer in Tennessee. See Support for response SLAs.' as const;

export interface FooterServiceLink {
  readonly prefix: string;
  readonly label: string;
  readonly href: string;
}

// Two quiet pathway lines, moved out of the hero (frontend-excellence Phase 1
// hero declutter): done-for-you services and agency licensing. Neither
// competes with the hero's primary/secondary CTAs; the footer is where a
// secondary path belongs.
export const FOOTER_SERVICE_LINKS: readonly FooterServiceLink[] = [
  { prefix: 'Want it built for you?', label: 'See services.', href: '/services' },
  { prefix: 'Building for clients?', label: 'See agency licensing.', href: '/pricing#perpetual' },
] as const;

export const FOOTER_LEGAL = {
  operator: 'REVEALUI STUDIO L.L.C.',
  operatorHref: SITE.urls.agency,
  jurisdiction: 'Tennessee',
} as const;

export const FOOTER_LEGAL_LINKS: readonly NavLink[] = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Security', href: '/security' },
  { label: 'Subprocessors', href: '/legal/subprocessors' },
] as const;
