import { PricingTable, type PricingTier } from '@revealui/presentation/client';
import type { ShowcaseStory } from '@/components/showcase/types.js';

const tiers: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For solo builders shipping a first project.',
    features: ['1 workspace', 'Community support', 'Core components'],
    cta: 'Start free',
    ctaHref: '#',
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: 'per month',
    description: 'For teams running the full agentic runtime.',
    features: ['Unlimited workspaces', 'Priority support', 'Pro packages', 'Audit receipts'],
    cta: 'Upgrade to Pro',
    ctaHref: '#',
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For organizations that self-host with a brand of their own.',
    features: ['White-label', 'SSO and SCIM', 'Dedicated support', 'Custom SLAs'],
    cta: 'Contact sales',
    ctaHref: '#',
    highlighted: false,
  },
];

const story: ShowcaseStory = {
  slug: 'pricing-table',
  name: 'Pricing Table',
  description:
    'A three-tier pricing surface with a highlighted plan, feature checklists, and per-tier calls to action. Renders as a grid (full) or a horizontal row (compact), and can mark the current plan.',
  category: 'component',
  sourceUrl: 'src/components/pricing-table.tsx',

  controls: {
    compact: { type: 'boolean', default: false },
    currentTier: {
      type: 'select',
      options: ['none', 'free', 'pro', 'enterprise'],
      default: 'none',
    },
  },

  render: (props: Record<string, unknown>) => {
    const current = props.currentTier as string;
    return (
      <div className="w-full max-w-4xl">
        <PricingTable
          tiers={tiers}
          compact={props.compact as boolean}
          currentTier={current === 'none' ? undefined : current}
        />
      </div>
    );
  },

  examples: [
    {
      name: 'Compact row',
      render: () => (
        <div className="w-full max-w-4xl">
          <PricingTable tiers={tiers} compact />
        </div>
      ),
    },
    {
      name: 'Current plan marked',
      render: () => (
        <div className="w-full max-w-4xl">
          <PricingTable tiers={tiers} currentTier="pro" />
        </div>
      ),
    },
  ],

  a11y: {
    notes:
      'Each tier CTA is a real link/button; the highlighted tier is conveyed with more than color (border and label emphasis). Feature checkmarks are decorative (aria-hidden).',
  },

  code: () => '<PricingTable tiers={tiers} currentTier="pro" />',
};

export default story;
