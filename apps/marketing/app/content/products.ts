// Sourced from: app/routes/ProductsPage.tsx (Phase 1c extraction).
// Phase 3 (2026-05-18) update: stats bar numbers now reference METRICS from
// site.ts (single source per docs/MARKETING_METRICS.md §1). MCP count bumped
// 12→13. "187+ Security tests" replaced with `${METRICS.testFiles}` (912 total
// test files per validator) — the "187+" claim was unverifiable per plan §3.
// Per docs/lanes/marketing-overhaul/plan.md §4.4.

import { METRICS, SITE } from './site';
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
    { stat: String(METRICS.packages), label: 'workspace packages' },
    { stat: String(METRICS.dbTables), label: 'Database tables' },
    { stat: String(METRICS.testFiles), label: 'test files' },
    { stat: String(METRICS.mcpServers), label: 'first-party MCP servers' },
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
