/**
 * Public product catalog. Marketing may import this module only.
 *
 * Leftover admin SKUs stay in `./pricing.ts` and must not appear here.
 *
 * @packageDocumentation
 */

export type LicenseTierId = 'free' | 'pro' | 'max' | 'enterprise';

export interface SubscriptionTier {
  id: LicenseTierId;
  name: string;
  price?: string;
  period?: string;
  annualPrice?: string;
  annualPeriod?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted: boolean;
}

export interface PerpetualTier {
  name: string;
  price?: string;
  priceNote?: string;
  renewal?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  comingSoon: boolean;
}

export interface ServiceOffering {
  id: string;
  name: string;
  price?: string;
  priceNote?: string;
  description: string;
  includes: string[];
  deliverable: string;
  cta: string;
  ctaHref: string;
}

export interface PricingResponse {
  subscriptions: SubscriptionTier[];
  credits: Array<{
    name: string;
    tasks: string;
    price?: string;
    priceNote?: string;
    costPer?: string;
    description: string;
    highlighted: boolean;
  }>;
  perpetual: PerpetualTier[];
  services: ServiceOffering[];
}

/** Same email SLA for every paid tier. Matches /sla: no Slack, no per-tier hours. */
export const PAID_TIER_SUPPORT = 'Email support (24h weekday / 4h if unusable)' as const;

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free (OSS)',
    description: 'Perfect for trying out RevealUI and small projects.',
    features: [
      'Unlimited admin collections',
      '1 site',
      'Up to 3 users/editors',
      'Session-based auth',
      'Basic real-time sync',
      'Local AI inference (Inference Snaps / Ollama)',
      'Community support',
      'Full source code access',
    ],
    cta: 'Start free',
    ctaHref: '/signup',
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For software companies building production products.',
    features: [
      'Unlimited admin collections',
      'Up to 5 sites',
      'Up to 25 users/editors',
      'Session-based auth',
      'AI agents (local + cloud via RevealUI harness)',
      'Built-in Stripe payments',
      'Full real-time sync',
      'Monitoring dashboard',
      'Custom domain mapping',
      '10,000 agent tasks/month included',
      'RevVault desktop app (encrypted secret management)',
      'RevVault rotation engine (automated credential lifecycle)',
      PAID_TIER_SUPPORT,
      'Full source code access',
    ],
    cta: 'Start your 7-day free trial',
    ctaHref: '/signup?plan=pro',
    highlighted: true,
  },
  {
    id: 'max',
    name: 'Max',
    description: 'For teams that need AI memory and compliance tooling.',
    features: [
      'Everything in Pro',
      'Up to 15 sites',
      'Up to 100 users/editors',
      'Full AI memory (working + episodic + vector)',
      'Signed audit log plus downloadable Merkle roots you verify offline',
      '50,000 agent tasks/month included',
      PAID_TIER_SUPPORT,
      'Full source code access',
    ],
    cta: 'Start your 7-day free trial',
    ctaHref: '/signup?plan=max',
    highlighted: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Full ecosystem access with scale and compliance.',
    features: [
      'Everything in Max',
      'Unlimited sites',
      'Unlimited users/editors',
      'Session-based auth + OAuth',
      'Full inference suite (all open models)',
      'Unlimited agent tasks',
      PAID_TIER_SUPPORT,
      'Annual pricing available',
      'Full source code access',
    ],
    cta: 'Contact sales',
    ctaHref: 'https://revealui.com/contact',
    highlighted: false,
  },
];

/** Public + in-app Enterprise door. Not a Stripe checkout session. */
export const ENTERPRISE_SALES_HREF = 'https://revealui.com/contact' as const;

/** Founder intro booking. Google Calendar appointments only. */
export const BOOK_INTRO_HREF =
  'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ21UZVcuYp7yO32rZmhyUvZFDJcvles81E9edGNFwSUP8SHEVzGvq0gKgNFo7q04YS5i-12ZE5P' as const;

/** Studio Hour on revealuistudio.com. Not a revealui.com catalog SKU. */
export const CONSULTING_HOUR_PRICE = '$300' as const;

/** Studio written plan on revealuistudio.com. Not a revealui.com catalog SKU. */
export const ARCHITECTURE_REVIEW_PRICE = '$3,500' as const;

/** Studio Launch on revealuistudio.com. Not a revealui.com catalog SKU. */
export const LAUNCH_PACKAGE_PRICE = '$7,500' as const;

export function perpetualLicenseSignupPath(sku: 'pro'): string {
  return `/signup?license=${sku}`;
}

/**
 * Public catalog perpetual names for GET /api/pricing and /pricing.
 * Pro Perpetual is the only public license buy.
 */
export const PUBLIC_PERPETUAL_NAMES = ['Pro Perpetual'] as const;

export function isPublicPerpetualCatalogName(name: string): boolean {
  return (PUBLIC_PERPETUAL_NAMES as readonly string[]).includes(name);
}

/** Standalone public perpetual catalog. Do not derive this from leftover SKUs. */
export const PUBLIC_PERPETUAL_TIERS: PerpetualTier[] = [
  {
    name: 'Pro Perpetual',
    description: 'Pro features, forever. No subscription required.',
    features: [
      'All Pro tier features',
      'License key never expires',
      '1 year priority support included',
      'All Pro updates released during support period',
      'Private GitHub repo access',
    ],
    renewal: '$149/yr for continued support',
    cta: 'Buy Pro Perpetual',
    ctaHref: perpetualLicenseSignupPath('pro'),
    comingSoon: false,
  },
];
