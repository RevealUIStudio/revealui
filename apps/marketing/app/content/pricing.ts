// Sourced from: app/routes/PricingPage.tsx (Phase 1 extraction).
// Phase 3 (2026-05-18) update: agent-section MCP count now references
// METRICS.mcpServers (canonical 13 per docs/MARKETING_METRICS.md §1).
// Canonical pricing numbers re-exported from @revealui/contracts/pricing for component convenience.

export {
  PERPETUAL_TIERS,
  type PricingResponse,
  SUBSCRIPTION_TIERS,
} from '@revealui/contracts/pricing';

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
    'All plans run as self-hosted installations under your license — managed deployment available as a service add-on. Want to deploy a branded version for your own customers? See',
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
  body: 'Most backend platforms rent you auth, content, jobs, and payments as separate per-seat subscriptions you never stop paying. RevealUI ships them as one runtime you self-host under your own license.',
  points: [
    'One runtime, not five separate SaaS subscriptions',
    'Self-host on Vercel, Cloudflare, Fly, Hetzner, or your own metal',
    'Full source code access on every tier',
    "Open-weight AI by default — your bill doesn't scale with usage",
  ],
} as const;

export const PRICING_HIGHLIGHTED_BADGE = 'Most Popular' as const;

export const PRICING_TRACK_C_SECTION = {
  eyebrow: 'Perpetual',
  heading: 'Perpetual Licenses',
  body: 'Pay once, use forever. No subscription required. Support renewals are optional.',
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
  body: "RevealUI implements the HTTP 402 payment protocol. Compatible with Amazon Bedrock AgentCore Payments, Coinbase, and Cloudflare's x402 Foundation. Agents pay agents over standard HTTP — no accounts, no subscriptions.",
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

export const PRICING_AGENCY_SECTION = {
  heading: 'Adoption help from RevealUI Studio',
  body: 'Architecture reviews, migrations, and launch support are offered separately by RevealUI Studio (the agency). Engagements are scoped per-project.',
  cta: {
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
