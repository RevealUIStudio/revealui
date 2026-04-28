import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock useLicense provider
const mockUseLicense = vi.fn();
vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

// Mock @revealui/contracts/pricing
vi.mock('@revealui/contracts/pricing', () => ({
  getTiersFromCurrent: vi.fn(() => [
    { id: 'pro', name: 'Pro', price: '$49/mo' },
    { id: 'max', name: 'Max', price: '$149/mo' },
  ]),
}));

// Mock presentation components
vi.mock('@revealui/presentation/client', () => ({
  Dialog: ({
    open,
    onClose,
    children,
  }: {
    open: boolean;
    onClose: () => void;
    size?: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <div data-testid="dialog" data-open={open}>
        <button type="button" data-testid="dialog-backdrop" onClick={onClose} />
        {children}
      </div>
    ) : null,
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-body">{children}</div>
  ),
  DialogActions: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-actions">{children}</div>
  ),
}));

vi.mock('@revealui/presentation/server', () => ({
  PricingTable: ({
    currentTier,
    onSelectTier,
  }: {
    tiers: unknown[];
    currentTier: string;
    compact?: boolean;
    onSelectTier: (id: string) => void;
  }) => (
    <div data-testid="pricing-table" data-current={currentTier}>
      <button type="button" data-testid="select-pro" onClick={() => onSelectTier('pro')}>
        Select Pro
      </button>
      <button type="button" data-testid="select-max" onClick={() => onSelectTier('max')}>
        Select Max
      </button>
    </div>
  ),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

import { UpgradeDialog } from '../UpgradeDialog';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLicense.mockReturnValue({ tier: 'free' });
});

describe('UpgradeDialog', () => {
  async function dispatchUpgradeRequired(detail: { feature?: string } = {}) {
    await act(async () => {
      window.dispatchEvent(new CustomEvent('revealui:upgrade-required', { detail }));
    });
  }

  it('does not render dialog initially (closed by default)', () => {
    render(<UpgradeDialog />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('opens when revealui:upgrade-required event is dispatched', async () => {
    render(<UpgradeDialog />);
    await dispatchUpgradeRequired();
    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });
    expect(screen.getByText('Upgrade Your Plan')).toBeInTheDocument();
  });

  it('shows generic description when no feature name is provided', async () => {
    render(<UpgradeDialog />);
    await dispatchUpgradeRequired();
    await waitFor(() => {
      expect(screen.getByTestId('dialog-description')).toHaveTextContent(
        'Unlock more features by upgrading your plan.',
      );
    });
  });

  it('shows feature-specific description when feature name is provided', async () => {
    render(<UpgradeDialog />);
    await dispatchUpgradeRequired({ feature: 'AI Agents' });
    await waitFor(() => {
      expect(screen.getByTestId('dialog-description')).toHaveTextContent(
        '"AI Agents" requires a higher tier.',
      );
    });
  });

  it('closes when "Maybe later" button is clicked', async () => {
    render(<UpgradeDialog />);
    await dispatchUpgradeRequired();
    await waitFor(() => {
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Maybe later'));
    });
    await waitFor(() => {
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });
  });

  it('renders PricingTable with current tier', async () => {
    mockUseLicense.mockReturnValue({ tier: 'pro' });
    render(<UpgradeDialog />);
    await dispatchUpgradeRequired();
    await waitFor(() => {
      expect(screen.getByTestId('pricing-table')).toHaveAttribute('data-current', 'pro');
    });
  });

  it('defaults tier to free when license tier is null', async () => {
    mockUseLicense.mockReturnValue({ tier: null });
    render(<UpgradeDialog />);
    await dispatchUpgradeRequired();
    await waitFor(() => {
      expect(screen.getByTestId('pricing-table')).toHaveAttribute('data-current', 'free');
    });
  });

  it('contains a link to full pricing page', async () => {
    render(<UpgradeDialog />);
    await dispatchUpgradeRequired();
    await waitFor(() => {
      const link = screen.getByText('View full pricing');
      expect(link).toHaveAttribute('href', '/upgrade');
    });
  });

  it('calls fetch with checkout endpoint when tier is selected', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/test' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<UpgradeDialog />);
    await dispatchUpgradeRequired();
    await waitFor(() => {
      expect(screen.getByTestId('select-pro')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-pro'));
    });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/billing/checkout'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    vi.unstubAllGlobals();
  });

  it('cleans up event listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<UpgradeDialog />);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('revealui:upgrade-required', expect.any(Function));
    removeSpy.mockRestore();
  });
});
