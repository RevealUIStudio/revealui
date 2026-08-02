// 2026-07-12 claims-ratchet 2: pricing-cluster copy is code-indexed in
// claims-evidence.ts; white-label, x402, and open-weight lines corrected to
// match the shipped code (whiteLabel forced false, x402 rail off by default).
// Sourced from: app/routes/PricingPage.tsx (Phase 1 extraction).
// Phase 3 (2026-05-18) update: agent-section MCP count now references
// METRICS.mcpServers (canonical 13 per docs/MARKETING_METRICS.md §1).
// Canonical pricing numbers re-exported from @revealui/contracts/pricing for component convenience.
// 2026-07-09: PRICING_COST_CALCULATOR moved here from the homepage (internal
// marketing funnel audit); it is the one anchor number set for the
// rented-stack cost comparison. PRICING_VALUE_BAND no longer states its own
// figure so the two surfaces cannot drift apart.

export {
  PERPETUAL_TIERS,
  type PricingResponse,
  SUBSCRIPTION_TIERS,
} from '@revealui/contracts/pricing';

import { SUBSCRIPTION_PRICE_FALLBACKS } from '../lib/pricing-fallbacks';
import {
  AGENCY_ENGAGEMENT_LADDER,
  type AgencyEngagement,
  type AgencyEngagementId,
  agencyEngagementPriceDisplay,
} from './for-operators';
import { METRICS, SITE } from './site';
import type { Cta, SectionHeading } from './types';

export interface AgentFeatureCard {
  readonly heading: string;
  readonly body: string;
}

export const PRICING_HERO: SectionHeading = {
  title: 'Two ways to use RevealUI',
  subtitle: 'Subscribe, or buy a perpetual license. Start free. Upgrade when you need to.',
};

export const PRICING_HERO_SUBTEXT = {
  prefix:
    'All plans run as self-hosted installations under your license. Managed deployment available as a service add-on. Want to deploy a branded version for your own customers? See',
  linkLabel: 'Agency Perpetual',
  linkHref: '#perpetual',
  suffix: 'for RevealUI Fleet licensing.',
} as const;

export const PRICING_HERO_NAV_ANCHORS = [
  { label: 'Subscription', href: '#subscriptions' },
  { label: 'Perpetual', href: '#perpetual' },
  { label: 'Starter Kit', href: '#starter-kit' },
  { label: 'Agency Kit', href: '#agency-founding-kit' },
] as const;

// ---------------------------------------------------------------------------
// Starter Kit (GAP-434) — $299 one-time content-only product.
// Merchant: Stripe Payment Link (owner re-rule 2026-08-02, path C).
// Checkout URL: SITE.urls.starterKitCheckout (live buy.stripe.com link).
// ---------------------------------------------------------------------------

export const PRICING_STARTER_KIT = {
  id: 'starter-kit',
  eyebrow: 'One-time',
  heading: 'RevealUI Starter Kit',
  price: '$299',
  priceNote: 'one-time',
  body: 'A content-only kit for builders who want governed agent recipes and signed receipt demos on top of create-revealui, without buying a Pro subscription. Not a Pro entitlement and not a full Fleet stamp.',
  points: [
    'npm create-revealui path plus Postgres-only bootstrap scripts',
    'Governed agent recipes that write a receipt you can verify offline',
    'Ships as content and scripts, not a Pro license key or runtime upgrade',
    'Checkout on Stripe; private GitHub repo access and Substack invite are manual at launch volume',
  ],
  badge: null,
  primaryCta: {
    // ≥26 chars for claims-evidence prose gate (MIN_PROSE_LENGTH).
    label: 'Buy the RevealUI Starter Kit',
    href: SITE.urls.starterKitCheckout,
    external: true,
  } satisfies Cta,
  secondaryCta: {
    label: 'Read the kit getting-started guide',
    href: `${SITE.urls.repo}/tree/test/examples/starter-kit`,
    external: true,
  } satisfies Cta,
} as const;

