// Sourced from: app/components/landing/Primitives.tsx (Phase 1c, no copy
// changes). HomePrimitive is label + body only, rendered on "/" via
// components/landing/Primitives.tsx.
// Per the internal marketing-overhaul plan §4.4.
// Agents primitive MCP count is sourced from METRICS.mcpServers
// (currently 14, per docs/MARKETING_METRICS.md §1); never hardcoded here.
//
// Every sentence in HOME_PRIMITIVES is indexed in content/claims-evidence.ts.

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
  body: 'Each primitive ships as an API and an admin surface, and your agents work the same objects your team does.',
  docsLink: { label: 'See the primitive reference →', href: SITE.urls.docs },
} as const;

export const HOME_PRIMITIVES: readonly HomePrimitive[] = [
  {
    label: 'People',
    body: 'Your team signs in with sessions and works under RBAC and ABAC policies.',
    // Brand accent (not emerald — that name was a retired palette alias).
    color: 'brand',
  },
  {
    label: 'Content',
    body: 'Collections give you a CMS, rich text, and media, with an admin UI generated from your schema.',
    color: 'blue',
  },
  {
    label: 'Offers',
    body: 'Catalogs and feature gates decide what each tier can do, for your people and your agents.',
    color: 'amber',
  },
  {
    label: 'Payments',
    body: 'Stripe checkout, subscriptions, and webhook reconciliation come pre-wired.',
    color: 'cyan',
  },
  {
    label: 'Agents',
    body: 'Agents run on an open-weight model you host, with any provider one config line away.',
    color: 'violet',
  },
] as const;
