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
}

export const PRICING_HERO: SectionHeading = {
  title: 'RevealUI pricing',
  subtitle: 'Subscribe, or buy a perpetual license. Start free. Upgrade when you need to.',
};

/** Coming-soon work stays off the cards. Do not sell it as included. */
export const PRICING_COMING_SOON_NOTE =
  'Not included today: advanced inference configuration, environment provisioning, and x402 agent payments. Status lives in the agents section below.';

export const PRICING_HERO_SUBTEXT = {
  prefix:
    'All plans run as self-hosted installations under your license. Enterprise is a license, not a hosted VM. Need a human?',
  linkLabel: 'revealuistudio.com',
  linkHref: SITE.urls.agency,
  suffix: 'Studio SKUs live on that site, not on this catalog.',
} as const;

export const PRICING_HERO_NAV_ANCHORS = [
  { label: 'Quote', href: '#quote' },
  { label: 'Subscription', href: '#subscriptions' },
  { label: 'Perpetual', href: '#perpetual' },
] as const;

export const PRICING_TRACK_A_SECTION = {
  eyebrow: 'Subscription',
  heading: 'Subscribe monthly or annually',
  body: 'Every subscription includes an agent task allowance. 7-day free trial on Pro and Max.',
} as const;

export const PRICING_VALUE_BAND = {
  heading: 'You own the runtime.',
  body: 'Teams shipping more than one product typically rent auth, content, billing, and observability from four or five vendors, and the bill climbs further once enterprise SSO or compliance tiers enter. RevealUI replaces the rented stack with one runtime you own. You still pay for your own Postgres and compute.',
  points: [
    'One runtime, not five separate SaaS subscriptions',
    'Self-host on Vercel, Cloudflare, Fly, Hetzner, or your own metal',
    'Full source code access on every tier',
    "Open-weight AI by default: your bill doesn't scale with usage",
  ],
} as const;

export const PRICING_HIGHLIGHTED_BADGE = 'Recommended' as const;

export const PRICING_TRIAL_NOTE =
  'Pro and Max include a 7-day free trial. Cancel during the trial and you pay nothing.' as const;

export const PRICING_TRACK_C_SECTION = {
  eyebrow: 'Perpetual',
  heading: 'Perpetual Licenses',
  body: 'A perpetual license costs about three years of the subscription. Pay once, own it forever, and renew support only if you want it.',
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
