// Sourced from: app/components/landing/PricingTeaser.tsx (Phase 1c, no copy changes).
// Per the internal marketing-overhaul plan §4.4.
// Tier copy lives here. Display amounts stay locked to marketing fallbacks so
// a stale /api/pricing cannot overwrite Free/Pro/Max.
// 2026-08-09: outcome-first Free/Pro teaser; package-count license math stays
// on Fair Source / pricing pages, not the homepage pitch.

import type { LicenseTierId } from '@revealui/contracts/public-catalog';
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
  heading: 'Start free. Add agents when you need them.',
  body: 'Free gives you the core runtime. Paid licenses add agent features and higher limits. You provide the infrastructure and model access.',
} as const;

// Free and Pro get full cards, since they cover the self-serve path most
// visitors take. Max and Enterprise collapse to PRICING_TEASER_LINKS below;
// full pricing for both lives on /pricing.
export const PRICING_TEASER_TIERS: readonly TeaserTier[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Build with the MIT-licensed core and run it on your infrastructure.',
    features: [
      'Sign-in and permissions',
      'Content APIs and admin components',
      'Offers and Stripe integration',
      'Core packages use the MIT license.',
    ],
    cta: 'Start free',
    href: SITE.urls.signup,
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Add agent tools, shared memory, and MCP integrations.',
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
    description: 'Max adds unattended inference and higher limits.',
    href: '/pricing',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Enterprise is scoped with sales.',
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
