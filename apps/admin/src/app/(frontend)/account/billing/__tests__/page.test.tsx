import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseSession = vi.fn();
vi.mock('@revealui/auth/react', () => ({
  useSession: () => mockUseSession(),
}));

const mockPush = vi.fn();
// Stable reference, matching real next/navigation useRouter(). A fresh object
// per render would make effects that list `router` in their deps re-fire on
// every re-render, which does not happen in production.
const mockRouter = { push: mockPush };
let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
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

const mockLoggerError = vi.fn();
vi.mock('@revealui/utils/logger', () => ({
  logger: { error: (...args: unknown[]) => mockLoggerError(...args) },
}));

import BillingPage from '../page';

const TRIAL_END = '2026-08-27T00:00:00.000Z';

function mockBillingFetches(subscription: {
  tier: string;
  status: string;
  expiresAt: string | null;
}): void {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/billing/subscription')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(subscription),
      } as Response);
    }
    if (url.includes('/api/pricing')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            subscriptions: [
              { id: 'pro', price: '$49', period: '/mo' },
              { id: 'max', price: '$99', period: '/mo' },
            ],
          }),
      } as Response);
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
  });
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
  mockUseSession.mockReturnValue({ data: { user: { id: 'u1' } }, isLoading: false });
});

describe('BillingPage checkout hardening', () => {
  it('retries the subscription fetch after a transient failure', async () => {
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
    expect(screen.queryByText(/could not load your subscription/i)).not.toBeInTheDocument();
  });

  it('bounds the retry at three attempts and logs the persistent failure', async () => {
    searchParams = new URLSearchParams('upgrade=pro');
    let subscriptionCalls = 0;
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      if (String(input).includes('/api/billing/subscription')) {
        subscriptionCalls += 1;
      }
      return Promise.reject(new Error('network down'));
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText(/could not load your subscription/i)).toBeInTheDocument();
    });
    expect(subscriptionCalls).toBe(3);
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Billing subscription fetch failed after retries',
      expect.objectContaining({ attempts: 3, plan: 'pro' }),
    );
  });

  it('never auto-fires checkout when subscription data never loaded', async () => {
    searchParams = new URLSearchParams('upgrade=pro');
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')));

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText(/could not load your subscription/i)).toBeInTheDocument();
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
    const checkoutCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find((call) =>
      String(call[0]).includes('/api/billing/checkout'),
    );
    expect(checkoutCall).toBeDefined();
    if (!checkoutCall) throw new Error('expected checkout POST');
    const body = JSON.parse(String((checkoutCall[1] as RequestInit).body)) as {
      tier?: string;
      priceId?: string;
    };
    expect(body).toEqual({ tier: 'max' });
    expect(body.priceId).toBeUndefined();
    expect(new URL('https://checkout.stripe.com/session/abc').hostname).toBe('checkout.stripe.com');
  });

  it('parks ?upgrade=enterprise at Contact sales instead of Stripe checkout', async () => {
    searchParams = new URLSearchParams('upgrade=enterprise');
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/billing/subscription')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ tier: 'free', status: 'active', expiresAt: null }),
        } as Response);
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) } as Response);
    });

    render(<BillingPage />);

    const sales = await screen.findByRole('link', { name: 'Contact sales' });
    expect(sales).toHaveAttribute('href', 'https://revealui.com/contact');
    expect(mockSafeStripeRedirect).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Continue to checkout' })).not.toBeInTheDocument();
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

describe('BillingPage first-week trial UX', () => {
  it('shows Max trial expiry and Max plan, not Pro', async () => {
    mockBillingFetches({
      tier: 'max',
      status: 'trialing',
      expiresAt: TRIAL_END,
    });

    render(<BillingPage />);

    expect(await screen.findByText(/Your Max trial ends on August 27, 2026/)).toBeInTheDocument();
    expect(screen.getByText('Max')).toBeInTheDocument();
    expect(screen.getByText('Expires')).toBeInTheDocument();
    expect(screen.queryByText(/Your Pro trial ends/)).not.toBeInTheDocument();
    expect(screen.getByText(/you'll be charged \$99\/mo/i)).toBeInTheDocument();
  });

  it('shows Pro trial expiry with the Pro price', async () => {
    mockBillingFetches({
      tier: 'pro',
      status: 'trialing',
      expiresAt: TRIAL_END,
    });

    render(<BillingPage />);

    expect(await screen.findByText(/Your Pro trial ends on August 27, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/you'll be charged \$49\/mo/i)).toBeInTheDocument();
    expect(screen.queryByText(/Your Max trial ends/)).not.toBeInTheDocument();
  });

  it('hides the trial callout when expiresAt is missing', async () => {
    mockBillingFetches({
      tier: 'max',
      status: 'trialing',
      expiresAt: null,
    });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Current Plan')).toBeInTheDocument();
    });
    expect(screen.queryByText(/trial ends on/i)).not.toBeInTheDocument();
  });
});

describe('BillingPage session miss', () => {
  it('does not router.push /login when useSession is empty', async () => {
    mockUseSession.mockReturnValue({ data: null, isLoading: false });
    mockBillingFetches({ tier: 'pro', status: 'active', expiresAt: null });

    render(<BillingPage />);

    await waitFor(() => {
      expect(screen.getByText('Current Plan')).toBeInTheDocument();
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith('/login?redirect=/account/billing');
    expect(mockPush).not.toHaveBeenCalledWith('/');
  });
});
