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

const mockPush = vi.fn();

vi.mock('@revealui/auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'user-1', email: 'owner@example.com' } },
    isLoading: false,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
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

import LicensePage from '../page';

const TEST_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\ntest-pem\n-----END PUBLIC KEY-----';

function jsonResponse(body: unknown): Pick<Response, 'ok' | 'json'> {
  return { ok: true, json: () => Promise.resolve(body) };
}

beforeEach(() => {
  vi.clearAllMocks();
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
  it('renders Pro and Agency Buy, and parks Enterprise Perpetual at Contact sales', async () => {
    render(<LicensePage />);

    await waitFor(() => {
      expect(screen.getByText('test-license-jwt')).toBeDefined();
    });

    expect(screen.getByText('Pro Perpetual')).toBeDefined();
    expect(screen.getByText('Agency Perpetual')).toBeDefined();
    expect(screen.getByText('Enterprise Perpetual')).toBeDefined();
    expect(screen.queryByText('Max Perpetual')).toBeNull();
    expect(
      screen.getByText(
        'Enterprise license plus studio onboarding. Not an unattended Fleet pull-and-run kit. Includes 1 year of support.',
      ),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Max features forever, up to 10 client deployments. License plus a thin kit, not an unattended RevForge Fleet stamp. Includes 1 year of support.',
      ),
    ).toBeDefined();
    const sales = screen.getByRole('link', { name: 'Contact sales' });
    expect(sales).toHaveAttribute('href', 'https://revealui.com/contact');
    expect(screen.queryByRole('button', { name: /Buy/ })).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Buy \$42/ })).toBeNull();
  });
});
