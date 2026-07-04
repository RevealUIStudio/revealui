/**
 * Tests for LoginForm's post-sign-in navigation.
 *
 * The critical behavior: every navigation that follows an auth-state change
 * must be a full document navigation (navigateAfterAuthChange), never a soft
 * router.push. The App Router client cache still holds the logged-out RSC
 * payload for '/' (a redirect back to /login), so a soft push after sign-in
 * replays it and bounces the user straight back to /login.
 *
 * Also covers the ?redirect= / ?upgrade= intent: honored on direct success and
 * carried through the /mfa and /rotate-password intermediate steps.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockSignIn = vi.fn();
const mockPasskeySignIn = vi.fn();
const mockNavigate = vi.fn();
const mockPush = vi.fn();
// Set per-test to render the passkey button.
let mockPasskeySupported = false;
// Set per-test to drive useSearchParams.
let mockSearchParams: Record<string, string | null> = {};

vi.mock('@revealui/auth/react', () => ({
  useSignIn: () => ({ signIn: mockSignIn, isLoading: false }),
  usePasskeySignIn: () => ({
    signIn: mockPasskeySignIn,
    isLoading: false,
    error: null,
    supported: mockPasskeySupported,
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: (k: string) => mockSearchParams[k] ?? null }),
}));

vi.mock('@/lib/utils/auth-navigation', () => ({
  // Deferred closure: direct `mockNavigate` here would hit the TDZ — the
  // hoisted component import runs this factory before the const initializes.
  navigateAfterAuthChange: (path: string) => mockNavigate(path),
}));

vi.mock('@revealui/presentation/server', () => ({
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  ButtonCVA: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  FormLabel: ({ children, htmlFor }: any) => <label htmlFor={htmlFor}>{children}</label>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  Heading: ({ children }: any) => <h2>{children}</h2>,
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  InputCVA: (props: any) => <input {...props} />,
  GitHubIcon: () => <svg aria-hidden="true" />,
  GoogleIcon: () => <svg aria-hidden="true" />,
  LinkedInIcon: () => <svg aria-hidden="true" />,
  PasskeyIcon: () => <svg aria-hidden="true" />,
  VercelIcon: () => <svg aria-hidden="true" />,
}));

vi.mock('@/lib/components/PasswordInput', () => ({
  // biome-ignore lint/suspicious/noExplicitAny: lightweight test doubles
  PasswordInput: ({ children }: any) => <div>{children}</div>,
}));

import { LoginForm } from '../LoginForm';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPasskeySupported = false;
  mockSearchParams = {};
});

function fillAndSubmit(): void {
  const set = (selector: string, value: string) => {
    const el = document.querySelector(selector);
    if (el) fireEvent.change(el, { target: { value } });
  };
  set('#email', 'owner@example.com');
  set('#password', 'Password123');
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginForm post-sign-in navigation', () => {
  it('full-navigates home after a successful credentials sign-in (no soft push)', async () => {
    mockSignIn.mockResolvedValue({
      success: true,
      user: { id: '1', email: 'owner@example.com', role: 'admin' },
    });

    render(<LoginForm oauthProviders={[]} />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('full-navigates to /welcome for a user-role sign-in (subscriber, not admin)', async () => {
    mockSignIn.mockResolvedValue({
      success: true,
      user: { id: '2', email: 'subscriber@example.com', role: 'user' },
    });

    render(<LoginForm oauthProviders={[]} />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/welcome');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('honors a ?redirect= over the role default on direct success', async () => {
    mockSearchParams = { redirect: '/upgrade' };
    mockSignIn.mockResolvedValue({
      success: true,
      user: { id: '2', email: 'subscriber@example.com', role: 'user' },
    });

    render(<LoginForm oauthProviders={[]} />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/upgrade');
    });
  });

  it('full-navigates to /rotate-password when the account requires rotation', async () => {
    mockSignIn.mockResolvedValue({
      success: true,
      user: { id: '1', email: 'owner@example.com' },
      requiresPasswordRotation: true,
    });

    render(<LoginForm oauthProviders={[]} />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/rotate-password');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('carries ?redirect= through the /rotate-password step', async () => {
    mockSearchParams = { redirect: '/upgrade' };
    mockSignIn.mockResolvedValue({
      success: true,
      user: { id: '1', email: 'owner@example.com' },
      requiresPasswordRotation: true,
    });

    render(<LoginForm oauthProviders={[]} />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/rotate-password?redirect=%2Fupgrade');
    });
  });

  it('full-navigates to /mfa when the server answers with an MFA challenge', async () => {
    mockSignIn.mockResolvedValue({ success: false, requiresMfa: true, mfaUserId: 'u-1' });

    render(<LoginForm oauthProviders={[]} />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/mfa');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('carries ?upgrade= and ?redirect= through the /mfa step', async () => {
    mockSearchParams = { upgrade: 'pro', redirect: '/upgrade' };
    mockSignIn.mockResolvedValue({ success: false, requiresMfa: true, mfaUserId: 'u-1' });

    render(<LoginForm oauthProviders={[]} />);
    fillAndSubmit();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/mfa?upgrade=pro&redirect=%2Fupgrade');
    });
  });

  it('shows the error and does not navigate on a failed sign-in', async () => {
    mockSignIn.mockResolvedValue({ success: false, error: 'Invalid email or password' });

    render(<LoginForm oauthProviders={[]} />);
    fillAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('offers a verification resend when sign-in fails with EMAIL_NOT_VERIFIED', async () => {
    mockSignIn.mockResolvedValue({
      success: false,
      error: 'Please verify your email address before signing in.',
      code: 'EMAIL_NOT_VERIFIED',
    });

    render(<LoginForm oauthProviders={[]} />);
    fillAndSubmit();

    // Friendly message shown (not the raw code), plus a recovery affordance.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please verify your email address before signing in.',
    );
    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not offer a resend for a generic sign-in failure', async () => {
    mockSignIn.mockResolvedValue({ success: false, error: 'Invalid email or password' });

    render(<LoginForm oauthProviders={[]} />);
    fillAndSubmit();

    await screen.findByRole('alert');
    expect(
      screen.queryByRole('button', { name: 'Resend verification email' }),
    ).not.toBeInTheDocument();
  });

  it('resends the verification email to the sign-in address and confirms', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    mockSignIn.mockResolvedValue({
      success: false,
      error: 'Please verify your email address before signing in.',
      code: 'EMAIL_NOT_VERIFIED',
    });

    render(<LoginForm oauthProviders={[]} />);
    fillAndSubmit();

    const resendButton = await screen.findByRole('button', { name: 'Resend verification email' });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/resend-verification',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'owner@example.com' }),
        }),
      );
    });
    expect(
      await screen.findByText((content) => content.includes('verification link is on its way')),
    ).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('attaches the CSRF token to the resend request when the csrf cookie is present', async () => {
    // The resend POST is NOT in the proxy's CSRF_EXEMPT_PREFIXES, and the proxy
    // CSRF gate keys on session-cookie PRESENCE (not validity). With a stale
    // leftover session cookie a raw fetch gets a 403 that resolves — the user
    // would see "sent" while nothing was sent. The handler must go through
    // apiFetch so the revealui-csrf double-submit token rides along.
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
    vi.stubGlobal('fetch', fetchMock);
    document.cookie = 'revealui-csrf=test-csrf-token';
    mockSignIn.mockResolvedValue({
      success: false,
      error: 'Please verify your email address before signing in.',
      code: 'EMAIL_NOT_VERIFIED',
    });

    try {
      render(<LoginForm oauthProviders={[]} />);
      fillAndSubmit();

      const resendButton = await screen.findByRole('button', {
        name: 'Resend verification email',
      });
      fireEvent.click(resendButton);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/auth/resend-verification',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({ 'X-CSRF-Token': 'test-csrf-token' }),
            body: JSON.stringify({ email: 'owner@example.com' }),
          }),
        );
      });
    } finally {
      document.cookie = 'revealui-csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      vi.unstubAllGlobals();
    }
  });

  it('full-navigates home after a successful passkey sign-in (no soft push)', async () => {
    mockPasskeySupported = true;
    mockPasskeySignIn.mockResolvedValue(true);

    render(<LoginForm oauthProviders={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Passkey' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('honors ?redirect= after a successful passkey sign-in', async () => {
    mockPasskeySupported = true;
    mockSearchParams = { redirect: '/upgrade' };
    mockPasskeySignIn.mockResolvedValue(true);

    render(<LoginForm oauthProviders={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Passkey' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/upgrade');
    });
  });

  it('stays put when a passkey sign-in is cancelled or fails', async () => {
    mockPasskeySupported = true;
    mockPasskeySignIn.mockResolvedValue(false);

    render(<LoginForm oauthProviders={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Passkey' }));

    await waitFor(() => {
      expect(mockPasskeySignIn).toHaveBeenCalled();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
