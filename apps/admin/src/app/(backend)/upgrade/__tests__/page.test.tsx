import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLicense = vi.fn();
vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

vi.mock('@/components/TestModeBanner', () => ({
  TestModeBanner: () => <div data-testid="test-mode-banner" />,
}));

vi.mock('@revealui/presentation/client', () => ({
  PricingTable: ({ currentTier }: { currentTier?: string | null }) => (
    <div data-testid="pricing-table" data-current={currentTier ?? ''} />
  ),
}));

vi.mock('@/lib/utils/csrf', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/utils/safe-stripe-redirect', () => ({
  safeStripeRedirect: vi.fn(),
}));

import UpgradePage from '../page';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UpgradePage', () => {
  it('shows plan chooser when a higher commercial tier exists', () => {
    mockUseLicense.mockReturnValue({ tier: 'pro' });
    render(<UpgradePage />);
    expect(screen.getByRole('heading', { name: 'Choose Your Plan' })).toBeInTheDocument();
    expect(screen.getByTestId('pricing-table')).toBeInTheDocument();
    expect(screen.getByText(/Upgrade to unlock more features/)).toBeInTheDocument();
  });

  it('does not upsell when the account is already on enterprise', () => {
    mockUseLicense.mockReturnValue({ tier: 'enterprise' });
    render(<UpgradePage />);
    expect(screen.getByRole('heading', { name: 'Your Plan' })).toBeInTheDocument();
    expect(screen.queryByTestId('pricing-table')).not.toBeInTheDocument();
    expect(
      screen.getByText(/There is no higher commercial plan to upgrade into/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'account billing' })).toHaveAttribute(
      'href',
      '/account/billing',
    );
  });
});
