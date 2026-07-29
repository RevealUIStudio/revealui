// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSignIn } from '../useSignIn.js';

function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
  });
}

describe('useSignIn', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns success with user on valid credentials', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ user: { id: 'user-1', email: 'test@example.com', name: 'Test' } }),
    );

    const { result } = renderHook(() => useSignIn());

    let signInResult: Awaited<ReturnType<typeof result.current.signIn>>;
    await waitFor(async () => {
      signInResult = await result.current.signIn({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    expect(signInResult!.success).toBe(true);
    if (signInResult!.success) {
      expect(signInResult!.user.email).toBe('test@example.com');
    }
    expect(result.current.isLoading).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/sign-in',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      }),
    );
  });

  it('returns error on invalid credentials', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Invalid credentials' }, 401));

    const { result } = renderHook(() => useSignIn());

    let signInResult: Awaited<ReturnType<typeof result.current.signIn>>;
    await waitFor(async () => {
      signInResult = await result.current.signIn({
        email: 'bad@example.com',
        password: 'wrong',
      });
    });

    expect(signInResult!.success).toBe(false);
    if (!signInResult!.success && 'error' in signInResult!) {
      expect(signInResult!.error).toBe('Invalid credentials');
    }
  });

  it('surfaces the human message for display and the machine code for branching', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(
        {
          error: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email address before signing in.',
          code: 'EMAIL_NOT_VERIFIED',
        },
        403,
      ),
    );

    const { result } = renderHook(() => useSignIn());

    let signInResult: Awaited<ReturnType<typeof result.current.signIn>>;
    await waitFor(async () => {
      signInResult = await result.current.signIn({
        email: 'unverified@example.com',
        password: 'password123',
      });
    });

    expect(signInResult!.success).toBe(false);
    if (!signInResult!.success && 'error' in signInResult!) {
      // Display copy is the human message, never the raw code.
      expect(signInResult!.error).toBe('Please verify your email address before signing in.');
      expect(signInResult!.code).toBe('EMAIL_NOT_VERIFIED');
    }
  });

  it('returns MFA challenge when required', async () => {
    vi.stubGlobal('fetch', mockFetch({ requiresMfa: true, mfaUserId: 'user-mfa-1' }));

    const { result } = renderHook(() => useSignIn());

    let signInResult: Awaited<ReturnType<typeof result.current.signIn>>;
    await waitFor(async () => {
      signInResult = await result.current.signIn({
        email: 'mfa@example.com',
        password: 'password123',
      });
    });

    expect(signInResult!.success).toBe(false);
    if (!signInResult!.success && 'requiresMfa' in signInResult!) {
      expect(signInResult!.requiresMfa).toBe(true);
      expect(signInResult!.mfaUserId).toBe('user-mfa-1');
    }
  });

  it('returns MFA challenge when body is cookie-only shape ({ requiresMfa: true })', async () => {
    // Live admin route historically returned only requiresMfa and put the
    // user id in the httpOnly mfa-pending cookie. Must not fall through to
    // the success schema (user expected object).
    vi.stubGlobal('fetch', mockFetch({ requiresMfa: true }));

    const { result } = renderHook(() => useSignIn());

    let signInResult: Awaited<ReturnType<typeof result.current.signIn>>;
    await waitFor(async () => {
      signInResult = await result.current.signIn({
        email: 'mfa@example.com',
        password: 'password123',
      });
    });

    expect(signInResult!.success).toBe(false);
    if (!signInResult!.success && 'requiresMfa' in signInResult!) {
      expect(signInResult!.requiresMfa).toBe(true);
    }
    expect(result.current.error).toBeNull();
  });

  it('handles network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { result } = renderHook(() => useSignIn());

    let signInResult: Awaited<ReturnType<typeof result.current.signIn>>;
    await waitFor(async () => {
      signInResult = await result.current.signIn({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    expect(signInResult!.success).toBe(false);
    if (!signInResult!.success && 'error' in signInResult!) {
      expect(signInResult!.error).toBe('Network error');
    }
    // The error is also returned in the result
    expect(signInResult!.success).toBe(false);
  });

  it('sets isLoading during request', async () => {
    let resolvePromise: (value: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve;
          }),
      ),
    );

    const { result } = renderHook(() => useSignIn());
    expect(result.current.isLoading).toBe(false);

    const signInPromise = result.current.signIn({
      email: 'test@example.com',
      password: 'password123',
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    resolvePromise!({
      ok: true,
      json: () =>
        Promise.resolve({ user: { id: 'user-1', email: 'test@example.com', name: 'Test' } }),
    });

    await signInPromise;

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
