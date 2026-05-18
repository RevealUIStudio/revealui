// Sourced from: app/routes/ProductsPage.tsx (Phase 1c, no copy changes).
// ProductsPage-specific content: hero, stats bar, CTA section.
// The 5 primitives data lives in ./primitives.ts (shared with landing).
// Per docs/lanes/marketing-overhaul/plan.md §4.4.

import { SITE } from './site';
import type { Cta } from './types';

export const PRODUCTS_PAGE_HERO = {
  h1: 'Five primitives. One runtime.',
  subtitle:
    'Users, content, products, payments, and intelligence — pre-wired and exposed to your agents via MCP.',
} as const;

export interface StatItem {
  readonly stat: string;
  readonly label: string;
}

export const PRODUCTS_STATS_SECTION = {
  heading: 'Built to production standards',
  body: 'Not a starter template. A complete runtime with tested, documented, and audited code.',
  items: [
    { stat: '26', label: 'workspace packages' },
    { stat: '86', label: 'Database tables' },
    { stat: '187+', label: 'Security tests' },
    { stat: '12', label: 'first-party MCP servers' },
  ] as readonly StatItem[],
} as const;

export const PRODUCTS_CTA_SECTION = {
  heading: 'Start building with all five primitives',
  body: 'One command. Full source code. Users, content, products, payments, and intelligence - pre-wired and ready for your first deploy.',
  cliSnippet: 'npx create-revealui my-app',
  cta: {
    docs: { label: 'Read the Docs', href: SITE.urls.docs } satisfies Cta,
    pricing: { label: 'View Pricing', href: '/pricing' } satisfies Cta,
  },
} as const;
