/**
 * @revealui/contracts/pricing
 *
 * Admin/server catalog: public subscriptions + leftover perpetual SKUs
 * (Agency / Enterprise perpetual) kept for mint/display of already-issued
 * keys. Those leftovers are not buyable. Marketing must import
 * `@revealui/contracts/public-catalog` instead so leftover SKUs cannot
 * ship in the public JS bundle.
 *
 * @packageDocumentation
 */

export {
  BOOK_INTRO_HREF,
  CONSULTATION_PRICE,
  ENTERPRISE_SALES_HREF,
  isPublicPerpetualCatalogName,
  LAUNCH_PACKAGE_PRICE,
  type LicenseTierId,
  PAID_TIER_SUPPORT,
  type PerpetualTier,
  PILOT_PRICE,
  PRO_PERPETUAL_PRICE,
  type PricingResponse,
  PUBLIC_PERPETUAL_NAMES,
  PUBLIC_PERPETUAL_TIERS,
  perpetualLicenseSignupPath as publicPerpetualLicenseSignupPath,
  type ServiceOffering,
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
} from './public-catalog.js';

import {
  BOOK_INTRO_HREF,
  CONSULTATION_PRICE,
  ENTERPRISE_SALES_HREF,
  LAUNCH_PACKAGE_PRICE,
  type LicenseTierId,
  type PerpetualTier,
  PILOT_PRICE,
  PUBLIC_PERPETUAL_TIERS,
  type ServiceOffering,
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
} from './public-catalog.js';

// =============================================================================
// License Tier Type
// =============================================================================

// =============================================================================
// Feature Flag Key (mirrors @revealui/core/features, defined here to avoid
// circular dependency since core depends on contracts, not the reverse)
// =============================================================================

export type FeatureFlagKey =
  | 'aiLocal'
  | 'ai'
  | 'aiMemory'
  | 'mcp'
  | 'payments'
  | 'advancedSync'
  | 'dashboard'
  | 'customDomain'
  | 'analytics'
  | 'aiInference'
  | 'auditLog'
  | 'multiTenant'
  | 'whiteLabel'
  | 'sso'
  | 'vaultDesktop'
  | 'vaultRotation'
  | 'devkitProfiles';

// =============================================================================
// Tier Display Constants
// =============================================================================

export const TIER_LABELS: Record<LicenseTierId, string> = {
  free: 'Free (OSS)',
  pro: 'Pro',
  max: 'Max',
  enterprise: 'Enterprise',
};

