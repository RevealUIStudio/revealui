// Sourced from: app/components/landing/Primitives.tsx (Phase 1c, no copy
// changes). Retained CMS seed/component copy; HomePage does not mount
// components/landing/Primitives.tsx. See apps/marketing/README.md.
// Per the internal marketing-overhaul plan §4.4.
// Agents primitive MCP count is sourced from METRICS.mcpServers
// (currently 14, per docs/MARKETING_METRICS.md §1); never hardcoded here.
//
// Every sentence in HOME_PRIMITIVES is indexed in content/claims-evidence.ts.
// 2026-08-09: outcome language for buyers; RBAC/ABAC and protocol jargon
// moved to docs (docs link on the section).

import { SITE } from './site';

// ---------------------------------------------------------------------------
// Landing (Home) primitives: compact card data
// ---------------------------------------------------------------------------

export interface HomePrimitive {
  readonly label: string;
  readonly body: string;
}

export const HOME_PRIMITIVES_SECTION = {
  eyebrow: 'Five primitives. One login.',
  heading: 'The five things every business runs on.',
  body: 'People, Content, Offers, and Payments share one runtime. Pro adds agent tools; configure the services and permissions your deployment needs.',
  docsLink: { label: 'See the primitive reference →', href: SITE.urls.docs },
} as const;

export const HOME_PRIMITIVES: readonly HomePrimitive[] = [
  {
    label: 'People',
    body: 'Your team signs in once. Roles and policies decide who can do what.',
  },
  {
    label: 'Content',
    body: 'Define your content once. The admin UI and API come with it.',
  },
  {
    label: 'Offers',
    body: 'Plans and feature gates decide what each customer and agent can use.',
  },
  {
    label: 'Payments',
    body: 'Configure Stripe credentials and webhooks for test-mode checkout and subscriptions. Go live with live credentials when you are ready to accept payments.',
  },
  {
    label: 'Agents',
    body: 'Pro adds agent tools. Configure a supported local runner or hosted model provider; hardware and model usage are separate costs.',
  },
] as const;
