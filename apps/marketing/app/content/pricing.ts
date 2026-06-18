// Sourced from: app/routes/PricingPage.tsx (Phase 1 extraction).
// Phase 3 (2026-05-18) update: agent-section MCP count now references
// METRICS.mcpServers (canonical 14 per docs/MARKETING_METRICS.md §1).
// Canonical pricing numbers re-exported from @revealui/contracts/pricing for component convenience.

export {
  PERPETUAL_TIERS,
  type PricingResponse,
  SUBSCRIPTION_TIERS,
} from '@revealui/contracts/pricing';

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
  subtitle: 'Subscribe monthly or buy a perpetual license. Start free. Upgrade when you need to.',
};

export const PRICING_HERO_SUBTEXT = {
  prefix:
    'All plans run as self-hosted installations under your license. Managed deployment available as a service add-on. Want to deploy a branded version for your own customers? See',
  linkLabel: 'Agency Perpetual',
  linkHref: '#perpetual',
  suffix: 'for RevealUI Fleet licensing.',
} as const;

export const PRICING_HERO_NAV_ANCHORS = [
  { label: 'Monthly plans', href: '#subscriptions' },
  { label: 'Perpetual licenses', href: '#perpetual' },
] as const;

export const PRICING_TRACK_A_SECTION = {
  eyebrow: 'Subscriptions',
  heading: 'Subscribe monthly',
  body: 'Monthly subscriptions with a task allowance included. 7-day free trial on Pro and Max.',
} as const;

// Replaces the former CFO competitor-comparison panel (which named Convex / Supabase /
// Clerk / Trigger.dev prices), cut 2026-05-26 per owner directive. This value framing
// names no third-party prices. Deploy targets follow the drop-railway-for-fly ADR
// (Vercel / Cloudflare / Fly / Hetzner — Railway dropped).
export const PRICING_VALUE_BAND = {
  heading: 'You own the runtime.',
  // Cost anchor reconciled to the homepage comparison table (HOME_PROBLEM,
  // content/home.ts: ~$1,200/mo for a 5-dev mid-startup) so the two surfaces
  // agree. Time-sensitive: re-verify past mid-2026.
  body: 'Teams shipping more than one product typically rent auth, content, billing, and observability from four or five vendors. On a typical mid-startup invoice that runs about $1,200 a month for a five-developer team, and climbs further once enterprise SSO or compliance tiers enter. RevealUI replaces the rented stack with one runtime you own. You still pay for your own Postgres and compute.',
  points: [
    'One runtime, not five separate SaaS subscriptions',
    'Self-host on Vercel, Cloudflare, Fly, Hetzner, or your own metal',
    'Full source code access on every tier',
    "Open-weight AI by default: your bill doesn't scale with usage",
  ],
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
    'White-label stamping built in via RevForge trial kits.',
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
  body: "RevealUI implements the HTTP 402 payment protocol. Compatible with Amazon Bedrock AgentCore Payments, Coinbase, and Cloudflare's x402 Foundation. Agents pay agents over standard HTTP. No accounts, no subscriptions.",
} as const;

export const PRICING_AGENT_MCP = {
  heading: 'MCP Servers',
  // Count sourced from METRICS.mcpServers (canonical per docs/MARKETING_METRICS.md §1).
  body: `${METRICS.mcpServers} production MCP servers including Stripe, Neon, Supabase, Vercel, Playwright, Next.js DevTools, content management, and email. Marketplace discovery coming soon.`,
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
// content/for-operators.ts AGENCY_ENGAGEMENT_LADDER — the single source of
// truth for the three published "from" anchors. Per-rung `note` copy is
// surface-specific (band-voice, shorter than the agency-page rung body), so
// only the name + price are reused. The discovery call doubles as the
// mid-funnel capture for buyers who are not ready to self-serve (06-10
// public-surfaces audit P1).
const DONE_FOR_YOU_RUNG_NOTES: Record<AgencyEngagementId, string> = {
  'architecture-review':
    'Fixed-bid written assessment of your project, schema, deployment, and security posture. Credited toward a Fleet deployment if you proceed within 30 days.',
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

export const PRICING_DONE_FOR_YOU = {
  eyebrow: 'Done for you',
  heading: 'Want it built and handed over?',
  body: 'RevealUI Studio (the agency) ships fixed-bid engagements on the runtime: scoped in a discovery call, delivered with a full handoff, owned by you afterward.',
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
    label: 'Visit revealuistudio.com →',
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
