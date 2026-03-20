// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePasskeyRegister, usePasskeySignIn } from '../usePasskey.js';

// Mock @simplewebauthn/browser
vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}));

function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
  });
}

function mockFetchSequence(responses: Array<{ body: unknown; status?: number }>) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: (response.status ?? 200) >= 200 && (response.status ?? 200) < 300,
      status: response.status ?? 200,
      json: () => Promise.resolve(response.body),
    });
  }
  return fetchMock;
}

describe('usePasskeyRegister', () => {
  let originalPublicKeyCredential: typeof window.PublicKeyCredential;

  beforeEach(() => {
    originalPublicKeyCredential = window.PublicKeyCredential;
    // Ensure PublicKeyCredential is defined (happy-dom may not have it)
    if (!window.PublicKeyCredential) {
      Object.defineProperty(window, 'PublicKeyCredential', {
        value: class MockPublicKeyCredential {},
        writable: true,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: originalPublicKeyCredential,
      writable: true,
      configurable: true,
    });
  });

  it('supported reflects PublicKeyCredential availability', () => {
    const { result } = renderHook(() => usePasskeyRegister());
    expect(result.current.supported).toBe(true);
  });

  it('supported is false when PublicKeyCredential is undefined', () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePasskeyRegister());
    expect(result.current.supported).toBe(false);
  });

  it('register() calls options -> browser API -> verify', async () => {
    const registrationOptions = {
      challenge: 'test-challenge',
      rp: { name: 'RevealUI' },
    };
    const attestationResponse = {
      id: 'cred-id',
      rawId: 'raw-id',
      response: { attestationObject: 'test', clientDataJSON: 'test' },
      type: 'public-key',
    };

    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        { body: { options: registrationOptions } },
        { body: { backupCodes: ['backup-1', 'backup-2'] } },
      ]),
    );

    const { startRegistration } = await import('@simplewebauthn/browser');
    vi.mocked(startRegistration).mockResolvedValue(attestationResponse as never);

    const { result } = renderHook(() => usePasskeyRegister());

    let registerResult: Awaited<ReturnType<typeof result.current.register>>;
    await act(async () => {
      registerResult = await result.current.register({
        email: 'test@example.com',
        name: 'Test User',
        deviceName: 'MacBook Pro',
      });
    });

    expect(registerResult!).toEqual({ backupCodes: ['backup-1', 'backup-2'] });
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);

    // Verify first fetch (registration options)
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/passkey/register-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: 'test@example.com', name: 'Test User' }),
    });

    // Verify browser API was called with options (v13+ wraps in { optionsJSON })
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: registrationOptions });

    // Verify second fetch (verify attestation)
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/auth/passkey/register-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        attestationResponse,
        deviceName: 'MacBook Pro',
      }),
    });
  });

  it('register() returns null and sets error when options request fails', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Not authenticated' }, 401));

    const { result } = renderHook(() => usePasskeyRegister());

    let registerResult: Awaited<ReturnType<typeof result.current.register>>;
    await act(async () => {
      registerResult = await result.current.register();
    });

    expect(registerResult!).toBeNull();
    expect(result.current.error).toBe('Not authenticated');
  });

  it('register() returns null and sets error when verify request fails', async () => {
    const { startRegistration } = await import('@simplewebauthn/browser');
    vi.mocked(startRegistration).mockResolvedValue({ id: 'cred' } as never);

    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        { body: { challenge: 'test' } },
        { body: { error: 'Verification failed' }, status: 400 },
      ]),
    );

    const { result } = renderHook(() => usePasskeyRegister());

    let registerResult: Awaited<ReturnType<typeof result.current.register>>;
    await act(async () => {
      registerResult = await result.current.register();
    });

    expect(registerResult!).toBeNull();
    expect(result.current.error).toBe('Verification failed');
  });

  it('register() handles browser API cancellation', async () => {
    vi.stubGlobal('fetch', mockFetch({ challenge: 'test' }));

    const { startRegistration } = await import('@simplewebauthn/browser');
    vi.mocked(startRegistration).mockRejectedValue(
      new DOMException('The operation was cancelled', 'NotAllowedError'),
    );

    const { result } = renderHook(() => usePasskeyRegister());

    let registerResult: Awaited<ReturnType<typeof result.current.register>>;
    await act(async () => {
      registerResult = await result.current.register();
    });

    expect(registerResult!).toBeNull();
    expect(result.current.error).toBe('Passkey registration was cancelled');
  });

  it('register() returns null when unsupported', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePasskeyRegister());

    let registerResult: Awaited<ReturnType<typeof result.current.register>>;
    await act(async () => {
      registerResult = await result.current.register();
    });

    expect(registerResult!).toBeNull();
    expect(result.current.error).toBe('Passkeys are not supported in this browser');
  });
});

