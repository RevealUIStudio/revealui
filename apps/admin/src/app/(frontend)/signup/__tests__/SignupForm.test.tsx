/**
 * Tests for SignupForm's post-signup routing.
 *
 * The critical behavior: a NEW unverified user must NOT be pushed to a
 * protected route (which would bounce to /login) — they see a "Check your
 * inbox" confirmation instead. Only the auto-verified first user is sent in,
 * via a full document navigation (navigateAfterAuthChange), never a soft
 * router.push (see LoginForm.test.tsx for the stale-cache rationale).
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSignUp = vi.fn();
const mockPush = vi.fn();
const mockNavigate = vi.fn();
// Set per-test to simulate the ?plan= / ?license= deep links from marketing.
let mockPlanParam: string | null = null;
let mockLicenseParam: string | null = null;

vi.mock('@revealui/auth/react', () => ({
  useSignUp: () => ({ signUp: mockSignUp, isLoading: false }),
  usePasskeyRegister: () => ({
    register: vi.fn(),
    isLoading: false,
    error: null,
    supported: false,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({
    get: (key: string) => {
      if (key === 'plan') return mockPlanParam;
      if (key === 'license') return mockLicenseParam;
      return null;
    },
  }),
}));

vi.mock('@/lib/utils/auth-navigation', () => ({
  navigateAfterAuthChange: (path: string) => mockNavigate(path),
}));

vi.mock('@revealui/presentation/server', () => ({
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  FormLabel: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  Heading: ({ children }: any) => <h2>{children}</h2>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  InputCVA: (props: any) => <input {...props} />,
  PasskeyIcon: () => <svg aria-hidden="true" />,
}));

vi.mock('@/lib/components/PasswordInput', () => ({
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  PasswordInput: ({ children }: any) => <div>{children}</div>,
}));

import { SignupForm } from '../SignupForm';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPlanParam = null;
  mockLicenseParam = null;
  // GDPR consent grant is fire-and-forget; stub fetch so jsdom doesn't throw.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});

function fillAndSubmit(): void {
  const set = (selector: string, value: string) => {
    const el = document.querySelector(selector);
    if (el) fireEvent.change(el, { target: { value } });
  };
  set('#name', 'Ada Lovelace');
  set('#email', 'ada@example.com');
  set('#password', 'Password1234');
  const tos = document.querySelector('#tos');
  if (tos) fireEvent.click(tos);
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('SignupForm post-signup routing', () => {
  it('shows a verify-your-email screen (no redirect) when the new user is unverified', async () => {
    mockSignUp.mockResolvedValue({
      success: true,
      user: { id: '1', email: 'ada@example.com', emailVerified: false },
    });

    render(<SignupForm apiUrl="http://api.test" />);
    fillAndSubmit();

    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('sends an auto-verified (first) free-tier user to /welcome, not the cold dashboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { emailVerified: true } }) })
        .mockResolvedValue({ ok: true, json: async () => ({}) }),
    );

    render(<SignupForm apiUrl="http://api.test" />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/welcome');
    });
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByText('Check your inbox')).not.toBeInTheDocument();
  });

  it.each(['pro', 'max'] as const)(
    'routes an auto-verified user with ?plan=%s into the billing upgrade flow',
    async (plan) => {
      mockPlanParam = plan;
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ user: { emailVerified: true } }),
          })
          .mockResolvedValue({ ok: true, json: async () => ({}) }),
      );

      render(<SignupForm apiUrl="http://api.test" />);
      expect(
        screen.getByText(
          `Sign up to start your free 7-day ${plan === 'pro' ? 'Pro' : 'Max'} trial.`,
        ),
      ).toBeInTheDocument();
      fillAndSubmit();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(`/account/billing?upgrade=${plan}`);
      });
      expect(mockPush).not.toHaveBeenCalled();
    },
  );

  it('accepts ?plan=enterprise without promising a trial or billing upgrade', async () => {
    mockPlanParam = 'enterprise';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: { emailVerified: true } }),
        })
        .mockResolvedValue({ ok: true, json: async () => ({}) }),
    );

    render(<SignupForm apiUrl="http://api.test" />);
    expect(
      screen.queryByText('Sign up to start your free 7-day Enterprise trial.'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Enterprise is sold through sales, not a 7-day trial.'),
    ).toBeInTheDocument();
    fillAndSubmit();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/welcome');
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/account/billing?upgrade=enterprise');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('routes an auto-verified user with ?license=pro into perpetual license checkout', async () => {
    mockLicenseParam = 'pro';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: { emailVerified: true } }),
        })
        .mockResolvedValue({ ok: true, json: async () => ({}) }),
    );

    render(<SignupForm apiUrl="http://api.test" />);
    expect(screen.getByText('Sign up to buy Pro Perpetual.', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?license=pro',
    );
    fillAndSubmit();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/account/license?license=pro');
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/account/billing?upgrade=pro');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it.each(['agency', 'enterprise'] as const)(
    'does not treat leftover ?license=%s as a buy hop',
    async (sku) => {
      mockLicenseParam = sku;
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ user: { emailVerified: true } }),
          })
          .mockResolvedValue({ ok: true, json: async () => ({}) }),
      );

      render(<SignupForm apiUrl="http://api.test" />);
      expect(screen.queryByText(/Sign up to buy Agency Perpetual/)).toBeNull();
      expect(screen.queryByText(/Sign up to buy Enterprise Perpetual/)).toBeNull();
      fillAndSubmit();

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/welcome');
      });
      expect(mockNavigate).not.toHaveBeenCalledWith(`/account/license?license=${sku}`);
    },
  );

  it('ignores an unknown ?plan= value and routes to /welcome as a free-tier signup', async () => {
    mockPlanParam = 'enterprise-deluxe';
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ user: { emailVerified: true } }) })
        .mockResolvedValue({ ok: true, json: async () => ({}) }),
    );

    render(<SignupForm apiUrl="http://api.test" />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/welcome');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('SignupForm error surface', () => {
  it('shows the human API message, not the SIGNUP_FAILED code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'SIGNUP_FAILED',
          message: 'Unable to create account',
          code: 'SIGNUP_FAILED',
        }),
      }),
    );

    render(<SignupForm apiUrl="http://api.test" />);
    fillAndSubmit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to create account');
    expect(alert).not.toHaveTextContent('SIGNUP_FAILED');
  });

  it('falls back to a generic message when the API omits both message and error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      }),
    );

    render(<SignupForm apiUrl="http://api.test" />);
    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to create account');
  });
});

describe('SignupForm password requirements', () => {
  it('states the 12-character minimum the sign-up contract enforces', () => {
    render(<SignupForm apiUrl="http://api.test" />);

    expect(
      screen.getByText('Min 12 characters, uppercase, lowercase, and a number'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Min 8 characters, uppercase, lowercase, and a number'),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('minLength', '12');
  });
});
