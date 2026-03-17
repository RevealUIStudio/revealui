// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSignUp } from '../useSignUp.js';

function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
  });
}

const validInput = {
  email: 'new@example.com',
  password: 'StrongPassword123!',
  name: 'New User',
  tosAccepted: true as const,
};

describe('useSignUp', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns success with user on valid sign-up', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ user: { id: 'user-new', email: 'new@example.com', name: 'New User' } }),
    );

    const { result } = renderHook(() => useSignUp());

    let signUpResult: Awaited<ReturnType<typeof result.current.signUp>>;
    await waitFor(async () => {
      signUpResult = await result.current.signUp(validInput);
    });

    expect(signUpResult!.success).toBe(true);
    expect(signUpResult!.user?.email).toBe('new@example.com');
    expect(result.current.isLoading).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/sign-up',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(validInput),
      }),
    );
  });

  it('returns error when email already exists', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Email already registered' }, 409));

    const { result } = renderHook(() => useSignUp());

    let signUpResult: Awaited<ReturnType<typeof result.current.signUp>>;
    await waitFor(async () => {
      signUpResult = await result.current.signUp(validInput);
    });

    expect(signUpResult!.success).toBe(false);
    expect(signUpResult!.error).toBe('Email already registered');
  });

  it('handles network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    const { result } = renderHook(() => useSignUp());

    let signUpResult: Awaited<ReturnType<typeof result.current.signUp>>;
    await waitFor(async () => {
      signUpResult = await result.current.signUp(validInput);
    });

    expect(signUpResult!.success).toBe(false);
    expect(signUpResult!.error).toBe('Connection refused');
    expect(result.current.error?.message).toBe('Connection refused');
  });

  it('returns fallback error when API error is missing', async () => {
    vi.stubGlobal('fetch', mockFetch({}, 400));

    const { result } = renderHook(() => useSignUp());

    let signUpResult: Awaited<ReturnType<typeof result.current.signUp>>;
    await waitFor(async () => {
      signUpResult = await result.current.signUp(validInput);
    });

    expect(signUpResult!.success).toBe(false);
    expect(signUpResult!.error).toBe('Failed to sign up');
  });
});
