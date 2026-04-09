/**
 * @revealui/contracts/pricing
 *
 * Single source of truth for all tier, pricing, and feature display data.
 * Eliminates duplication across marketing, CMS billing, license, and upgrade pages.
 *
 * @packageDocumentation
 */

// =============================================================================
// License Tier Type
// =============================================================================

export type LicenseTierId = 'free' | 'pro' | 'max' | 'enterprise';

// =============================================================================
// Feature Flag Key (mirrors @revealui/core/features — defined here to avoid
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
  enterprise: 'Forge (Enterprise)',
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
  auditLog: 'Audit Logging',
  multiTenant: 'Multi-tenant Management',
  whiteLabel: 'White-label Branding (Coming Soon)',
  sso: 'SSO/SAML Authentication (Coming Soon)',
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
  free: { sites: 1, users: 3, agentTasks: 1_000, apiRequestsPerMinute: 200 },
  pro: { sites: 5, users: 25, agentTasks: 10_000, apiRequestsPerMinute: 300 },
  max: { sites: 15, users: 100, agentTasks: 50_000, apiRequestsPerMinute: 600 },
  enterprise: { sites: null, users: null, agentTasks: null, apiRequestsPerMinute: 1_000 },
};

// =============================================================================
// Subscription Tiers (Track A)
// =============================================================================