// ---------------------------------------------------------------------------
// Agency Founding Kit (GAP-448) — Agency Perpetual productized for agencies.
// Purchase: existing authenticated Stripe checkout-perpetual (Max / Agency)
// at admin /account/license. Price pinned to offerings-canonical Track C
// ($8,499 one-time; Max $299/mo escape hatch). No founding discount on this
// self-serve surface. License mint uses maxSites 10 (client deployments).
// ---------------------------------------------------------------------------

export const PRICING_AGENCY_FOUNDING_KIT = {
  id: 'agency-founding-kit',
  eyebrow: 'Agency',
  heading: 'RevealUI Agency Founding Kit',
  price: '$8,499',
  priceNote: 'one-time Agency Perpetual',
  body: 'The middle rung for small agencies and MSPs: a signed Agency-tier license (Max features, up to 10 client deployments) plus the path to stamp branded, self-hosted kits for your clients. Not the $299 content-only Starter Kit, and not the $25,000 done-with-you Fleet engagement.',
  points: [
    'Agency Perpetual license key that never expires, with one year of support included',
    'Up to 10 client deployments under one Agency license (Max-tier runtime entitlements)',
    'Checkout on Stripe through your RevealUI account license page after you sign in',
    'Monthly Max subscription at $299 per month is available if you are not ready for the one-time buy',
  ],
  badge: 'Self-serve',
  primaryCta: {
    label: 'Buy the Agency Founding Kit',
    href: `${SITE.urls.admin}/account/license`,
    external: true,
  } satisfies Cta,
  secondaryCta: {
    label: 'Compare perpetual licenses on this page',
    href: '#perpetual',
    external: false,
  } satisfies Cta,
  monthlyEscape: {
    label: 'See Max monthly subscription',
    href: '#subscriptions',
  },
} as const;

export const PRICING_TRACK_A_SECTION = {
  eyebrow: 'Subscription',
  heading: 'Subscribe monthly or annually',
  body: 'Every subscription includes an agent task allowance. 7-day free trial on Pro and Max.',
} as const;

// Replaces the former CFO competitor-comparison panel (which named Convex / Supabase /
// Clerk / Trigger.dev prices), cut 2026-05-26 per owner directive. This value framing
// names no third-party prices. Deploy targets follow the drop-railway-for-fly ADR
// (Vercel / Cloudflare / Fly / Hetzner; Railway dropped).
export const PRICING_VALUE_BAND = {
  heading: 'You own the runtime.',
  // No standalone dollar figure here by design: PRICING_COST_CALCULATOR below
  // is the one anchor number set for the rented-stack comparison.
  body: 'Teams shipping more than one product typically rent auth, content, billing, and observability from four or five vendors, and the bill climbs further once enterprise SSO or compliance tiers enter. RevealUI replaces the rented stack with one runtime you own. You still pay for your own Postgres and compute.',
  points: [
    'One runtime, not five separate SaaS subscriptions',
    'Self-host on Vercel, Cloudflare, Fly, Hetzner, or your own metal',
    'Full source code access on every tier',
    "Open-weight AI by default: your bill doesn't scale with usage",
  ],
} as const;

// ---------------------------------------------------------------------------
// Cost calculator (interactive). Moved here from the homepage (internal
// marketing funnel audit, 2026-07-09) so PRICING_VALUE_BAND above and this
// calculator are the single cost-comparison surface, instead of two separate
// anchor figures on two pages.
//
// Output is ALWAYS a sanctioned range from 00-truth-source §3 (entry ~$320-380,
// climbing past $700-1,000+). The inputs move you between those sourced brackets;
// the component never invents a precise figure outside the §3 band. No vendor
// names. Honesty: sourced + time-sensitive + excludes payment processing +
// RevealUI is self-hosted (you pay your own Postgres + compute).
// ---------------------------------------------------------------------------

export interface CostTier {
  readonly id: string;
  readonly range: string;
  readonly note: string;
}

