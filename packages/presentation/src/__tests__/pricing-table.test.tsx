import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PricingTable, type PricingTier } from '../components/pricing-table.js';

// =============================================================================
// Test Data
// =============================================================================

const mockTiers: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    description: 'For small projects.',
    features: ['Feature A', 'Feature B'],
    cta: 'Get Started',
    ctaHref: '/signup',
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    period: '/month',
    description: 'For production apps.',
    features: ['Everything in Free', 'Feature C', 'Feature D'],
    cta: 'Start Trial',
    ctaHref: '/signup?plan=pro',
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$299',
    period: '/month',
    description: 'For large teams.',
    features: ['Everything in Pro', 'Feature E'],
    cta: 'Contact Sales',
    ctaHref: 'mailto:sales@example.com',
    highlighted: false,
  },
];

// =============================================================================
// Full Layout (default)
// =============================================================================

describe('PricingTable  -  full layout', () => {
  it('renders all tiers', () => {
    render(<PricingTable tiers={mockTiers} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('renders tier prices', () => {
    render(<PricingTable tiers={mockTiers} />);
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText('$49')).toBeInTheDocument();
    expect(screen.getByText('$299')).toBeInTheDocument();
  });

  it('renders period for paid tiers', () => {
    render(<PricingTable tiers={mockTiers} />);
    const periods = screen.getAllByText('/month');
    expect(periods).toHaveLength(2);
  });

  it('renders features as list items', () => {
    render(<PricingTable tiers={mockTiers} />);
    expect(screen.getByText('Feature A')).toBeInTheDocument();
    expect(screen.getByText('Feature C')).toBeInTheDocument();
    expect(screen.getByText('Feature E')).toBeInTheDocument();
  });

  it('renders "Most Popular" badge for highlighted tier', () => {
    render(<PricingTable tiers={mockTiers} />);
    expect(screen.getByText('Most Popular')).toBeInTheDocument();
  });

  it('renders "Current Plan" badge when currentTier matches', () => {
    render(<PricingTable tiers={mockTiers} currentTier="pro" />);
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
    // "Most Popular" should NOT show when the highlighted tier IS the current one
    expect(screen.queryByText('Most Popular')).not.toBeInTheDocument();
  });

  it('renders CTA links when no onSelectTier', () => {
    render(<PricingTable tiers={mockTiers} />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBe(3);
    expect(links[0]).toHaveAttribute('href', '/signup');
    expect(links[1]).toHaveAttribute('href', '/signup?plan=pro');
  });

  it('renders CTA buttons when onSelectTier is provided', async () => {
    const handleSelect = vi.fn();
    const user = userEvent.setup();
    render(<PricingTable tiers={mockTiers} onSelectTier={handleSelect} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(3);

    await user.click(buttons[1]);
    expect(handleSelect).toHaveBeenCalledWith('pro');
  });

  it('disables the current tier button', () => {
    const handleSelect = vi.fn();
    render(<PricingTable tiers={mockTiers} currentTier="free" onSelectTier={handleSelect} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();
  });

  it('applies custom className', () => {
    const { container } = render(<PricingTable tiers={mockTiers} className="my-custom-class" />);
    expect(container.firstChild).toHaveClass('my-custom-class');
  });
});

// =============================================================================
// Compact Layout
// =============================================================================

describe('PricingTable  -  compact layout', () => {
  it('renders all tiers in compact mode', () => {
    render(<PricingTable tiers={mockTiers} compact />);
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('renders prices in compact cards', () => {
    render(<PricingTable tiers={mockTiers} compact />);
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText('$49')).toBeInTheDocument();
  });

  it('shows "Current" badge for current tier', () => {
    render(<PricingTable tiers={mockTiers} compact currentTier="pro" />);
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('calls onSelectTier when compact button clicked', async () => {
    const handleSelect = vi.fn();
    const user = userEvent.setup();
    render(<PricingTable tiers={mockTiers} compact onSelectTier={handleSelect} />);

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[2]);
    expect(handleSelect).toHaveBeenCalledWith('enterprise');
  });

  it('disables current tier button in compact mode', () => {
    render(
      <PricingTable tiers={mockTiers} compact currentTier="enterprise" onSelectTier={vi.fn()} />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[2]).toBeDisabled();
  });

  it('renders CTA links in compact mode when no onSelectTier', () => {
    render(<PricingTable tiers={mockTiers} compact />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBe(3);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('PricingTable  -  edge cases', () => {
  it('renders with empty tiers array', () => {
    const { container } = render(<PricingTable tiers={[]} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders single tier', () => {
    render(<PricingTable tiers={[mockTiers[0]]} />);
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('handles two tiers with appropriate grid', () => {
    const { container } = render(<PricingTable tiers={mockTiers.slice(0, 2)} />);
    expect(container.firstChild).toHaveClass('lg:grid-cols-2');
  });

  it('renders "-" when price is undefined', () => {
    const tiersWithoutPrice = [
      {
        id: 'free',
        name: 'Free',
        description: 'Free tier',
        features: ['Feature 1'],
        cta: 'Get Started',
        ctaHref: '/start',
        highlighted: false,
      },
    ];
    render(<PricingTable tiers={tiersWithoutPrice} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
