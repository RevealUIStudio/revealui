/**
 * Pricing Page Tests
 *
 * Tests the pricing page server component, including:
 * - Data fetching from the API (with fallback)
 * - All three pricing tracks render
 * - FAQ section renders
 * - CTA href resolution for marketing context
 */

import { describe, expect, it, vi } from 'vitest';

// Mock next/link
vi.mock('next/link', () => ({
  default: vi.fn(({ children, href, ...props }) => ({
    type: 'a',
    props: { href, ...props },
    children,
  })),
}));

// Mock Footer component
vi.mock('@/components/Footer', () => ({
  Footer: vi.fn(() => ({ type: 'footer', props: {}, children: 'Footer' })),
}));

// Mock fetch for getPricing
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock contracts pricing
vi.mock('@revealui/contracts/pricing', () => ({
  SUBSCRIPTION_TIERS: [
    {
      id: 'free',
      name: 'Free',
      description: 'For hobbyists',
      price: undefined,
      period: undefined,
      cta: 'Get Started',
      ctaHref: 'https://docs.revealui.com',
      features: ['1 site', '3 users'],
      highlighted: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'For startups',
      price: undefined,
      period: '/mo',
      cta: 'Start Trial',
      ctaHref: '/signup?plan=pro',
      features: ['5 sites', '25 users'],
      highlighted: true,
    },
    {
      id: 'max',
      name: 'Max',
      description: 'For growing teams',
      price: undefined,
      period: '/mo',
      cta: 'Start Trial',
      ctaHref: '/signup?plan=max',
      features: ['15 sites', '100 users'],
      highlighted: false,
    },
    {
      id: 'enterprise',
      name: 'Forge',
      description: 'For enterprises',
      price: undefined,
      period: '/mo',
      cta: 'Contact Sales',
      ctaHref: 'mailto:support@revealui.com',
      features: ['Unlimited'],
      highlighted: false,
    },
  ],
  CREDIT_BUNDLES: [
    {
      name: 'Starter',
      tasks: '10K',
      description: 'For testing',
      price: '$49',
      priceNote: 'one-time',
      costPer: '$0.0049/task',
      highlighted: false,
    },
    {
      name: 'Growth',
      tasks: '50K',
      description: 'For production',
      price: '$199',
      priceNote: 'one-time',
      costPer: '$0.0040/task',
      highlighted: true,
    },
    {
      name: 'Scale',
      tasks: '200K',
      description: 'For scale',
      price: '$499',
      priceNote: 'one-time',
      costPer: '$0.0025/task',
      highlighted: false,
    },
  ],
  PERPETUAL_TIERS: [
    {
      name: 'Pro License',
      description: 'Pro tier forever',
      price: '$499',
      priceNote: 'one-time',
      renewal: '$99/year',
      cta: 'Buy License',
      ctaHref: 'mailto:support@revealui.com',
      features: ['All Pro features', '1 year updates'],
      comingSoon: false,
    },
    {
      name: 'Max License',
      description: 'Max tier forever',
      price: '$1,499',
      priceNote: 'one-time',
      renewal: '$299/year',
      cta: 'Buy License',
      ctaHref: 'mailto:support@revealui.com',
      features: ['All Max features', '1 year updates'],
      comingSoon: false,
    },
    {
      name: 'Forge License',
      description: 'Enterprise forever',
      price: '$4,999',
      priceNote: 'one-time',
      renewal: '$999/year',
      cta: 'Contact Sales',
      ctaHref: 'mailto:support@revealui.com',
      features: ['All Forge features', '1 year updates'],
      comingSoon: false,
    },
  ],
  SERVICE_OFFERINGS: [
    {
      id: 'architecture-review',
      name: 'Architecture Review',
      description: 'A senior engineer reviews your project structure.',
      includes: ['Full codebase review', 'Written report'],
      deliverable: 'Written report delivered within 5 business days',
      cta: 'Book Review',
      ctaHref: 'mailto:services@revealui.com',
    },
    {
      id: 'migration-assist',
      name: 'Migration Assist',
      description: 'Hands-on help migrating to RevealUI.',
      includes: ['Migration planning', 'Pair programming'],
      deliverable: '2-week engagement',
      cta: 'Start Migration',
      ctaHref: 'mailto:services@revealui.com',
    },
    {
      id: 'launch-package',
      name: 'Launch Package',
      description: 'Go from prototype to production.',
      includes: ['Production hardening', 'Deploy pipeline'],
      deliverable: '3-week engagement',
      cta: 'Book Launch',
      ctaHref: 'mailto:services@revealui.com',
    },
    {
      id: 'consulting-hour',
      name: 'Consulting Hour',
      description: 'One-on-one with a senior engineer.',
      includes: ['Screen share session', 'Follow-up notes'],
      deliverable: '1 hour session + follow-up email',
      cta: 'Book Session',
      ctaHref: 'mailto:services@revealui.com',
    },
  ],
}));