export const PRICING_COST_CALCULATOR = {
  eyebrow: 'The rented stack',
  heading: 'Add up what you would otherwise rent.',
  body: 'A multi-product team rents auth, content, billing, observability, and background jobs from four to six vendors. Estimate the monthly bill for that rented stack, then compare it to one runtime you own.',
  inputs: {
    products: { label: 'Products you run', min: 1, max: 8, step: 1, default: 2 },
    vendors: { label: 'Vendor services you would replace', min: 3, max: 6, step: 1, default: 5 },
    mrr: { label: 'Monthly recurring revenue', min: 0, max: 50000, step: 5000, default: 10000 },
  },
  tiers: [
    {
      id: 'entry',
      range: '$320 to $380 / month',
      note: 'Entry tiers across four or five vendors.',
    },
    {
      id: 'growth',
      range: '$450 to $700 / month',
      note: 'More products and seats push you up the published tiers.',
    },
    {
      id: 'scale',
      range: '$700 to $1,000+ / month',
      note: 'Enterprise SSO, compliance tiers, or higher-tier auth enter.',
    },
  ] as const satisfies readonly CostTier[],
  rentedLabel: 'The rented stack',
  revealui: {
    label: 'RevealUI',
    value: `${SUBSCRIPTION_PRICE_FALLBACKS.pro.price} / month`,
    sub: '+ your own Postgres and compute',
  },
  footnote:
    'A sourced estimate from current 2026 published pricing, time-sensitive. It excludes payment processing, and RevealUI is self-hosted, so you still pay for your own Postgres and compute. Figures are ranges, not a quote.',
} as const;

// 'Recommended' is an honest editorial signal; 'Most Popular' implied a
// customer base that does not exist yet (truth-source: zero paying users).
export const PRICING_HIGHLIGHTED_BADGE = 'Recommended' as const;

// Rendered under the subscription grid, next to the CTA click point.
export const PRICING_TRIAL_NOTE =
  'Pro and Max include a 7-day free trial. Cancel during the trial and you pay nothing.' as const;

export const PRICING_TRACK_C_SECTION = {
  eyebrow: 'Perpetual',
  heading: 'Perpetual Licenses',
  body: 'A perpetual license costs about three years of the subscription. Pay once, own it forever, and renew support only if you want it.',
} as const;

// Studio / agency reseller economics, rendered in the Perpetual section where the
// Agency Perpetual (RevealUI Fleet) tier lives. Names no third-party prices, consistent
// with PRICING_VALUE_BAND. Models the multi-client P&L the per-business cards do not show.
export const PRICING_AGENCY_VALUE_BAND = {
  eyebrow: 'For studios & agencies',
  heading: 'One runtime. Every client gets their own.',
  body: 'Building or reselling software for more than one client means re-licensing auth, billing, content, and an admin for every account you take on. An Agency Perpetual license covers the runtime once, so you ship a branded, self-hosted instance per client instead.',
  points: [
    'One license, a branded instance per client. No per-client SaaS re-licensing.',
    'White-label stamping via RevForge, in private preview.',
    'Each client owns their data, infrastructure, and Stripe account. Clean handoff, no lock-in.',
    'One runtime, one upgrade cadence across every client you serve.',
  ],
} as const;

export const PRICING_AGENTS_SECTION = {
  eyebrow: 'Agent-Native',
  heading: 'RevealUI for AI Agents',
  subhead: 'Agents discover, authenticate, and pay without human intervention.',
  badge: 'Coming soon',
} as const;

export const PRICING_AGENT_A2A = {
  heading: 'A2A Discovery',
  body: {
    prefix: 'Agents find RevealUI via a standard Agent Card at',
    linkLabel: '/.well-known/agent.json',
    linkHref: SITE.urls.apiAgent,
    suffix: '. Capabilities, skills, and pricing all machine-readable.',
  },
} as const;

export const PRICING_AGENT_X402 = {
  heading: 'x402-Native Payments',
  body: 'RevealUI implements the HTTP 402 payment protocol. Built on the open x402 standard, with a Coinbase-compatible facilitator implemented. Agents pay agents over standard HTTP. No accounts, no subscriptions. The rail ships in the code and activates when the operator configures a receiving wallet; it is not switched on today.',
} as const;

