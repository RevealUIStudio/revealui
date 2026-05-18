// Sourced from: app/components/landing/PricingTeaser.tsx (Phase 1c, no copy changes).
// Per docs/lanes/marketing-overhaul/plan.md §4.4.
// Tier copy lives here; runtime pricing (prices/periods) fetched from /api/pricing in the component.

import type { LicenseTierId } from '@revealui/contracts/pricing';
import { SITE } from './site';

export interface TeaserTier {
  readonly id: LicenseTierId;
  readonly name: string;
  readonly description: string;
  readonly features: readonly string[];
  readonly cta: string;
  readonly href: string;
  readonly highlight: boolean;
}

export const PRICING_TEASER_SECTION = {
  eyebrow: 'Pricing',
  heading: 'Start free. Pay when you scale.',
  body: 'Self-host the open-source stack at no cost. Pay for the AI primitives and priority support when your business needs them.',
} as const;

export const PRICING_TEASER_TIERS: readonly TeaserTier[] = [
  {
    id: 'free',
    name: 'Free',
    description:
      '24 of 26 packages MIT — forever. The 2 Pro packages are Fair Source (FSL) and convert to MIT after two years. No telemetry.',
    features: [
      'Full primitive stack',
      'Admin dashboard + API',
      'Self-host on any infra',
      'Bring your own model (open-weight default)',
    ],
    cta: 'Get started free',
    href: SITE.urls.signup,
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Pro AI primitives, agent task allowance, and priority support.',
    features: [
      'Everything in Free',
      '10,000 agent tasks / month included',
      'Pro AI features (agents, MCP, memory) — beta in production',
      'Priority support',
    ],
    cta: 'See Pro pricing',
    href: '/pricing',
    highlight: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description:
      'Audit logs, multi-tenant architecture, and a named contact. Custom plans for high volume; SSO and on-prem on the roadmap.',
    features: [
      'Everything in Pro',
      'Audit logs + compliance reports',
      'Multi-tenant architecture',
      'Roadmap: SSO, SCIM, on-prem deploy',
    ],
    cta: 'Talk to us',
    href: '/contact',
    highlight: false,
  },
] as const;

export const PRICING_TEASER_FOOTER = {
  moreLabel: 'See full pricing →',
  moreHref: '/pricing',
  caption: {
    prefix: 'Deploys to Vercel, Cloudflare, Railway, Hetzner, or self-host.',
    code: 'pnpm build',
    suffix: 'produces a standard Node bundle — no vendor-specific edge runtimes.',
  },
} as const;
