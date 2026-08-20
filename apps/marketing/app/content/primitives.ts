// Sourced from: app/components/landing/Primitives.tsx (Phase 1c, no copy
// changes). HomePrimitive is label + body only, rendered on "/" via
// components/landing/Primitives.tsx.
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
  body: 'Each one ships ready for your team and for agents. One login covers the whole set.',
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
    body: 'Test-mode checkout and subscriptions ship ready, including webhooks. Go live when you take real money.',
  },
  {
    label: 'Agents',
    body: 'Agents run on models you host by default. Add a hosted provider when you choose.',
  },
] as const;