export const PRICING_AGENT_MCP = {
  heading: 'MCP Servers',
  // Count sourced from METRICS.mcpServers (canonical per docs/MARKETING_METRICS.md §1).
  body: `${METRICS.mcpServers} production MCP servers including Stripe, Neon, Vercel, Playwright, Next.js DevTools, content management, and email. Marketplace discovery coming soon.`,
  docsLink: {
    label: 'MCP docs →',
    href: SITE.urls.docsMcp,
  } satisfies Cta,
} as const;

export const PRICING_AGENT_CTA_LINKS = {
  openapi: {
    label: 'OpenAPI spec',
    href: SITE.urls.apiOpenapi,
    external: true,
  } satisfies Cta,
  apiDocs: {
    label: 'API docs',
    href: SITE.urls.apiDocs,
  } satisfies Cta,
} as const;

// Done-for-you rung: surfaces the agency engagement ladder where the buying
// decision happens, instead of a bare link out. Name + price derive from
// content/for-operators.ts AGENCY_ENGAGEMENT_LADDER, the single source of
// truth for the published engagement anchors. Per-rung `note` copy is
// surface-specific (band-voice, shorter than the agency-page rung body), so
// only the name + price are reused. The discovery call doubles as the
// mid-funnel capture for buyers who are not ready to self-serve (06-10
// public-surfaces audit P1).
const DONE_FOR_YOU_RUNG_NOTES: Record<AgencyEngagementId, string> = {
  'architecture-review':
    'Fixed-bid written assessment of your project, schema, deployment, and security posture. Credited toward a Fleet deployment if you proceed within 30 days.',
  'launch-package':
    'Your RevealUI instance is set up, configured, and deployed to production, with a full handoff session included.',
  'fleet-deployment':
    'A branded, self-hosted RevealUI deployment for your business or your clients. Starting point, scoped in discovery.',
  'custom-build':
    'Bespoke platform engagement, 4 to 12 week sprints. Starting point, scoped in discovery.',
};

export interface DoneForYouRung {
  readonly name: string;
  readonly price: string;
  readonly note: string;
}

// Funnel collapse (2026-08-02): pricing keeps price anchors + one discovery CTA.
// Full engagement narrative lives on /services and revealuistudio.com, not here.
export const PRICING_DONE_FOR_YOU = {
  eyebrow: 'Done for you',
  heading: 'Want it built and handed over?',
  body: 'RevealUI Studio ships fixed-bid work on the runtime. Starting prices below. Discovery scopes the engagement. Full detail lives on the Studio site and the product Services page.',
  rungs: AGENCY_ENGAGEMENT_LADDER.map(
    (engagement: AgencyEngagement): DoneForYouRung => ({
      name: engagement.name,
      price: agencyEngagementPriceDisplay(engagement),
      note: DONE_FOR_YOU_RUNG_NOTES[engagement.id],
    }),
  ) as readonly DoneForYouRung[],
  primaryCta: {
    label: 'Book a discovery call',
    href: 'https://cal.com/revealuistudio/discovery',
    external: true,
  } satisfies Cta,
  secondaryCta: {
    // Keep ≥26 chars so claims-evidence prose gate indexes the label.
    label: 'See full services on Studio →',
    href: SITE.urls.agency,
    external: true,
  } satisfies Cta,
} as const;

export const PRICING_FINAL_CTA: SectionHeading = {
  title: 'Start free with full source access.',
  subtitle: 'Every tier ships the complete source. Upgrade when your business needs Pro features.',
};

export const PRICING_FINAL_CTA_LINKS = {
  getStarted: {
    label: 'Get Started Free',
    href: SITE.urls.signup,
  } satisfies Cta,
  contactSales: {
    label: 'Contact Sales',
    href: '/contact',
  } satisfies Cta,
} as const;

export const PRICING_NEWSLETTER_LABEL = 'Not ready yet? Get release updates by email.' as const;
