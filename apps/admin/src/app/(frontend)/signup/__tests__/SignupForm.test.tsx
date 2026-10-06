/**
 * Tests for SignupForm's post-signup routing.
 *
 * The critical behavior: a NEW unverified user must NOT be pushed to a
 * protected route (which would bounce to /login). They see a "Check your
 * inbox" confirmation instead. Only the auto-verified first user is sent in,
 * via a full document navigation (navigateAfterAuthChange), never a soft
 * router.push (see LoginForm.test.tsx for the stale-cache rationale).
 */

import {
  SIGNUP_PASSWORD_MIN_LENGTH,
  SignUpRequestSchema,
  signupPasswordChecklist,
} from '@revealui/contracts/api/auth';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { messageForPath } from '@/lib/utils/auth-field-errors';

function signUpFieldMessage(
  data: { email: string; password: string; name: string },
  field: 'email' | 'name',
): string {
  const result = SignUpRequestSchema.safeParse({ ...data, tosAccepted: true });
  if (result.success) throw new Error('expected the sign-up schema to reject this value');
  const message = messageForPath(result.error.issues, field);
  if (!message) throw new Error(`missing ${field} issue`);
  return message;
}

const mockSignUp = vi.fn();
const mockPush = vi.fn();
const mockNavigate = vi.fn();
// Set per-test to simulate the ?plan= / ?license= deep links from marketing.
let mockPlanParam: string | null = null;
let mockLicenseParam: string | null = null;
let mockRedirectParam: string | null = null;
let mockUpgradeParam: string | null = null;

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
      if (key === 'redirect') return mockRedirectParam;
      if (key === 'upgrade') return mockUpgradeParam;
      return null;
    },
  }),
}));

vi.mock('@/lib/utils/auth-navigation', () => ({
  navigateAfterAuthChange: (path: string) => mockNavigate(path),
}));

vi.mock('@revealui/presentation/server', async () => {
  const { FormField } = await import(
    '../../../../../../../packages/presentation/src/components/form-field.tsx'
  );
  return {
    FormField,
    // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
    FormLabel: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
    // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
    Heading: ({ children }: any) => <h2>{children}</h2>,
    // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
    InputCVA: (props: any) => <input {...props} />,
    PasskeyIcon: () => <svg aria-hidden="true" />,
    IconEye: () => <svg aria-hidden="true" />,
    IconEyeOff: () => <svg aria-hidden="true" />,
  };
});

vi.mock('@revealui/presentation/client', async () => {
  const checkbox = await import(
    '../../../../../../../packages/presentation/src/components/Checkbox.tsx'
  );
  return { CheckboxCVA: checkbox.Checkbox };
});

