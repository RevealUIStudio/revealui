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
  readonly color: string;
  readonly iconPath: string;
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
    color: 'emerald',
    iconPath:
      'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  },
  {
    label: 'Content',
    body: 'Collections give you a CMS, rich text, and media, with an admin UI generated from your schema.',
    color: 'blue',
    iconPath:
      'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  },
  {
    label: 'Offers',
    body: 'Catalogs and feature gates decide what each tier can do, for your people and your agents.',
    color: 'amber',
    iconPath:
      'M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z',
  },
  {
    label: 'Payments',
    body: 'Stripe checkout, subscriptions, and webhook reconciliation come pre-wired.',
    color: 'cyan',
    iconPath:
      'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z',
  },
  {
    label: 'Agents',
    body: 'Agents run on an open-weight model you host, with any provider one config line away.',
    color: 'violet',
    iconPath:
      'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z',
  },
] as const;
