import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseLicense = vi.fn();
vi.mock('@/lib/providers/LicenseProvider', () => ({
  useLicense: () => mockUseLicense(),
}));

vi.mock('@/components/TestModeBanner', () => ({
  TestModeBanner: () => <div data-testid="test-mode-banner" />,
}));

vi.mock('@revealui/presentation/client', () => ({
  PricingTable: ({
    tiers,
    onSelectTier,
  }: {
    tiers: Array<{ id: string; name: string; price?: string; period?: string; cta: string }>;
    currentTier?: string | null;
    onSelectTier?: (id: string) => void;
  }) => (
    <div data-testid="pricing-table">
      {tiers.map((tier) => (
        <article key={tier.id} data-testid={`tier-${tier.id}`}>
          <h3>{tier.name}</h3>
          <p>
            {tier.price ?? '-'}
            {tier.period ?? ''}
          </p>
          <button type="button" onClick={() => onSelectTier?.(tier.id)}>
            {tier.cta}
          </button>
        </article>
      ))}
    </div>
  ),
}));

const mockApiFetch = vi.fn();
vi.mock('@/lib/utils/csrf', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const mockSafeStripeRedirect = vi.fn();
vi.mock('@/lib/utils/safe-stripe-redirect', () => ({
  safeStripeRedirect: (url: string) => mockSafeStripeRedirect(url),
}));

import UpgradePage from '../page';

const STRIPE_CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_pro_trial';

function mockPublicFetches(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'user-1' }) });
      }
      if (url.includes('/api/pricing')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              subscriptions: [
                { id: 'pro', price: '$49', period: '/mo' },
                { id: 'max', price: '$299', period: '/mo' },
                { id: 'enterprise', price: '$1,499', period: '/mo' },
              ],
            }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPublicFetches();
  mockApiFetch.mockResolvedValue({
    status: 200,
    json: () => Promise.resolve({ url: STRIPE_CHECKOUT_URL }),
  });
});

describe('UpgradePage', () => {
  it('shows plan chooser when a higher commercial tier exists', () => {
    mockUseLicense.mockReturnValue({ tier: 'pro' });
    render(<UpgradePage />);
    expect(screen.getByRole('heading', { name: 'Choose Your Plan' })).toBeInTheDocument();
    expect(screen.getByTestId('pricing-table')).toBeInTheDocument();
    expect(screen.getByText(/Upgrade to unlock more features/)).toBeInTheDocument();
  });

  it('does not advertise leftover Free agent-task quotas', () => {
    mockUseLicense.mockReturnValue({ tier: 'free' });
    render(<UpgradePage />);
    const agentTasksRow = screen.getByText('Agent Tasks/mo').closest('tr');
    expect(agentTasksRow).toBeTruthy();
    expect(agentTasksRow?.textContent).not.toMatch(/1,000/);
    expect(agentTasksRow?.textContent).toMatch(/Not included/);
  });

  it('renders the honest Pro license price ($49/mo) from the licenses catalog', async () => {
    mockUseLicense.mockReturnValue({ tier: 'free' });
    render(<UpgradePage />);
    const proCard = screen.getByTestId('tier-pro');
    expect(proCard).toHaveTextContent('$49');
    expect(proCard).toHaveTextContent('/mo');
    expect(proCard).not.toHaveTextContent(/^-$/);
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/pricing'));
    });
    expect(proCard).toHaveTextContent('$49/mo');
  });

  it('still shows Pro $49/mo when the licenses catalog fetch fails', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('catalog offline'))),
    );
    mockUseLicense.mockReturnValue({ tier: 'free' });
    render(<UpgradePage />);
    expect(screen.getByTestId('tier-pro')).toHaveTextContent('$49/mo');
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

  it('first-click Pro trial CTA creates a Stripe Checkout session URL', async () => {
    mockUseLicense.mockReturnValue({ tier: 'free' });
    render(<UpgradePage />);

    const proCta = within(screen.getByTestId('tier-pro')).getByRole('button', {
      name: 'Start your 7-day free trial',
    });
    await act(async () => {
      fireEvent.click(proCta);
    });

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/billing/checkout'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    const [, init] = mockApiFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { tier?: string; priceId?: string };
    expect(body.tier).toBe('pro');
    expect(body).not.toHaveProperty('priceId');
    expect(String(mockApiFetch.mock.calls[0]?.[0])).not.toContain('/api/checkout');
    expect(String(mockApiFetch.mock.calls[0]?.[0])).not.toContain('/api/billing/session');
    expect(mockSafeStripeRedirect).toHaveBeenCalledWith(STRIPE_CHECKOUT_URL);
    expect(new URL(STRIPE_CHECKOUT_URL).hostname).toBe('checkout.stripe.com');
  });

  it('omits a baked-in NEXT_PUBLIC price id so checkout uses the server catalog', async () => {
    const previous = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;
    process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID = 'price_wrong_client_bake';
    mockUseLicense.mockReturnValue({ tier: 'free' });
    render(<UpgradePage />);

    const proCta = within(screen.getByTestId('tier-pro')).getByRole('button', {
      name: 'Start your 7-day free trial',
    });
    await act(async () => {
      fireEvent.click(proCta);
    });

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled();
    });

    const [, init] = mockApiFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as { tier?: string; priceId?: string };
    expect(body).toEqual({ tier: 'pro' });
    expect(body.priceId).toBeUndefined();
    expect(mockSafeStripeRedirect).toHaveBeenCalledWith(STRIPE_CHECKOUT_URL);
    expect(new URL(STRIPE_CHECKOUT_URL).hostname).toBe('checkout.stripe.com');

    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;
    } else {
      process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID = previous;
    }
  });
});
