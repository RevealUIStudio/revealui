// Sourced from: app/components/landing/PricingTeaser.tsx (Phase 1c, no copy changes).
// Per the internal marketing-overhaul plan §4.4.
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
  body: 'Self-host the open-source stack at no cost. Paid tiers (Pro, Max, Enterprise) are previews. Subscription billing opens when we flip Stripe live mode.',
} as const;

// Free and Pro get full cards, since they cover the self-serve path most
// visitors take. Max and Enterprise collapse to PRICING_TEASER_LINKS below;
// full pricing for both lives on /pricing.
export const PRICING_TEASER_TIERS: readonly TeaserTier[] = [
  {
    id: 'free',
    name: 'Free',
    description:
      '21 of 27 packages MIT, forever. The 5 Pro packages are Fair Source (FSL) and convert to MIT after two years. No telemetry.',
    features: [
      'Full primitive stack',
      'Admin dashboard + API',
      'Self-host on any infra',
      'Bring your own model (open-weight default)',
    ],
    cta: 'Start free',
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
      'Pro AI features (agents, MCP, memory), beta in production',
      'Priority support',
    ],
    cta: 'See Pro pricing',
    href: '/pricing',
    highlight: true,
  },
] as const;

export interface TeaserLink {
  readonly id: LicenseTierId;
  readonly name: string;
  readonly description: string;
  readonly href: string;
}

export const PRICING_TEASER_LINKS: readonly TeaserLink[] = [
  {
    id: 'max',
    name: 'Max',
    description: 'AI memory, advanced inference, and compliance tooling.',
    href: '/pricing',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Scale, compliance, and agent payments.',
    href: '/pricing',
  },
] as const;

export const PRICING_TEASER_FOOTER = {
  moreLabel: 'See full pricing →',
  moreHref: '/pricing',
  caption: {
    prefix: 'Deploys to Vercel, Cloudflare, Fly, Hetzner, or self-host.',
    code: 'pnpm build',
    suffix: 'produces a standard Node bundle.',
  },
} as const;
