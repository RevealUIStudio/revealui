// RevFleet product family roster — the actual products RevealUI Studio ships.
//
// Sourced from per-product README audit (2026-05-18) cross-referenced against
// the internal marketing-overhaul plan §2.1 (canonical status table). Owner
// directive 2026-05-18 redirected /products from "5 primitives deep-dive" to
// "RevFleet product family lineup". RevealCoin permanently excluded per
// the 2026-05-29 cancellation ADR (internal;
// supersedes the prior shelved-state memory). The legacy primitives data
// (PRODUCTS_PRIMITIVES in content/primitives.ts) stays exported for future
// relocation to a /concepts or /platform page per lane owner's discretion.
//
// Status re-verified 2026-06-23 (Phase D, against current per-product READMEs):
// RevForge Beta → Alpha (README: stamped kits are reference/preview only, not
// production-ready); RevCon Alpha → Active (MIT) (shipped MIT tool, no pre-1.0
// marking). RevMarket STAYS Planned: MASTER_PLAN marks the infra complete, but
// truth-source §5 binds the marketplace as not-yet-shipped to users and the hero
// says it is "on the way" — the marketing guardrail wins over internal status.
//
// Conversion pass (2026-06-09): per the e-commerce-PDP optimization framework
// (digitalapplied.com), three "test-first" wins applied to this product-family
// page — (1) price/license transparency surfaced on every card via priceLabel
// instead of buried behind /pricing; (2) scannable bulleted highlights replace
// prose card bodies (Nielsen Norman scan-not-read); (3) the flagship gains a
// real-screenshot showcase (PRODUCTS_FLAGSHIP_SHOWCASE) so visitors can evaluate
// the product visually, not from a line icon. priceLabel values are derived from
// the authoritative license catalog in content/{home,pricing-faq}.ts, not from
// repo SPDX (RevVault CLI MIT / RevDev Studio+Console MIT / RevCon MIT / RevSkills
// MIT / RevForge operator-only / RevMarket integrations bundled with the runtime).
//
// Status semantics:
//   Beta         — production-ready code, limited paying users / dogfooded
//   Alpha        — development-preview quality; works, ships, may break
//   Active (MIT) — released, free-and-open library, no SLA
//   Planned      — code-complete or scaffolded, not yet shipped to users

import { METRICS, SITE } from './site';
import type { Cta } from './types';

export const PRODUCTS_PAGE_HERO = {
  h1: 'The RevFleet product family',
  subtitle:
    'Start with the runtime, add the rest as you grow. Eight products on one foundation, all built and operated by RevealUI Studio, every one shipping today except the agent marketplace, which is on the way.',
} as const;

export type ProductStatus = 'Beta' | 'Alpha' | 'Active (MIT)' | 'Planned';

export interface ProductStatusStyle {
  readonly bg: string;
  readonly text: string;
  readonly ring: string;
}

export const PRODUCT_STATUS_STYLES: Readonly<Record<ProductStatus, ProductStatusStyle>> = {
  Beta: {
    bg: 'bg-emerald-500/10', // adherence-ignore: emerald-utility - apps/marketing/app/index.css:80-92 remaps emerald-* to cobalt oklch values (Cobalt v5 palette remap); renders cobalt today, zero visual change
    text: 'text-emerald-700', // adherence-ignore: emerald-utility - see index.css:80-92 emerald->cobalt remap; renders cobalt today, zero visual change
    ring: 'ring-emerald-500/30', // adherence-ignore: emerald-utility - see index.css:80-92 emerald->cobalt remap; renders cobalt today, zero visual change
  },
  Alpha: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-700',
    ring: 'ring-amber-500/30',
  },
  'Active (MIT)': {
    bg: 'bg-blue-500/10',
    text: 'text-blue-700',
    ring: 'ring-blue-500/30',
  },
  Planned: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-700',
    ring: 'ring-slate-500/30',
  },
} as const;

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
  version: 'v0.3.0',
  priceLabel: 'Free to self-host · Pro tier optional',
  tagline: 'The agentic business runtime',
  body: 'People, content, offers, payments, and agents: pre-wired into one runtime your team and your AI agents share through a single open protocol. The foundation every other RevFleet product builds on.',
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

// Flagship visual showcase — real admin screenshots (PDP-framework: shoppers
// evaluate from imagery, not a line icon). Renders the existing <ProductMockup>.
export const PRODUCTS_FLAGSHIP_SHOWCASE = {
  eyebrow: 'Inside the flagship',
  heading: 'See what you actually ship',
  body: 'Content, users, billing, AI agents, and live monitoring: the real RevealUI admin running on the open-source stack, captured from a fresh install.',
} as const;

export interface SisterProduct {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  /** Scannable highlights — lead the card, replacing prose (PDP-framework "quick win"). */
  readonly highlights: readonly string[];
  readonly status: ProductStatus;
  readonly version?: string;
  /** Price/availability transparency surfaced on the card. */
  readonly priceLabel: string;
  readonly iconPath: string;
  readonly primaryCta: Cta;
}

