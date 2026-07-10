import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseSession = vi.fn();
vi.mock('@revealui/auth/react', () => ({
  useSession: () => mockUseSession(),
}));

const mockPush = vi.fn();
let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => searchParams,
}));

vi.mock('@/components/TestModeBanner', () => ({
  TestModeBanner: () => null,
}));

vi.mock('@/lib/utils/csrf', () => ({
  apiFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}));

const mockSafeStripeRedirect = vi.fn();
vi.mock('@/lib/utils/safe-stripe-redirect', () => ({
  safeStripeRedirect: (url: string) => mockSafeStripeRedirect(url),
}));

import BillingPage from '../page';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
  mockUseSession.mockReturnValue({ data: { user: { id: 'u1' } }, isLoading: false });
});

describe('BillingPage checkout hardening', () => {
  it('retries the subscription fetch once before giving up', async () => {
    let subscriptionCalls = 0;
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/billing/subscription')) {
        subscriptionCalls += 1;
        if (subscriptionCalls === 1) return Promise.reject(new Error('network down'));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ tier: 'pro', status: 'active', expiresAt: null }),
        } as Response);
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(subscriptionCalls).toBe(2);
    });
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/could not load your subscription/)).not.toBeInTheDocument();
  });

  it('never auto-fires checkout when subscription data never loaded', async () => {
    searchParams = new URLSearchParams('upgrade=pro');
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')));

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText(/could not load your subscription/)).toBeInTheDocument();
    });
    expect(mockSafeStripeRedirect).not.toHaveBeenCalled();
  });

  it('shows a manual "Continue to checkout" fallback after both attempts fail with an upgrade param', async () => {
    searchParams = new URLSearchParams('upgrade=max');
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')));

    render(<BillingPage />);

    const button = await screen.findByRole('button', { name: 'Continue to checkout' });

    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/billing/checkout')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url: 'https://checkout.stripe.com/session/abc' }),
        } as Response);
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSafeStripeRedirect).toHaveBeenCalledWith(
        'https://checkout.stripe.com/session/abc',
      );
    });
  });

  it('does not render the fallback button without an upgrade param', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')));

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Continue to checkout' })).not.toBeInTheDocument();
  });
});