describe('usePasskeySignIn', () => {
  let originalPublicKeyCredential: typeof window.PublicKeyCredential;

  beforeEach(() => {
    originalPublicKeyCredential = window.PublicKeyCredential;
    if (!window.PublicKeyCredential) {
      Object.defineProperty(window, 'PublicKeyCredential', {
        value: class MockPublicKeyCredential {},
        writable: true,
        configurable: true,
      });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: originalPublicKeyCredential,
      writable: true,
      configurable: true,
    });
  });

  it('supported reflects PublicKeyCredential availability', () => {
    const { result } = renderHook(() => usePasskeySignIn());
    expect(result.current.supported).toBe(true);
  });

  it('signIn() calls options -> browser API -> verify', async () => {
    const authOptions = {
      challenge: 'auth-challenge',
      rpId: 'revealui.com',
    };
    const assertionResponse = {
      id: 'cred-id',
      rawId: 'raw-id',
      response: { authenticatorData: 'test', clientDataJSON: 'test', signature: 'sig' },
      type: 'public-key',
    };

    vi.stubGlobal(
      'fetch',
      mockFetchSequence([{ body: { options: authOptions } }, { body: { success: true } }]),
    );

    const { startAuthentication } = await import('@simplewebauthn/browser');
    vi.mocked(startAuthentication).mockResolvedValue(assertionResponse as never);

    const { result } = renderHook(() => usePasskeySignIn());

    let signInResult: boolean;
    await act(async () => {
      signInResult = await result.current.signIn();
    });

    expect(signInResult!).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);

    // Verify first fetch (authentication options)
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/passkey/authenticate-options', {
      method: 'POST',
      credentials: 'include',
    });

    // Verify browser API (v13+ wraps in { optionsJSON })
    expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: authOptions });

    // Verify second fetch (verify assertion)
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/auth/passkey/authenticate-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ authenticationResponse: assertionResponse }),
    });
  });

  it('signIn() returns false and sets error when options request fails', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: 'Server error' }, 500));

    const { result } = renderHook(() => usePasskeySignIn());

    let signInResult: boolean;
    await act(async () => {
      signInResult = await result.current.signIn();
    });

    expect(signInResult!).toBe(false);
    expect(result.current.error).toBe('Server error');
  });

  it('signIn() returns false and sets error when verify fails', async () => {
    const { startAuthentication } = await import('@simplewebauthn/browser');
    vi.mocked(startAuthentication).mockResolvedValue({ id: 'cred' } as never);

    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        { body: { challenge: 'test' } },
        { body: { error: 'Authentication failed' }, status: 401 },
      ]),
    );

    const { result } = renderHook(() => usePasskeySignIn());

    let signInResult: boolean;
    await act(async () => {
      signInResult = await result.current.signIn();
    });

    expect(signInResult!).toBe(false);
    expect(result.current.error).toBe('Authentication failed');
  });

  it('signIn() handles browser API cancellation', async () => {
    vi.stubGlobal('fetch', mockFetch({ challenge: 'test' }));

    const { startAuthentication } = await import('@simplewebauthn/browser');
    vi.mocked(startAuthentication).mockRejectedValue(
      new DOMException('The operation was cancelled', 'NotAllowedError'),
    );

    const { result } = renderHook(() => usePasskeySignIn());

    let signInResult: boolean;
    await act(async () => {
      signInResult = await result.current.signIn();
    });

    expect(signInResult!).toBe(false);
    expect(result.current.error).toBe('Passkey authentication was cancelled');
  });

  it('signIn() returns false when unsupported', async () => {
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => usePasskeySignIn());

    let signInResult: boolean;
    await act(async () => {
      signInResult = await result.current.signIn();
    });

    expect(signInResult!).toBe(false);
    expect(result.current.error).toBe('Passkeys are not supported in this browser');
  });
});