// Sister products — uniform card grid. Order is roughly stability-descending
// (Beta first, then Alpha, then Active-library, then Planned) so the most
// adoption-ready surfaces lead.
export const PRODUCTS_SISTERS: readonly SisterProduct[] = [
  {
    slug: 'revvault',
    name: 'RevVault',
    tagline: 'Age-encrypted secret vault',
    highlights: [
      'Rust CLI + Tauri desktop app',
      'Age-encrypted, 100% passage-compatible',
      'Canonical secret store, no .env plaintext',
    ],
    status: 'Beta',
    version: 'v0.2.0',
    priceLabel: 'Free · MIT CLI',
    iconPath:
      'M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z',
    primaryCta: {
      label: 'GitHub →',
      href: 'https://github.com/RevealUIStudio/revvault',
      external: true,
    },
  },
  {
    slug: 'revforge',
    name: 'RevForge',
    tagline: 'White-label stamping tool',
    highlights: [
      'Generates branded RevealUI trial kits',
      'Domain-locked, multi-tenant',
      'Self-hosted runtime instances',
    ],
    status: 'Alpha',
    priceLabel: 'Operator tool',
    iconPath:
      'M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766m-2.704 3.796-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z',
    primaryCta: {
      label: 'GitHub →',
      href: 'https://github.com/RevealUIStudio/revforge',
      external: true,
    },
  },
  {
    slug: 'revdev',
    name: 'RevDev',
    tagline: 'Multi-agent IDE harness',
    highlights: [
      'Desktop Studio + Console + Node daemon',
      'Coordinates agents across a multi-repo workspace',
      'Claude, Cursor, Copilot',
    ],
    status: 'Alpha',
    version: 'v0.1.0',
    priceLabel: 'Free · MIT core',
    iconPath: 'M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5',
    primaryCta: {
      label: 'GitHub →',
      href: 'https://github.com/RevealUIStudio/revdev',
      external: true,
    },
  },
  {
    slug: 'revcon',
    name: 'RevCon',
    tagline: 'Editor config sync',
    highlights: [
      'Zed, VS Code, Cursor configs',
      'Symlinked into every project',
      'Edit once, propagate fleet-wide',
    ],
    status: 'Active (MIT)',
    priceLabel: 'Free · MIT',
    iconPath:
      'M6 13.5V3.75m0 9.75a1.5 1.5 0 0 1 0 3m0-3a1.5 1.5 0 0 0 0 3m0 3.75V16.5m12-3V3.75m0 9.75a1.5 1.5 0 0 1 0 3m0-3a1.5 1.5 0 0 0 0 3m0 3.75V16.5m-6-9V3.75m0 3.75a1.5 1.5 0 0 1 0 3m0-3a1.5 1.5 0 0 0 0 3m0 9.75V10.5',
    primaryCta: {
      label: 'GitHub →',
      href: 'https://github.com/RevealUIStudio/revcon',
      external: true,
    },
  },
  {
    slug: 'revskills',
    name: 'RevSkills',
    tagline: 'Claude Code skills library',
    highlights: [
      'Auth flows, schema patterns, test scaffolds',
      'Drop into any Claude Code agent',
      'Free, open, importable',
    ],
    status: 'Active (MIT)',
    priceLabel: 'Free · MIT',
    iconPath:
      'M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5',
    primaryCta: {
      label: 'GitHub →',
      href: 'https://github.com/RevealUIStudio/revskills',
      external: true,
    },
  },
  {
    slug: 'revmarket',
    name: 'RevMarket',
    tagline: 'Agent tool marketplace',
    highlights: [
      `${METRICS.mcpServers} first-party integrations, out of the box`,
      'Stripe, Neon, Vercel, Next.js, and more',
      'Third-party publishing planned',
    ],
    status: 'Planned',
    priceLabel: 'Bundled with the runtime',
    iconPath:
      'M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72L4.318 3.44A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72m-13.5 8.65h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .415.336.75.75.75Z',
    primaryCta: {
      label: 'Browse the catalog',
      href: '/roadmap',
    },
  },
] as const;

export interface StatItem {
  readonly stat: string;
  readonly label: string;
}

export const PRODUCTS_STATS_SECTION = {
  heading: 'Built to production standards',
  body: 'Not a starter template. A complete runtime with tested, documented, and audited code.',
  items: [
    { stat: String(METRICS.packages), label: 'workspace packages' },
    { stat: String(METRICS.dbTables), label: 'database tables' },
    { stat: String(METRICS.testFiles), label: 'test files' },
    { stat: String(METRICS.mcpServers), label: 'first-party MCP servers' },
  ] as readonly StatItem[],
} as const;

export const PRODUCTS_CTA_SECTION = {
  heading: 'Start with the runtime',
  body: 'Every other RevFleet product builds on RevealUI. One command, full source, everything pre-wired and ready for your first deploy.',
  cliSnippet: 'npx create-revealui my-app',
  cta: {
    docs: { label: 'Read the Docs', href: SITE.urls.docs } satisfies Cta,
    pricing: { label: 'View Pricing', href: '/pricing' } satisfies Cta,
  },
} as const;
