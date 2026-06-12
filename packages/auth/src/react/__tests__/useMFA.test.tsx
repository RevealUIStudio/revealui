// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMFASetup, useMFAVerify } from '../useMFA.js';

function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
  });
}

describe('useMFASetup', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('setup() calls /api/auth/mfa/setup and returns data', async () => {
    const setupData = {
      secret: 'JBSWY3DPEHPK3PXP',
      uri: 'otpauth://totp/RevealUI:test@example.com?secret=JBSWY3DPEHPK3PXP',
      backupCodes: ['code1', 'code2', 'code3'],
    };
    vi.stubGlobal('fetch', mockFetch(setupData));

    const { result } = renderHook(() => useMFASetup());

    let setupResult: Awaited<ReturnType<typeof result.current.setup>>;
    await act(async () => {
      setupResult = await result.current.setup();
    });

    expect(setupResult!).toEqual(setupData);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/auth/mfa/setup', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('setup() returns null and sets error on failure', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Not authenticated' }, 401));

    const { result } = renderHook(() => useMFASetup());

    let setupResult: Awaited<ReturnType<typeof result.current.setup>>;
    await act(async () => {
      setupResult = await result.current.setup();
    });

    expect(setupResult!).toBeNull();
    expect(result.current.error).toBe('Not authenticated');
  });

  it('setup() uses fallback error when none provided', async () => {
    vi.stubGlobal('fetch', mockFetch({}, 500));

    const { result } = renderHook(() => useMFASetup());

    let setupResult: Awaited<ReturnType<typeof result.current.setup>>;
    await act(async () => {
      setupResult = await result.current.setup();
    });

    expect(setupResult!).toBeNull();
    expect(result.current.error).toBe('Failed to set up MFA');
  });

  it('setup() handles network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { result } = renderHook(() => useMFASetup());

    let setupResult: Awaited<ReturnType<typeof result.current.setup>>;
    await act(async () => {
      setupResult = await result.current.setup();
    });

    expect(setupResult!).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  it('verifySetup() calls /api/auth/mfa/verify-setup and returns true', async () => {
    vi.stubGlobal('fetch', mockFetch({ verified: true }));

    const { result } = renderHook(() => useMFASetup());

    let verified: boolean;
    await act(async () => {
      verified = await result.current.verifySetup('123456');
    });

    expect(verified!).toBe(true);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/auth/mfa/verify-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code: '123456' }),
    });
  });

  it('verifySetup() returns false and sets error on invalid code', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Invalid TOTP code' }, 400));

    const { result } = renderHook(() => useMFASetup());

    let verified: boolean;
    await act(async () => {
      verified = await result.current.verifySetup('000000');
    });

    expect(verified!).toBe(false);
    expect(result.current.error).toBe('Invalid TOTP code');
  });

  it('verifySetup() handles network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection failed')));

    const { result } = renderHook(() => useMFASetup());

    let verified: boolean;
    await act(async () => {
      verified = await result.current.verifySetup('123456');
    });

    expect(verified!).toBe(false);
    expect(result.current.error).toBe('Connection failed');
  });

  it('sets isLoading during setup request', async () => {
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

    const { result } = renderHook(() => useMFASetup());
    expect(result.current.isLoading).toBe(false);

    let setupPromise: Promise<unknown>;
    act(() => {
      setupPromise = result.current.setup();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    await act(async () => {
      resolvePromise!({
        ok: true,
        json: () =>
          Promise.resolve({
            secret: 'test',
            uri: 'otpauth://test',
            backupCodes: [],
          }),
      });
      await setupPromise!;
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe('useMFAVerify', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verify() calls /api/auth/mfa/verify and returns true on success', async () => {
    vi.stubGlobal('fetch', mockFetch({ success: true }));

    const { result } = renderHook(() => useMFAVerify());

    let verified: boolean;
    await act(async () => {
      verified = await result.current.verify('123456');
    });

    expect(verified!).toBe(true);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code: '123456' }),
    });
  });

  it('verify() returns false and sets error on 401', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Invalid code' }, 401));

    const { result } = renderHook(() => useMFAVerify());

    let verified: boolean;
    await act(async () => {
      verified = await result.current.verify('000000');
    });

    expect(verified!).toBe(false);
    expect(result.current.error).toBe('Invalid code');
  });

  it('verify() uses fallback error message when none provided', async () => {
    vi.stubGlobal('fetch', mockFetch({}, 401));

    const { result } = renderHook(() => useMFAVerify());

    let verified: boolean;
    await act(async () => {
      verified = await result.current.verify('000000');
    });

    expect(verified!).toBe(false);
    expect(result.current.error).toBe('Invalid verification code');
  });

  it('verifyBackupCode() calls /api/auth/mfa/backup and returns true on success', async () => {
    vi.stubGlobal('fetch', mockFetch({ success: true }));

    const { result } = renderHook(() => useMFAVerify());

    let verified: boolean;
    await act(async () => {
      verified = await result.current.verifyBackupCode('abc123def456');
    });

    expect(verified!).toBe(true);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/auth/mfa/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code: 'abc123def456' }),
    });
  });

  it('verifyBackupCode() returns false and sets error on failure', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Invalid backup code' }, 400));

    const { result } = renderHook(() => useMFAVerify());

    let verified: boolean;
    await act(async () => {
      verified = await result.current.verifyBackupCode('invalid');
    });

    expect(verified!).toBe(false);
    expect(result.current.error).toBe('Invalid backup code');
  });

  it('verify() handles network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { result } = renderHook(() => useMFAVerify());

    let verified: boolean;
    await act(async () => {
      verified = await result.current.verify('123456');
    });

    expect(verified!).toBe(false);
    expect(result.current.error).toBe('Network error');
  });

  it('clears previous error on new request', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Invalid code' }, 401));

    const { result } = renderHook(() => useMFAVerify());

    await act(async () => {
      await result.current.verify('000000');
    });

    expect(result.current.error).toBe('Invalid code');

    vi.stubGlobal('fetch', mockFetch({ success: true }));

    await act(async () => {
      await result.current.verify('123456');
    });

    expect(result.current.error).toBeNull();
  });
});

