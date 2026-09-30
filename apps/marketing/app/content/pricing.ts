// Public product catalog: Free / Pro / Max subscription + Enterprise as a
// license + Pro Perpetual as a license. Studio SKUs live on revealuistudio.com.
// Done-for-you, Starter Kit, Agency Founding Kit, and the rented-stack
// calculator are not part of this catalog.

export {
  type PricingResponse,
  PUBLIC_PERPETUAL_NAMES,
  PUBLIC_PERPETUAL_TIERS,
  SUBSCRIPTION_TIERS,
} from '@revealui/contracts/public-catalog';

import { METRICS, SITE } from './site';
import type { Cta, SectionHeading } from './types';

export interface AgentFeatureCard {
  readonly heading: string;
  readonly body: string;
  readonly badge?: string;
}

export const PRICING_HERO: SectionHeading = {
  eyebrow: 'Pricing',
  title: 'Choose a license for the runtime you run.',
  subtitle:
    'Start with Free. Choose Pro or Max for agent features and higher limits. Enterprise licenses are scoped with sales. All plans are self-hosted.',
};

/** Coming-soon work stays off the cards. Do not sell it as included. */
export const PRICING_COMING_SOON_NOTE =
  'Not included today: x402 agent payments. Status lives in the agents section below.';

export const PRICING_HERO_SUBTEXT = {
  prefix:
    'All plans run as self-hosted installations under your license. Enterprise is a license, not a hosted VM. Need a human?',
  linkLabel: 'revealuistudio.com',
  linkHref: SITE.urls.agency,
  suffix:
    'Need implementation? Studio is a separate path (Consultation, Pilot, Launch). This catalog is licenses only.',
} as const;

export const PRICING_HERO_NAV_ANCHORS = [
  { label: 'Subscription', href: '#subscriptions' },
  { label: 'Perpetual', href: '#perpetual' },
] as const;

export const PRICING_TRACK_A_SECTION = {
  eyebrow: 'Subscription',
  heading: 'Choose monthly or annual billing.',
  body: 'Paid subscriptions include an agent task allowance. Pro and Max include a 7-day free trial.',
} as const;

export const PRICING_VALUE_BAND = {
  heading: 'You own the runtime.',
  body: 'Build on shared accounts, content, offers, and billing. Add the agent layer when you need it. Your license covers RevealUI; hosting, your database, and model usage are separate costs.',
  points: [
    'One runtime, not five separate SaaS subscriptions',
    'Self-host on Vercel, Cloudflare, Fly, Hetzner, or your own metal',
    'Full source code access on every tier',
    'You provide model access and pay your infrastructure or provider costs',
  ],
} as const;

export const PRICING_HIGHLIGHTED_BADGE = 'Recommended: Pro' as const;

export const PRICING_TRIAL_NOTE =
  'Pro and Max include a 7-day free trial. Cancel during the trial and you pay nothing. First purchase, including annual, has a 14-day refund. No prorate after 14 days.' as const;

export const PRICING_TRACK_C_SECTION = {
  eyebrow: 'Perpetual',
  heading: 'Perpetual Licenses',
  body: 'Pro Perpetual lets you keep using your licensed version without a monthly subscription. Review the included update and support period before buying.',
} as const;

export const PRICING_AGENTS_SECTION = {
  eyebrow: 'Agent-Native',
  heading: 'RevealUI for AI Agents',
  subhead:
    'Agents can discover and authenticate today. Agent payment rails ship in the code and are not switched on (X402_ENABLED off).',
} as const;

export const PRICING_AGENT_A2A = {
  heading: 'A2A Discovery',
  body: {
    prefix: 'Agents find RevealUI via a standard Agent Card at',
    linkLabel: SITE.urls.apiAgent,
    linkHref: SITE.urls.apiAgent,
    suffix: '. Capabilities, skills, and pricing all machine-readable.',
  },
} as const;

export const PRICING_AGENT_X402 = {
  heading: 'x402-Native Payments',
  badge: 'Off by default',
  body: 'The HTTP 402 (x402) payment rail ships in the code and stays off by default. Built on the open x402 standard, with a Coinbase-compatible facilitator implemented. It is not included today: X402_ENABLED is off, and this is not a live payments product until an operator turns the flag on.',
} as const;

export const PRICING_AGENT_MCP = {
  heading: 'MCP Servers',
  body: `${METRICS.mcpServers} production MCP servers for any MCP-capable IDE (Cursor, Claude Code, Copilot, Zed, and others), including Stripe, Neon, Vercel, Playwright, Next.js DevTools, pages and offers, and email. First-party servers ship today. Discovery via marketplace.json and the servers list is a preview; the third-party catalog, charging, and payouts are not open.`,
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
