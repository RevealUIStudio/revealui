// Sourced from: app/routes/RoadmapPage.tsx (Phase 1, no copy changes). Per the internal marketing-overhaul plan §4.4.
// Phase 4 complete: page renders at /roadmap via RoadmapPage.tsx; /coming-soon 308-redirects in vercel.json.
// claims-ratchet 2026-07-12: Perpetual Licenses moved from Coming next to Recently
// shipped (status Available) because perpetual checkout is live in
// apps/server/src/routes/billing.ts (perpetualCheckoutRoute); description made present tense.
// 2026-08-18 honesty pass: SSO moved to shipped; Fleet images are In flight
// (GHCR push exists, launched pull-and-run kit does not); Visual Builder
// renamed to Visual Editing; x402 listed as Planned (flag off).

import { SITE } from './site';
import type { Cta, SectionHeading } from './types';

export interface RoadmapItem {
  readonly name: string;
  readonly description: string;
  readonly status: string;
  readonly category: string;
}

export const ROADMAP_HERO: SectionHeading = {
  title: 'Product Roadmap',
  subtitle: 'What we have shipped and what we are building next.',
};

export const ROADMAP_HERO_LINK = {
  label: 'public roadmap',
  href: SITE.urls.repoRoadmap,
} as const;

export const ROADMAP_SHIPPED_SECTION: SectionHeading = {
  title: 'Recently shipped',
};

export const ROADMAP_SHIPPED: readonly RoadmapItem[] = [
  {
    name: 'Perpetual Licenses (Track C)',
    description:
      'Buy a license once and own Pro, Max, or Enterprise tier features for life, with no subscription required. Perpetual checkout is live today, and each license includes 1 year of priority support and updates.',
    status: 'Available',
    category: 'Billing',
  },
  {
    name: 'Dashboard Agent Chat',
    description:
      'Interact with an AI agent directly from the admin dashboard. Create content, query data, manage collections, and automate workflows through natural language, with streaming responses, tool visibility, and conversation history.',
    status: 'Shipped',
    category: 'AI',
  },
  {
    name: 'Documentation Site',
    description:
      'Documentation site live at docs.revealui.com with quick-start guides, API reference, architecture docs, and package reference. Video walkthroughs and collection cookbook coming soon.',
    status: 'Shipped',
    category: 'Docs',
  },
  {
    name: 'Enterprise SSO / SAML',
    description:
      'OIDC and SAML SP-initiated federation for Enterprise accounts (Admin IdP config, test-connection, SP metadata). SCIM, advanced RBAC editor, and multi-region remain later enterprise work.',
    status: 'Shipped',
    category: 'Enterprise',
  },
];

export const ROADMAP_UPCOMING_SECTION: SectionHeading = {
  title: 'Coming next',
};

export const ROADMAP_UPCOMING: readonly RoadmapItem[] = [
  {
    name: 'MCP Marketplace',
    description:
      'A registry where developers publish and discover MCP servers and AI agent capabilities. First-party MCP servers ship today. Third-party publishing and live marketplace charging are not open yet.',
    status: 'Planned',
    category: 'AI',
  },
  {
    name: 'RevealUI Fleet pull-and-run kit',
    description:
      'CI already builds and pushes api, admin, and migrate images to GitHub Container Registry. The launched product is a documented, license-gated pull-and-run kit that a customer can deploy without building from source.',
    status: 'In flight',
    category: 'Infrastructure',
  },
  {
    name: 'Visual Editing',
    description:
      'Edit a site by clicking the real rendered page in admin. Live-preview sessions, drafts, and agent-proposed edits are the planned surface. This is not a no-code drag-and-drop site builder.',
    status: 'Planned',
    category: 'Product',
  },
  {
    name: 'x402 agent payments',
    description:
      'HTTP 402 payment rails exist in the code and stay off by default. Agents do not charge each other in production until an operator turns the rail on.',
    status: 'Planned',
    category: 'Billing',
  },
];

export const ROADMAP_CTA: SectionHeading = {
  title: 'Want to influence what ships next?',
  subtitle: 'We prioritize based on customer impact, product readiness, and community demand.',
};

export const ROADMAP_CTA_LINKS = {
  requestFeature: {
    label: 'Request a feature',
    href: SITE.urls.repoIssues,
    external: true,
  } satisfies Cta,
  joinDiscussion: {
    label: 'Join the discussion',
    href: SITE.urls.repoDiscussions,
    external: true,
  } satisfies Cta,
} as const;

export const ROADMAP_CTA_PRODUCTS_LINK = {
  label: 'Products',
  href: '/products',
} as const;