describe('useMFA - CSRF token attach', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // happy-dom cookies persist across tests in this file - expire ours so
    // the exact-equality assertions in the describes above stay header-free
    document.cookie = 'revealui-csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it('setup() echoes the revealui-csrf cookie as X-CSRF-Token', async () => {
    document.cookie = 'other-cookie=unrelated';
    document.cookie = 'revealui-csrf=nonce123:hmac456';
    vi.stubGlobal('fetch', mockFetch({ secret: 's', uri: 'otpauth://t', backupCodes: [] }));

    const { result } = renderHook(() => useMFASetup());
    await act(async () => {
      await result.current.setup();
    });

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/mfa/setup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': 'nonce123:hmac456' },
    });
  });

  it('verifySetup() echoes the cookie alongside Content-Type', async () => {
    document.cookie = 'revealui-csrf=nonce123:hmac456';
    vi.stubGlobal('fetch', mockFetch({ verified: true }));

    const { result } = renderHook(() => useMFASetup());
    await act(async () => {
      await result.current.verifySetup('123456');
    });

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/mfa/verify-setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'nonce123:hmac456',
      },
      credentials: 'include',
      body: JSON.stringify({ code: '123456' }),
    });
  });

  it('verify() and verifyBackupCode() echo the cookie during MFA login', async () => {
    document.cookie = 'revealui-csrf=tok-login';
    vi.stubGlobal('fetch', mockFetch({ success: true }));

    const { result } = renderHook(() => useMFAVerify());
    await act(async () => {
      await result.current.verify('123456');
      await result.current.verifyBackupCode('backup-1');
    });

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/mfa/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'tok-login',
      },
      credentials: 'include',
      body: JSON.stringify({ code: '123456' }),
    });
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/auth/mfa/backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'tok-login',
      },
      credentials: 'include',
      body: JSON.stringify({ code: 'backup-1' }),
    });
  });

  it('re-reads the cookie before each POST (proxy may reissue between steps)', async () => {
    document.cookie = 'revealui-csrf=token-before';
    vi.stubGlobal('fetch', mockFetch({ secret: 's', uri: 'otpauth://t', backupCodes: [] }));

    const { result } = renderHook(() => useMFASetup());
    await act(async () => {
      await result.current.setup();
    });

    document.cookie = 'revealui-csrf=token-rotated';
    await act(async () => {
      await result.current.verifySetup('123456');
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/auth/mfa/setup',
      expect.objectContaining({
        headers: { 'X-CSRF-Token': 'token-before' },
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/auth/mfa/verify-setup',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-CSRF-Token': 'token-rotated' }),
      }),
    );
  });

  it('setup() sends no headers key at all when the cookie is absent', async () => {
    vi.stubGlobal('fetch', mockFetch({ secret: 's', uri: 'otpauth://t', backupCodes: [] }));

    const { result } = renderHook(() => useMFASetup());
    await act(async () => {
      await result.current.setup();
    });

    // Exact equality: cookie-less setup requests stay byte-identical to the
    // pre-CSRF shape (no headers key)
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/mfa/setup', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('verify() omits X-CSRF-Token when the cookie is absent', async () => {
    vi.stubGlobal('fetch', mockFetch({ success: true }));

    const { result } = renderHook(() => useMFAVerify());
    await act(async () => {
      await result.current.verify('123456');
    });

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/mfa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code: '123456' }),
    });
  });

  it('omits X-CSRF-Token when the cookie value is empty', async () => {
    document.cookie = 'revealui-csrf=';
    vi.stubGlobal('fetch', mockFetch({ secret: 's', uri: 'otpauth://t', backupCodes: [] }));

    const { result } = renderHook(() => useMFASetup());
    await act(async () => {
      await result.current.setup();
    });

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/mfa/setup', {
      method: 'POST',
      credentials: 'include',
    });
  });
});
