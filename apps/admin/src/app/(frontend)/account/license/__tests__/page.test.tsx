/**
 * Tests for the account license page's activation instructions.
 *
 * The critical behavior: the daemon activation block must name the env var the
 * RevDev daemon actually reads — REVEALUI_LICENSE_KEY (one key, one var, both
 * products). The page previously instructed REVDEV_LICENSE_KEY, which nothing
 * reads: a buyer following that copy sets a dead var and the daemon silently
 * runs as Free. The no-REVDEV_LICENSE_KEY assertion is the regression guard.
 * (REVDEV_LICENSE_PUBLIC_KEY in the daemon-public-key block is a real,
 * distinct daemon var and intentionally unaffected.)
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sessionState = vi.hoisted(() => ({
  data: { user: { id: 'user-1', email: 'owner@example.com' } } as {
    user: { id: string; email: string };
  } | null,
  isLoading: false,
}));

const mockPush = vi.fn();
const mockRouter = { push: mockPush };
let mockLicenseParam: string | null = null;

vi.mock('@revealui/auth/react', () => ({
  useSession: () => ({
    data: sessionState.data,
    isLoading: sessionState.isLoading,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => ({
    get: (key: string) => (key === 'license' ? mockLicenseParam : null),
  }),
}));

vi.mock('next/link', () => ({
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock('@revealui/presentation/server', () => ({
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  Card: ({ children }: any) => <section>{children}</section>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  CardContent: ({ children }: any) => <div>{children}</div>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  CardDescription: ({ children }: any) => <p>{children}</p>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  CardHeader: ({ children }: any) => <div>{children}</div>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  CardTitle: ({ children }: any) => <h2>{children}</h2>,
}));

vi.mock('@/lib/utils/csrf', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/utils/safe-stripe-redirect', () => ({
  safeStripeRedirect: vi.fn(),
}));

import { apiFetch } from '@/lib/utils/csrf';
import { safeStripeRedirect } from '@/lib/utils/safe-stripe-redirect';
import LicensePage from '../page';

const TEST_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\ntest-pem\n-----END PUBLIC KEY-----';

function jsonResponse(body: unknown): Pick<Response, 'ok' | 'json'> {
  return { ok: true, json: () => Promise.resolve(body) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLicenseParam = null;
  sessionState.data = { user: { id: 'user-1', email: 'owner@example.com' } };
  sessionState.isLoading = false;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/billing/subscription')) {
        return Promise.resolve(
          jsonResponse({
            tier: 'pro',
            status: 'active',
            expiresAt: null,
            licenseKey: 'test-license-jwt',
            perpetual: false,
            supportExpiresAt: null,
          }),
        );
      }
      if (url.endsWith('/api/license/public-key')) {
        return Promise.resolve(jsonResponse({ publicKey: TEST_PUBLIC_KEY }));
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('LicensePage activation instructions', () => {
  it('instructs REVEALUI_LICENSE_KEY for both the framework and the daemon', async () => {
    render(<LicensePage />);

    await waitFor(() => {
      expect(screen.getByText('test-license-jwt')).toBeDefined();
    });

    // Daemon block is present and names the var the daemon actually reads —
    // one snippet for the framework .env, one for the daemon.
    expect(document.body.textContent ?? '').toContain('The same key activates the RevDev daemon');
    expect(screen.getAllByText('REVEALUI_LICENSE_KEY')).toHaveLength(1);
    expect(screen.getAllByText('REVEALUI_LICENSE_KEY=your-key-here')).toHaveLength(2);
  });

  it('renders no REVDEV_LICENSE_KEY anywhere (the daemon never reads it)', async () => {
    render(<LicensePage />);

    await waitFor(() => {
      expect(screen.getByText('test-license-jwt')).toBeDefined();
    });

    // The daemon-public-key block must still render (its REVDEV_LICENSE_PUBLIC_KEY
    // is a real var and must not be caught by the regression check below).
    expect(screen.getByText('REVDEV_LICENSE_PUBLIC_KEY')).toBeDefined();

    expect(document.body.textContent ?? '').not.toContain('REVDEV_LICENSE_KEY');
  });
});

// GAP-306: the perpetual-purchase labels must match PERPETUAL_TIERS[*].name
// in @revealui/contracts/pricing exactly (the price lookup keys off it).
// Enterprise is Contact sales — same door as public pricing — not a Buy.
describe('LicensePage perpetual purchase plans', () => {
  it('renders Pro Perpetual as the only buyable leftover-admin SKU', async () => {
    render(<LicensePage />);

    await waitFor(() => {
      expect(screen.getByText('test-license-jwt')).toBeDefined();
    });

    expect(screen.getByText('Pro Perpetual')).toBeDefined();
    expect(screen.queryByText('Agency Perpetual')).toBeNull();
    expect(screen.queryByText('Enterprise Perpetual')).toBeNull();
    expect(screen.queryByText('Max Perpetual')).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Buy / })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Buy \$42/ })).toBeNull();
  });

  it('names the SKU and auto-starts Pro Perpetual checkout from ?license=pro', async () => {
    mockLicenseParam = 'pro';
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/c/pay/cs_test_pro' }),
    } as never);

    render(<LicensePage />);

    await waitFor(() => {
      expect(screen.getByText('Continuing Pro Perpetual checkout.')).toBeDefined();
    });
    await waitFor(() => {
      expect(safeStripeRedirect).toHaveBeenCalledWith(
        'https://checkout.stripe.com/c/pay/cs_test_pro',
      );
    });
  });
});

describe('LicensePage session miss', () => {
  it('does not router.push /login when useSession is empty', async () => {
    sessionState.data = null;

    render(<LicensePage />);

    await waitFor(() => {
      expect(screen.getByText('test-license-jwt')).toBeDefined();
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith('/login?redirect=/account/license');
    expect(mockPush).not.toHaveBeenCalledWith('/');
  });

  it('stays on the page with a failed-to-load state when useSession is empty and license fetch fails', async () => {
    sessionState.data = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })),
    );

    render(<LicensePage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeDefined();
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByText('test-license-jwt')).toBeNull();
  });

  it('names the perpetual SKU on a session-miss with ?license=pro and does not push /login', async () => {
    mockLicenseParam = 'pro';
    sessionState.data = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })),
    );

    render(<LicensePage />);

    await waitFor(() => {
      expect(screen.getByText('Continuing Pro Perpetual checkout.')).toBeDefined();
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith('/login?redirect=/account/license');
  });

  it('shows an honest empty state when the subscription has no license key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/billing/subscription')) {
          return Promise.resolve(
            jsonResponse({
              tier: 'pro',
              status: 'active',
              expiresAt: null,
              licenseKey: null,
              perpetual: false,
              supportExpiresAt: null,
            }),
          );
        }
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      }),
    );

    render(<LicensePage />);

    await waitFor(() => {
      expect(screen.getByText('No license key is on this account yet.')).toBeDefined();
    });
    expect(screen.queryByText('test-license-jwt')).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('LicensePage same-origin billing proxy', () => {
  const stagingApi = 'https://api.staging.revealui.com';

  it('fetches subscription on /api/billing/subscription, not the API host', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', stagingApi);

    render(<LicensePage />);

    await waitFor(() => {
      expect(screen.getByText('test-license-jwt')).toBeDefined();
    });

    const urls = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    expect(urls).toContain('/api/billing/subscription');
    expect(
      urls.some(
        (url) => url.startsWith(`${stagingApi}/`) && url.endsWith('/api/billing/subscription'),
      ),
    ).toBe(false);
  });

  it('posts perpetual checkout to same-origin /api/billing/checkout-perpetual', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', stagingApi);
    vi.mocked(apiFetch).mockResolvedValue({
      json: () => Promise.resolve({ url: 'https://checkout.stripe.com/c/test' }),
    } as Response);

    render(<LicensePage />);

    await waitFor(() => {
      expect(screen.getByText('test-license-jwt')).toBeDefined();
    });

    screen.getAllByRole('button', { name: /^Buy / })[0]?.click();

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/billing/checkout-perpetual',
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      );
    });
    const checkoutUrl = String(vi.mocked(apiFetch).mock.calls[0]?.[0]);
    expect(checkoutUrl.startsWith(stagingApi)).toBe(false);
  });
});