import { SignupForm } from '../SignupForm';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPlanParam = null;
  mockLicenseParam = null;
  mockRedirectParam = null;
  mockUpgradeParam = null;
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
  it('shows a live checklist taken from the sign-up validator, not an 8 character floor', () => {
    render(<SignupForm apiUrl="http://api.test" />);

    for (const item of signupPasswordChecklist('')) {
      const row = screen
        .getAllByRole('listitem')
        .find((element) => element.textContent?.includes(item.label));
      expect(row).toBeTruthy();
      expect(row).toHaveTextContent('Not yet');
    }
    expect(document.body.textContent?.includes('at least 8 characters')).toBe(false);
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'minLength',
      String(SIGNUP_PASSWORD_MIN_LENGTH),
    );

    fireEvent.change(document.querySelector('#password') as HTMLInputElement, {
      target: { value: 'Password1234' },
    });

    for (const item of signupPasswordChecklist('Password1234')) {
      expect(item.met).toBe(true);
      const row = screen
        .getAllByRole('listitem')
        .find((element) => element.textContent?.includes(item.label));
      expect(row).toHaveTextContent('Met');
    }
  });

  it('marks unmet password rules after submit and does not call the API', () => {
    render(<SignupForm apiUrl="http://api.test" />);
    fireEvent.change(document.querySelector('#name') as HTMLInputElement, {
      target: { value: 'Ada Lovelace' },
    });
    fireEvent.change(document.querySelector('#email') as HTMLInputElement, {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(document.querySelector('#password') as HTMLInputElement, {
      target: { value: 'password1234' },
    });
    const tos = document.querySelector('#tos');
    if (tos) fireEvent.click(tos);
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    const uppercase = signupPasswordChecklist('password1234').find(
      (item) => item.id === 'uppercase',
    );
    expect(uppercase?.met).toBe(false);
    const uppercaseRow = screen
      .getAllByRole('listitem')
      .find((element) => element.textContent?.includes('uppercase'));
    expect(uppercaseRow).toHaveTextContent('Not yet');
    expect(document.querySelector('#password')).toHaveAttribute('aria-invalid', 'true');
    expect(document.querySelector('#password')).toHaveAttribute(
      'aria-describedby',
      'password-description',
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('SignupForm inline validation and sign-in links', () => {
  function acceptTerms(): void {
    const tos = document.querySelector('#tos');
    if (tos) fireEvent.click(tos);
  }

  it('shows required and email format errors from the sign-up schema', () => {
    render(<SignupForm apiUrl="http://api.test" />);
    acceptTerms();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    const empty = { email: '', password: '', name: '' };
    expect(screen.getByText(signUpFieldMessage(empty, 'name'))).toBeInTheDocument();
    expect(screen.getByText(signUpFieldMessage(empty, 'email'))).toBeInTheDocument();
    expect(document.querySelector('#name')).toHaveAttribute('aria-invalid', 'true');
    expect(document.querySelector('#name')).toHaveAttribute('aria-describedby', 'name-error');
    expect(document.querySelector('#email')).toHaveAttribute('aria-invalid', 'true');
    expect(document.querySelector('#email')).toHaveAttribute('aria-describedby', 'email-error');
    expect(document.querySelector('form')).toHaveAttribute('novalidate');
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.change(document.querySelector('#email') as HTMLInputElement, {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      screen.getByText(signUpFieldMessage({ ...empty, email: 'not-an-email' }, 'email')),
    ).toBeInTheDocument();
  });

  it('always links to sign in, including with each plan and a license', () => {
    render(<SignupForm apiUrl="http://api.test" />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    cleanup();

    for (const plan of ['pro', 'max', 'enterprise'] as const) {
      mockPlanParam = plan;
      render(<SignupForm apiUrl="http://api.test" />);
      expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
        'href',
        `/login?plan=${plan}`,
      );
      cleanup();
      mockPlanParam = null;
    }

    mockLicenseParam = 'pro';
    render(<SignupForm apiUrl="http://api.test" />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?license=pro',
    );
  });

  it('carries plan, license, and redirect to sign in and drops open redirects', () => {
    mockPlanParam = 'pro';
    mockLicenseParam = 'pro';
    mockRedirectParam = '/welcome';
    render(<SignupForm apiUrl="http://api.test" />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?plan=pro&license=pro&redirect=%2Fwelcome',
    );
    cleanup();

    mockPlanParam = 'max';
    mockLicenseParam = null;
    mockRedirectParam = 'https://evil.example/phish';
    render(<SignupForm apiUrl="http://api.test" />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login?plan=max',
    );
    cleanup();

    mockPlanParam = null;
    mockRedirectParam = '//evil.com';
    render(<SignupForm apiUrl="http://api.test" />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('sends an auto-verified signup with only a safe redirect to that path', async () => {
    mockRedirectParam = '/account/license';
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
      expect(mockNavigate).toHaveBeenCalledWith('/account/license');
    });
  });

  it('keeps a trial plan ahead of redirect on the post-auth destination', async () => {
    mockPlanParam = 'pro';
    mockRedirectParam = '/welcome';
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
      expect(mockNavigate).toHaveBeenCalledWith('/account/billing?upgrade=pro');
    });
  });

  it('ignores an unknown plan on the sign-in link', () => {
    mockPlanParam = 'enterprise-deluxe';
    render(<SignupForm apiUrl="http://api.test" />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});
