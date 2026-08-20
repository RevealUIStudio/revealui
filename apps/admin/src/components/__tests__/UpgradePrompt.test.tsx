import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLicense = vi.fn();
vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

vi.mock('@revealui/contracts/pricing', () => ({
  FEATURE_LABELS: { ai: 'AI' },
  TIER_LABELS: { pro: 'Pro', max: 'Max', enterprise: 'Enterprise' },
  getTiersFromCurrent: (tier: string) => (tier === 'enterprise' ? [] : [{ id: 'pro' }]),
  ENTERPRISE_SALES_HREF: 'https://revealui.com/contact',
  allowsUnattendedCheckout: (tier: string) => tier === 'pro' || tier === 'max',
}));

vi.mock('@revealui/core/features', () => ({
  getRequiredTier: () => 'pro',
}));

vi.mock('@revealui/presentation/server', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    appearance?: string;
    variant?: string;
    size?: string;
  }) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  PricingTable: () => <div data-testid="pricing-table">plans</div>,
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { UpgradePrompt } from '../UpgradePrompt';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UpgradePrompt', () => {
  it('offers a buy path when a higher commercial tier exists', () => {
    mockUseLicense.mockReturnValue({
      tier: 'free',
      isLoading: false,
      resolveError: null,
    });
    render(<UpgradePrompt feature="ai" />);
    expect(screen.getByRole('link', { name: /upgrade to/i })).toHaveAttribute(
      'href',
      '/account/billing?upgrade=pro',
    );
    expect(screen.getByTestId('pricing-table')).toBeInTheDocument();
  });

  it('hides buy chrome on enterprise', () => {
    mockUseLicense.mockReturnValue({
      tier: 'enterprise',
      isLoading: false,
      resolveError: null,
    });
    render(<UpgradePrompt feature="ai" />);
    expect(screen.queryByRole('link', { name: /upgrade/i })).toBeNull();
    expect(screen.queryByTestId('pricing-table')).toBeNull();
    expect(screen.getByText(/highest commercial tier/i)).toBeInTheDocument();
    expect(screen.getByText(/no founder bypass/i)).toBeInTheDocument();
  });

  it('hides the sampling upgrade button on enterprise', () => {
    mockUseLicense.mockReturnValue({
      tier: 'enterprise',
      isLoading: false,
      resolveError: null,
    });
    render(<UpgradePrompt feature="ai" variant="sampling" />);
    expect(screen.queryByRole('link', { name: /upgrade to pro/i })).toBeNull();
    expect(screen.getByText(/no buy path above this tier/i)).toBeInTheDocument();
  });
});
