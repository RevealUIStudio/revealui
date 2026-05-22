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

export interface CfoLineItem {
  readonly label: string;
  readonly amount: string;
}

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
  linkHref: '#track-c',
  suffix: 'for RevealUI Fleet licensing.',
} as const;

export const PRICING_HERO_NAV_ANCHORS = [
  { label: 'Track A: Subscriptions', href: '#track-a' },
  { label: 'Track C: Perpetual Licenses', href: '#track-c' },
] as const;

export const PRICING_TRACK_A_SECTION = {
  eyebrow: 'Track A',
  heading: 'Subscription Plans',
  body: 'Monthly subscriptions with a task allowance included. 7-day free trial on Pro and Max.',
} as const;

export const PRICING_CFO_PANEL = {
  eyebrow: 'Replacing what?',
  heading: 'A typical 5-dev startup pays $800–1,000/mo for the backend layer alone.',
  lineItems: [
    { label: 'Convex Team:', amount: '$125/mo (5 × $25)' },
    { label: 'Supabase Team:', amount: '$599/mo' },
    { label: 'Trigger.dev Pro:', amount: '$50/mo' },
    { label: 'Clerk Pro:', amount: '$25/mo' },
    { label: 'Stripe + observability:', amount: '~$50/mo+' },
  ] as readonly CfoLineItem[],
  totalLine: 'Total backend-platform spend: ~$800–1,000 / mo + per-event API costs.',
  bottomLine: 'RevealUI Pro is $49/mo + your own infrastructure. You own the runtime.',
  footnote:
    'Deploy targets like Vercel, Cloudflare, Railway, and Hetzner are unchanged — RevealUI runs on all of them. We replace the backend platforms, not where you ship.',
} as const;

export const PRICING_HIGHLIGHTED_BADGE = 'Most Popular' as const;

export const PRICING_TRACK_C_SECTION = {
  eyebrow: 'Track C',
  heading: 'Perpetual Licenses',
  body: 'Pay once, use forever. No subscription required. Support renewals are optional.',
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
  heading: 'Need help adopting RevealUI?',
  body: 'Architecture reviews, migrations, and launch support are offered separately by RevealUI Studio (the agency). Engagements are scoped per-project.',
  cta: {
    label: 'Visit revealuistudio.com →',
    href: SITE.urls.agency,
    external: true,
  } satisfies Cta,
} as const;

export const PRICING_FINAL_CTA: SectionHeading = {
  title: 'Ready to get started?',
  subtitle: 'Start free with full source code access. Upgrade when your business needs it.',
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

export const PRICING_NEWSLETTER_LABEL = 'Not ready yet? Stay in the loop.' as const;
