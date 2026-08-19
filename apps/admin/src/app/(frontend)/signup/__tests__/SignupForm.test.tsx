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
// Set per-test to simulate the ?plan= deep link from the marketing pricing cards.
let mockPlanParam: string | null = null;

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
    get: (key: string) => (key === 'plan' ? mockPlanParam : null),
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
  set('#password', 'Password123');
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