export interface SubscriptionTier {
  id: LicenseTierId;
  name: string;
  price?: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted: boolean;
  /** Discount percentage when paying with RevealCoin (RVUI). */
  rvuiDiscount?: number;
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free (OSS)',
    description: 'Perfect for trying out RevealUI and small projects.',
    features: [
      'Unlimited CMS collections',
      '1 site',
      'Up to 3 users/editors',
      'Session-based auth',
      'Basic real-time sync',
      'Local AI inference (Inference Snaps / Ollama)',
      'Community support',
      'Full source code access',
    ],
    cta: 'Get Started',
    ctaHref: 'https://docs.revealui.com',
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For software companies building production products.',
    features: [
      'Unlimited CMS collections',
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
      'Email support (48h response)',
      'Full source code access',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/signup?plan=pro',
    highlighted: true,
    rvuiDiscount: 15,
  },
  {
    id: 'max',
    name: 'Max',
    description: 'For teams that need AI memory, advanced inference, and compliance tooling.',
    features: [
      'Everything in Pro',
      'Up to 15 sites',
      'Up to 100 users/editors',
      'Full AI memory (working + episodic + vector)',
      'Advanced inference configuration',
      'Audit logging',
      '50,000 agent tasks/month included',
      'RevKit environment provisioning (tiered dev profiles)',
      'Email support (24h response)',
      'Full source code access',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/signup?plan=max',
    highlighted: false,
    rvuiDiscount: 15,
  },
  {
    id: 'enterprise',
    name: 'Forge',
    description: 'Full ecosystem access with scale, compliance, and agent payments.',
    features: [
      'Everything in Max',
      'Unlimited sites',
      'Unlimited users/editors',
      'Session-based auth + OAuth (SSO/SAML coming soon)',
      'Full inference suite (all open models)',
      'RevealCoin x402 agent payments',
      'Multi-tenant architecture',
      'White-label branding (coming soon)',
      'Unlimited agent tasks',
      'Slack support (4h SLA)',
      'Annual pricing available',
      'Full source code access',
    ],
    cta: 'Contact Sales',
    ctaHref: 'mailto:support@revealui.com?subject=Forge%20Inquiry',
    highlighted: false,
  },
];

// =============================================================================
// Credit Bundles (Track B)
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
// Perpetual Licenses (Track C)
// =============================================================================

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

// =============================================================================
// Professional Services (Track D)
// =============================================================================

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

export const SERVICE_OFFERINGS: ServiceOffering[] = [
  {
    id: 'architecture-review',
    name: 'Architecture Review',
    description:
      'A senior engineer reviews your project structure, database schema, deployment pipeline, and AI integration. You receive a written report with actionable recommendations.',
    includes: [
      'Full codebase review (up to 50K LOC)',
      'Database schema and query analysis',
      'Deployment and CI/CD assessment',
      'Security posture review',
      'Written report with prioritized recommendations',
    ],
    deliverable: 'Written report delivered within 5 business days',
    cta: 'Book Review',
    ctaHref: 'mailto:services@revealui.com?subject=Architecture%20Review',
  },
  {
    id: 'migration-assist',
    name: 'Migration Assist',
    description:
      'We migrate your existing CMS, database, or billing system to RevealUI. Includes data mapping, schema translation, and validation testing.',
    includes: [
      'Data audit and mapping plan',
      'Schema translation and migration scripts',
      'Content and user migration',
      'Validation testing and rollback plan',
      'Post-migration support (2 weeks)',
    ],
    deliverable: 'Working migration with verified data integrity',
    cta: 'Get a Quote',
    ctaHref: 'mailto:services@revealui.com?subject=Migration%20Assist',
  },
  {
    id: 'launch-package',
    name: 'Launch Package',
    description:
      'Go from zero to production in one week. We set up your RevealUI instance, configure billing, deploy to Vercel, and hand you the keys.',
    includes: [
      'RevealUI project setup and configuration',
      'Stripe billing integration (products, webhooks, portal)',
      'Vercel deployment with custom domain',
      'AI agent configuration (model selection, tool setup)',
      'Content schema design for your use case',
      '1 hour onboarding call',
    ],
    deliverable: 'Production-ready deployment within 5 business days',
    cta: 'Book Launch',
    ctaHref: 'mailto:services@revealui.com?subject=Launch%20Package',
  },
  {
    id: 'consulting-hour',
    name: 'Consulting Hour',
    description:
      'One-on-one time with a RevealUI engineer. Pair programming, architecture advice, debugging, or anything else you need help with.',
    includes: [
      '1 hour video call with screen sharing',
      'Follow-up notes and action items',
      'Priority scheduling (within 48 hours)',
    ],
    deliverable: 'Session recording and written follow-up notes',
    cta: 'Book a Session',
    ctaHref: 'mailto:services@revealui.com?subject=Consulting%20Hour',
  },
];

// =============================================================================
// Pricing API Response
// =============================================================================

export interface PricingResponse {
  subscriptions: SubscriptionTier[];
  credits: CreditBundle[];
  perpetual: PerpetualTier[];
  services: ServiceOffering[];
}

export const PERPETUAL_TIERS: PerpetualTier[] = [
  {
    name: 'Pro Perpetual',
    description: 'Pro features, forever. No subscription required.',
    features: [
      'All Pro tier features',
      'License key — never expires',
      '1 year priority support included',
      'All Pro updates released during support period',
      'Private GitHub repo access',
    ],
    cta: 'Buy License',
    ctaHref: 'mailto:support@revealui.com?subject=Pro%20Perpetual%20License',
    comingSoon: false,
  },
  {
    name: 'Agency Perpetual',
    description: 'Deploy for multiple clients without per-site subscriptions.',
    features: [
      'All Max tier features',
      'License key — never expires',
      'Up to 10 client deployments',
      '1 year priority support included',
      'All Max updates released during support period',
      'Private GitHub repo access',
    ],
    cta: 'Buy License',
    ctaHref: 'mailto:support@revealui.com?subject=Agency%20Perpetual%20License',
    comingSoon: false,
  },
  {
    name: 'Forge Perpetual',
    description: 'Full self-hosted Forge with unlimited deployments.',
    features: [
      'All Forge tier features',
      'License key — never expires',
      'Unlimited self-hosted deployments',
      '1 year priority support included',
      'All Forge updates released during support period',
      'Private GitHub repo + Docker image access',
    ],
    cta: 'Contact Sales',
    ctaHref: 'mailto:support@revealui.com?subject=Forge%20Perpetual%20License%20Inquiry',
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

export function getTierLabel(tier: LicenseTierId): string {
  return TIER_LABELS[tier];
}

export function getTierColor(tier: LicenseTierId): string {
  return TIER_COLORS[tier];
}
