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

/**
 * Prospective paid-support policy, shared by catalog and published policy pages.
 * The revision identifies the text; publication, not this date, starts its scope.
 * It does not rewrite commitments in an earlier accepted agreement.
 */
export const PAID_SUPPORT_POLICY = {
  revision: '2026-10-04',
  standardResponseHours: 24,
  criticalResponseHours: 4,
  summary: 'Email support (best-effort targets: 24h weekdays / 4h critical)',
  standardResponse:
    'We aim to reply within 24 hours for requests received on weekdays. Support hours are Monday through Friday, 9am to 5pm U.S. Central Time, excluding U.S. federal holidays. Requests received outside those hours may take longer.',
  criticalResponse:
    'Critical issues have a best-effort response target of 4 hours, any day. A critical issue is one where your data is at risk or you cannot use the product you purchased at all.',
  coverage:
    'RevealUI Studio is operated by one person, with no backup support staff or on-call rotation. These response times are targets, not guaranteed response times or guaranteed coverage.',
  applicability:
    'This support policy (revision 2026-10-04) applies to new purchases made after it is published. Agreements accepted before publication retain their stated support commitments; this policy does not reduce them.',
} as const;

/** Same prospective email targets for every paid tier; no faster staffed tier. */
export const PAID_TIER_SUPPORT = PAID_SUPPORT_POLICY.summary;

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free (OSS)',
    description: 'Build with the free core on your infrastructure.',
    features: [
      'Admin collections for offers and pages you ship (not a Contents/Videos CMS SKU)',
      '1 site',
      'Up to 3 users/editors',
      'Session-based auth',
      'Basic real-time sync',
      'Local AI inference (Inference Snaps / Ollama)',
      'Community support',
      'Full source code access',
    ],
    cta: 'Start free',
    ctaHref: 'https://admin.revealui.com/signup',
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Add agent features and higher limits to your runtime.',
    features: [
      'Admin collections for offers and pages you ship (not a Contents/Videos CMS SKU)',
      'Up to 5 sites',
      'Up to 25 users/editors',
      'Session-based auth',
      'AI agents (local + cloud via RevealUI harness)',
      'Full AI memory (working + episodic + vector)',
      'Signed audit log plus downloadable Merkle roots you verify offline',
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
    ctaHref: 'https://admin.revealui.com/signup?plan=pro',
    highlighted: true,
  },
  {
    id: 'max',
    name: 'Max',
    description: 'Unattended inference and higher limits.',
    features: [
      'Everything in Pro',
      'Up to 15 sites',
      'Up to 100 users/editors',
      'Unattended inference (open-model inference configuration)',
      '50,000 agent tasks/month included',
      PAID_TIER_SUPPORT,
      'Full source code access',
    ],
    cta: 'Start your 7-day free trial',
    ctaHref: 'https://admin.revealui.com/signup?plan=max',
    highlighted: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Discuss licensing for larger deployments and your requirements.',
    features: [
      'Everything in Max',
      'Unlimited sites',
      'Unlimited users/editors',
      'Session-based auth + OAuth',
      'Supported open-model configurations',
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

/** Studio Consultation on revealuistudio.com. Not a revealui.com catalog SKU. Tax $0. */
export const CONSULTATION_PRICE = '$300' as const;

/**
 * Studio middle SKU price on revealuistudio.com. Public name is Pilot.
 * Not a revealui.com catalog SKU. The $1,500 list is retired.
 * 100% credit toward Launch within 45 days.
 * The export name PROOF_SPRINT_PRICE stays so existing imports keep working.
 */
export const PROOF_SPRINT_PRICE = '$3,997' as const;

/** Same value as PROOF_SPRINT_PRICE. Marketing imports this name. */
export const PILOT_PRICE = PROOF_SPRINT_PRICE;

/**
 * Studio Launch on revealuistudio.com. Not a revealui.com catalog SKU.
 * Architecture stays inside this offer. The $7,500 list is retired (2026-09-22).
 */
export const LAUNCH_PACKAGE_PRICE = '$14,500' as const;

/**
 * Pro Perpetual stays $1,499 one-time (2026-08-31 lock). Yearly Pro is now
 * $399/yr (~3.75 years to match). Leave the perpetual price; do not invent
 * a new one to close the gap.
 */
export const PRO_PERPETUAL_PRICE = '$1,499' as const;

export function perpetualLicenseSignupPath(sku: 'pro'): string {
  return `https://admin.revealui.com/signup?license=${sku}`;
}

/**
 * Public catalog perpetual names for GET /api/pricing and /pricing.
 * Pro Perpetual is the only public license buy.
 */
export const PUBLIC_PERPETUAL_NAMES = ['Pro Perpetual'] as const;

export function isPublicPerpetualCatalogName(name: string): boolean {
  return (PUBLIC_PERPETUAL_NAMES as readonly string[]).includes(name);
}

export {
  consultationSessionBuyerCopy,
  DEFAULT_MEETING_VENDOR_ID,
  emptyMeetingSessionRef,
  isNakedJoinUrl,
  type MeetingBundleFields,
  type MeetingDeliveryCard,
  type MeetingSessionRef,
  toMeetingBundleFields,
  toMeetingDeliveryCard,
} from './meeting-vendor.js';

/** Standalone public perpetual catalog. Do not derive this from leftover SKUs. */
export const PUBLIC_PERPETUAL_TIERS: PerpetualTier[] = [
  {
    name: 'Pro Perpetual',
    description: 'Pro features, forever. No subscription required.',
    features: [
      'All Pro tier features',
      'License key never expires',
      '1 year email support included',
      PAID_TIER_SUPPORT,
      'All Pro updates released during support period',
    ],
    renewal: '$149/yr for continued support',
    cta: 'Buy Pro Perpetual',
    ctaHref: perpetualLicenseSignupPath('pro'),
    comingSoon: false,
  },
];