export const TIER_COLORS: Record<LicenseTierId, string> = {
  free: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  pro: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  max: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

// =============================================================================
// Feature Labels (human-readable names for FeatureFlags keys)
// =============================================================================

export const FEATURE_LABELS: Record<FeatureFlagKey, string> = {
  aiLocal: 'Local AI (Inference Snaps, Ollama)',
  ai: 'AI Agents',
  aiMemory: 'AI Memory',
  mcp: 'MCP Framework',
  payments: 'Built-in Payments',
  advancedSync: 'Advanced Real-time Sync',
  dashboard: 'Monitoring Dashboard',
  customDomain: 'Custom Domain Mapping',
  analytics: 'Analytics & Tracking',
  aiInference: 'Open-Model Inference (Snaps, Ollama, Harness)',
  auditLog: 'Audit receipts (signed log + downloadable Merkle roots)',
  multiTenant: 'Multi-site Content Management',
  whiteLabel: 'White-label Branding (RevForge operator stamp)',
  sso: 'Enterprise SSO (OIDC / SAML)',
  vaultDesktop: 'RevVault Desktop App',
  vaultRotation: 'RevVault Rotation Engine',
  devkitProfiles: 'RevKit Environment Provisioning',
};

// =============================================================================
// Tier Limits
// =============================================================================

export interface TierLimits {
  sites: number | null;
  users: number | null;
  agentTasks: number | null;
  apiRequestsPerMinute: number;
}

export const TIER_LIMITS: Record<LicenseTierId, TierLimits> = {
  free: { sites: 1, users: 3, agentTasks: 0, apiRequestsPerMinute: 200 },
  pro: { sites: 5, users: 25, agentTasks: 10_000, apiRequestsPerMinute: 300 },
  max: { sites: 15, users: 100, agentTasks: 50_000, apiRequestsPerMinute: 600 },
  enterprise: { sites: null, users: null, agentTasks: null, apiRequestsPerMinute: 1_000 },
};

/**
 * Site caps baked into **perpetual** license JWTs at mint time (GAP-448).
 *
 * Runtime subscription Max uses {@link TIER_LIMITS}.max.sites (15). Agency
 * Perpetual is the self-serve Fleet rung (canon: up to **10** client
 * deployments) and checkouts with `tier: max` + perpetual metadata — so mint
 * must pass maxSites explicitly or Agency keys inherit the wider Max default.
 *
 * `null` = omit maxSites on the JWT (unlimited).
 */
export function perpetualMaxSitesForTier(tier: 'pro' | 'max' | 'enterprise'): number | null {
  if (tier === 'pro') return TIER_LIMITS.pro.sites;
  // Agency Perpetual (and only perpetual max checkout) — offerings-canonical Track C.
  if (tier === 'max') return 10;
  return null;
}

// =============================================================================
// Credit Bundles (Track B) — not a public catalog. Admin/server leftover.
// =============================================================================

export interface CreditBundle {
  name: string;
  tasks: string;
  price?: string;
  priceNote?: string;
  costPer?: string;
  description: string;
  highlighted: boolean;
}

export const CREDIT_BUNDLES: CreditBundle[] = [
  {
    name: 'Starter',
    tasks: '10,000',
    description: 'Top up any plan. Never expires.',
    highlighted: false,
  },
  {
    name: 'Standard',
    tasks: '60,000',
    description: '17% cheaper per task vs Starter.',
    highlighted: true,
  },
  {
    name: 'Scale',
    tasks: '350,000',
    description: '29% cheaper per task vs Starter.',
    highlighted: false,
  },
];

// =============================================================================
// Founder-led Professional Services (Track D)
//
// Scope: public studio menu on revealuistudio.com — Consultation, Pilot,
// Launch. Architecture work happens inside Launch; it is not a public SKU.
// These are NOT the product-catalog offerings. The product /pricing page
// sells licenses only (Free / Pro / Max / Enterprise + Perpetual Pro).
// Studio SKUs live on revealuistudio.com and in
// apps/marketing/app/content/for-operators.ts (not rendered on /pricing).
// Canonical Consultation / Pilot / Launch prices are owned here;
// leftover studio surfaces import them rather than re-authoring.
// =============================================================================

export const FOUNDER_SERVICE_OFFERINGS: ServiceOffering[] = [
  {
    id: 'consultation',
    name: 'Consultation',
    price: CONSULTATION_PRICE,
    description:
      'One-on-one time with the founder who built RevealUI. Scope a Pilot or Launch, debug a live site, or pair on a specific problem.',
    includes: [
      'Scheduled video call with screen sharing',
      'Follow-up notes and action items',
      'Priority scheduling (within 48 hours)',
    ],
    deliverable: 'Session recording and written follow-up notes',
    cta: 'Book a Consultation',
    ctaHref: BOOK_INTRO_HREF,
  },
  {
    id: 'pilot',
    name: 'Pilot',
    price: PILOT_PRICE,
    description:
      'One site on your domain and one agent you run. You keep it. Credits 100% to Launch if you start Launch within 30 days.',
    includes: [
      'One site live on your domain',
      'One agent you operate (you keep it)',
      'Handoff so you can run it without us',
      'Full credit toward Launch if you start Launch within 30 days',
    ],
    deliverable: 'A working site and agent on your accounts',
    cta: 'Book a Consultation',
    ctaHref: BOOK_INTRO_HREF,
  },
  {
    id: 'launch-package',
    name: 'Launch',
    price: LAUNCH_PACKAGE_PRICE,
    description:
      'Go from zero to production, including architecture work inside this engagement. I set up your RevealUI instance, configure your content model, deploy, and hand you the keys.',
    includes: [
      'Architecture, schema, and security work inside Launch (not a separate SKU)',
      'RevealUI project setup and configuration',
      'Content schema design for your use case',
      'Authentication and access control',
      'Deployment with custom domain',
      'Operational handoff documentation',
    ],
    deliverable: 'Production-ready deployment within 2-4 weeks',
    cta: 'Book a Consultation',
    ctaHref: BOOK_INTRO_HREF,
  },
];

// Leftover Track C SKUs for admin/server checkout only. Marketing must not
// import this array — use PUBLIC_PERPETUAL_TIERS.
export const PERPETUAL_TIERS: PerpetualTier[] = [
  ...PUBLIC_PERPETUAL_TIERS,
  {
    name: 'Agency Perpetual',
    description:
      'Perpetual Max-tier license for agencies: up to ten client deployments. License plus a thin kit, not an unattended RevForge Fleet stamp.',
    features: [
      'All Max tier features',
      'License key never expires',
      'Up to 10 client deployments',
      '1 year priority support included',
      'All Max updates released during support period',
      'Private GitHub repo access',
    ],
    renewal: '$799/yr for continued support',
    cta: 'Contact sales',
    ctaHref: ENTERPRISE_SALES_HREF,
    comingSoon: false,
  },
  {
    name: 'Enterprise Perpetual',
    description:
      'Enterprise license plus studio onboarding. Not an unattended Fleet pull-and-run kit.',
    features: [
      'All Enterprise tier features',
      'License key never expires',
      'Unlimited deployments after studio onboarding',
      '1 year priority support included',
      'All Enterprise tier updates released during support period',
      'Private GitHub repo access after studio onboarding',
    ],
    renewal: '$3,999/yr for continued support',
    cta: 'Contact sales',
    ctaHref: 'https://revealui.com/contact',
    comingSoon: false,
  },
];

// =============================================================================
// Helper: get tiers from current upward (for upgrade prompts)
// =============================================================================

const TIER_RANK: Record<LicenseTierId, number> = {
  free: 0,
  pro: 1,
  max: 2,
  enterprise: 3,
};

export function getTiersFromCurrent(currentTier: LicenseTierId): SubscriptionTier[] {
  const currentRank = TIER_RANK[currentTier];
  return SUBSCRIPTION_TIERS.filter((t) => TIER_RANK[t.id] > currentRank);
}

/**
 * Unattended Stripe *subscription* checkout is Pro and Max only.
 * Enterprise subscription is sales-assisted — UI and API must use
 * {@link ENTERPRISE_SALES_HREF}. Perpetual buy uses
 * {@link allowsUnattendedPerpetualCheckout} (Pro only).
 */
export function allowsUnattendedCheckout(tier: LicenseTierId): boolean {
  return tier === 'pro' || tier === 'max';
}

/**
 * Unattended perpetual checkout keep-list. Pro Perpetual ($1,499) is the
 * only self-serve perpetual SKU. Leftover Agency (`max`) and Enterprise
 * perpetual stay in {@link PERPETUAL_TIERS} for issued-key display/mint.
 */
export function allowsUnattendedPerpetualCheckout(tier: LicenseTierId): boolean {
  return tier === 'pro';
}

/** Buy hop keep-list. Leftover agency/enterprise SKUs are display-only. */
export function isBuyablePerpetualLicenseSku(sku: PerpetualLicenseSku): sku is 'pro' {
  return sku === 'pro';
}

/** Parse leftover URLs for existing-license labels. Buy hops must filter. */
export function parseBuyablePerpetualLicenseSku(raw: string | null): 'pro' | null {
  const sku = parsePerpetualLicenseSku(raw);
  return sku !== null && isBuyablePerpetualLicenseSku(sku) ? sku : null;
}

/**
 * Public perpetual SKU on marketing → admin signup (`?license=`).
 * Distinct from subscription `?plan=` so a Buy click cannot start a trial.
 * Agency maps to checkout tier `max` (Agency Perpetual is Max-tier).
 */
export type PerpetualLicenseSku = 'pro' | 'agency' | 'enterprise';

export function parsePerpetualLicenseSku(raw: string | null): PerpetualLicenseSku | null {
  if (raw === 'pro' || raw === 'agency' || raw === 'enterprise') return raw;
  if (raw === 'max') return 'agency';
  return null;
}

export function perpetualLicenseLabel(sku: PerpetualLicenseSku): string {
  if (sku === 'pro') return 'Pro Perpetual';
  if (sku === 'agency') return 'Agency Perpetual';
  return 'Enterprise Perpetual';
}

export function perpetualLicenseSignupPath(sku: PerpetualLicenseSku): string {
  return `/signup?license=${sku}`;
}

export function perpetualLicenseCheckoutPath(sku: PerpetualLicenseSku): string {
  return `/account/license?license=${sku}`;
}

export function perpetualLicenseCheckoutTier(
  sku: PerpetualLicenseSku,
): Exclude<LicenseTierId, 'free'> {
  if (sku === 'agency') return 'max';
  return sku;
}

export function getTierLabel(tier: LicenseTierId): string {
  return TIER_LABELS[tier];
}

export function getTierColor(tier: LicenseTierId): string {
  return TIER_COLORS[tier];
}