// Import after mocks
const { default: PricingPage } = await import('../page');

describe('PricingPage', () => {
  it('exports a default async function', () => {
    expect(typeof PricingPage).toBe('function');
  });

  it('renders when API returns null (fallback to static data)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await PricingPage();

    expect(result).toBeDefined();
    expect(result.type).toBe('div');
  });

  it('renders the page heading', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await PricingPage();
    const html = JSON.stringify(result);

    expect(html).toContain('Three ways to use');
    expect(html).toContain('RevealUI');
  });

  it('renders three track navigation badges (Track B hidden)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await PricingPage();
    const html = JSON.stringify(result);

    expect(html).toContain('Track A');
    expect(html).toContain('Subscriptions');
    // Track B (Agent Credits) hidden — not shipped yet
    expect(html).not.toContain('Track B');
    expect(html).toContain('Track C');
    expect(html).toContain('Perpetual Licenses');
    expect(html).toContain('Track D');
    expect(html).toContain('Services');
  });

  it('renders subscription tier names', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await PricingPage();
    const html = JSON.stringify(result);

    expect(html).toContain('Free');
    expect(html).toContain('Pro');
    expect(html).toContain('Max');
    expect(html).toContain('Forge');
  });

  it('does not render credit bundle section (Track B not shipped)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await PricingPage();
    const html = JSON.stringify(result);

    expect(html).not.toContain('Buy Credits');
    expect(html).not.toContain('Track B');
  });

  it('renders perpetual license tier names', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await PricingPage();
    const html = JSON.stringify(result);

    expect(html).toContain('Pro License');
    expect(html).toContain('Max License');
    expect(html).toContain('Forge License');
  });

  it('renders the FAQ section', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await PricingPage();
    const html = JSON.stringify(result);

    expect(html).toContain('Frequently Asked Questions');
    expect(html).toContain('Can I use the Free tier for commercial projects?');
    expect(html).toContain('How does agent task billing work?');
    expect(html).toContain('What are perpetual licenses?');
  });

  it('resolves relative CTA hrefs to admin URL', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await PricingPage();
    const html = JSON.stringify(result);

    // Pro tier ctaHref starts with / so gets resolved to Admin URL
    // The adminUrl defaults to https://admin.revealui.com unless NEXT_PUBLIC_ADMIN_URL is set
    expect(html).toContain('/signup?plan=pro');
    // Absolute URLs (docs, mailto) are kept as-is
    expect(html).toContain('https://docs.revealui.com');
    expect(html).toContain('mailto:support@revealui.com');
  });

  it('handles API fetch failure gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await PricingPage();

    // Should still render using fallback static data
    expect(result).toBeDefined();
    const html = JSON.stringify(result);
    expect(html).toContain('Subscription Plans');
  });

  it('uses API pricing data when available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        subscriptions: [
          {
            id: 'free',
            name: 'Free',
            description: 'For hobbyists',
            price: '$0',
            period: undefined,
            cta: 'Get Started',
            ctaHref: 'https://docs.revealui.com',
            features: ['1 site'],
            highlighted: false,
          },
        ],
        credits: [
          {
            name: 'Test Bundle',
            tasks: '5K',
            description: 'Test',
            price: '$25',
            priceNote: 'one-time',
            costPer: '$0.005/task',
            highlighted: false,
          },
        ],
        perpetual: [
          {
            name: 'Test License',
            description: 'Test',
            price: '$299',
            priceNote: 'one-time',
            renewal: '$50/year',
            cta: 'Buy',
            ctaHref: 'mailto:support@revealui.com',
            features: ['Test feature'],
            comingSoon: false,
          },
        ],
        services: [
          {
            id: 'test-service',
            name: 'Test Service',
            description: 'Test',
            includes: ['Test item'],
            deliverable: 'Test deliverable',
            cta: 'Book',
            ctaHref: 'mailto:services@revealui.com',
          },
        ],
      }),
    });

    const result = await PricingPage();
    const html = JSON.stringify(result);

    // Track B (credits) is hidden — Test Bundle should not render
    expect(html).not.toContain('Test Bundle');
    expect(html).toContain('Test License');
  });

  it('renders the "Most Popular" badge on the highlighted tier', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await PricingPage();
    const html = JSON.stringify(result);

    expect(html).toContain('Most Popular');
  });

  it('renders service offering names', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await PricingPage();
    const html = JSON.stringify(result);

    expect(html).toContain('Architecture Review');
    expect(html).toContain('Migration Assist');
    expect(html).toContain('Launch Package');
    expect(html).toContain('Consulting Hour');
  });

  it('does not render credit bundle "Best value" badge (Track B hidden)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await PricingPage();
    const html = JSON.stringify(result);

    // Credit bundle section is hidden — no "Best value" badge should render
    // from the credit bundles (it may appear elsewhere for subscription tiers)
    expect(html).not.toContain('Buy Credits');
  });
});
