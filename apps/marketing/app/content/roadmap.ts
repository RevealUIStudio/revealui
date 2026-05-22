// Sourced from: app/routes/ComingSoonPage.tsx (Phase 1, no copy changes). Per docs/lanes/marketing-overhaul/plan.md §4.4.
// File named roadmap.ts per Phase 4 /roadmap rename plan; route stays ComingSoonPage.tsx for now.

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
];

export const ROADMAP_UPCOMING_SECTION: SectionHeading = {
  title: 'Coming next',
};

export const ROADMAP_UPCOMING: readonly RoadmapItem[] = [
  {
    name: 'Perpetual Licenses (Track C)',
    description:
      'One-time purchase for lifetime access to Pro, Max, or Enterprise tier features. No subscription required. Includes 1 year of priority support and updates.',
    status: 'Coming soon',
    category: 'Billing',
  },
  {
    name: 'MCP Marketplace',
    description:
      'A registry where developers publish and discover MCP servers and AI agent capabilities. Revenue share model for developers. Discoverable via Smithery, mcpt, and the RevealUI registry.',
    status: 'Planned — in design',
    category: 'AI',
  },
  {
    name: 'Self-Hosted Docker Images (RevealUI Fleet)',
    description:
      'Official Docker images published to GitHub Container Registry for fully self-hosted deployment. Domain-locked licensing, air-gap capable.',
    status: 'Planned — designed, not built',
    category: 'Infrastructure',
  },
  {
    name: 'Visual Builder',
    description:
      'A no-code visual builder for creating RevealUI sites. Drag-and-drop page building, component customization, and one-click deployment.',
    status: 'Planned — backlog',
    category: 'Product',
  },
  {
    name: 'Enterprise SSO / SAML',
    description:
      'Single sign-on via SAML for enterprise customers. Advanced audit logging, custom RBAC policy editor, and multi-region deployment support.',
    status: 'Planned — designed, not built',
    category: 'Enterprise',
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
