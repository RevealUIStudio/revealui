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
  /** Accent key for landing chip styles. People uses brand (was emerald alias). */
  readonly color: string;
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
    // Brand accent (not emerald — that name was a retired palette alias).
    color: 'brand',
  },
  {
    label: 'Content',
    body: 'Define your content once. The admin UI and API come with it.',
    color: 'blue',
  },
  {
    label: 'Offers',
    body: 'Plans and feature gates decide what each customer and agent can use.',
    color: 'amber',
  },
  {
    label: 'Payments',
    body: 'Checkout and subscriptions ship ready, including webhook handling.',
    color: 'cyan',
  },
  {
    label: 'Agents',
    body: 'Agents run on models you host by default. Add a hosted provider when you choose.',
    color: 'violet',
  },
] as const;
