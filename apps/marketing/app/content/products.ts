// Public products page: RevealUI licenses only.
// Honest live catalog: Free / Pro $49 / Max $299 / Enterprise inquire +
// Pro Perpetual $1,499. RevVault is encrypted secret management inside Pro,
// not a separate SKU. RevForge, RevKit, and RevDev are not for sale on
// this site.

import { METRICS, SITE } from './site';
import type { Cta } from './types';

export const PRODUCTS_PAGE_HERO = {
  h1: 'RevealUI licenses',
  subtitle:
    'License the self-hosted runtime. Free, Pro, Max, Enterprise inquire, and Pro Perpetual. Studio SKUs live on revealuistudio.com. Zero paying customers. This is not a launched pull-and-run RevealFleet.',
} as const;

export type ProductStatus = 'Beta' | 'Alpha' | 'GA' | 'Planned';

export interface FlagshipFact {
  readonly stat: string;
  readonly label: string;
}

export interface FlagshipProduct {
  readonly slug: string;
  readonly name: string;
  readonly eyebrow: string;
  readonly status: ProductStatus;
  readonly version: string;
  /** Price/availability transparency surfaced on the card (PDP-framework "test-first" win). */
  readonly priceLabel: string;
  readonly tagline: string;
  readonly body: string;
  readonly iconPath: string;
  readonly facts: readonly FlagshipFact[];
  readonly ctas: {
    readonly docs: Cta;
    readonly pricing: Cta;
    readonly repo: Cta;
  };
}

// Flagship — featured full-width treatment with brand emerald accent.
export const PRODUCTS_FLAGSHIP: FlagshipProduct = {
  slug: 'revealui',
  name: 'RevealUI',
  eyebrow: 'FLAGSHIP',
  status: 'Beta',
  version: 'v0.4.0',
  priceLabel: 'Free to self-host · Pro tier optional',
  tagline: 'The self-hosted business runtime',
  body: 'People, content, offers, payments, and agents in one runtime your team and your agents share. Licensed as Free, Pro, Max, Enterprise inquire, or Pro Perpetual.',
  iconPath: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
  facts: [
    { stat: String(METRICS.packages), label: 'packages' },
    { stat: String(METRICS.dbTables), label: 'DB tables' },
    { stat: String(METRICS.mcpServers), label: 'MCP servers' },
    { stat: String(METRICS.testFiles), label: 'test files' },
  ],
  ctas: {
    docs: { label: 'Read the docs', href: SITE.urls.docs },
    pricing: { label: 'View pricing', href: '/pricing' },
    repo: { label: 'GitHub →', href: SITE.urls.repo, external: true },
  },
} as const;

export interface StatItem {
  readonly stat: string;
  readonly label: string;
}

export const PRODUCTS_STATS_SECTION = {
  heading: 'Built to production standards',
  body: 'Not a starter template. A complete runtime with tested code you can inspect in the public repo.',
  items: [
    { stat: String(METRICS.packages), label: 'workspace packages' },
    { stat: String(METRICS.dbTables), label: 'database tables' },
    { stat: String(METRICS.testFiles), label: 'test files' },
    { stat: String(METRICS.mcpServers), label: 'first-party integrations' },
  ] as readonly StatItem[],
} as const;

export const PRODUCTS_CTA_SECTION = {
  heading: 'Start with the runtime',
  body: 'Start with the runtime. One command, full source, ready for your first deploy.',
  cliSnippet: 'npx create-revealui my-app',
  cta: {
    docs: { label: 'Read the Docs', href: SITE.urls.docs } satisfies Cta,
    pricing: { label: 'View Pricing', href: '/pricing' } satisfies Cta,
  },
} as const;
