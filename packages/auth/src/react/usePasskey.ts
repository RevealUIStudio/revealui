/**
 * Passkey Hooks
 *
 * React hooks for WebAuthn passkey registration and authentication.
 * Uses dynamic imports for @simplewebauthn/browser to avoid SSR issues.
 *
 * CSRF: every POST echoes the JS-readable `revealui-csrf` cookie (the signed
 * double-submit token the RevealUI admin proxy issues on page load) as an
 * `X-CSRF-Token` header when the cookie is present. The proxy requires it on
 * session-cookie-bearing unsafe requests — registration always runs with a
 * session, so without the header it 403s ("CSRF token missing"). Cookie-less
 * callers (no admin session) send no header and are unchanged.
 */

'use client';

import { useEffect, useState } from 'react';

/**
 * Read the JS-readable `revealui-csrf` cookie. The RevealUI admin proxy
 * (`apps/admin/src/proxy.ts`) requires it as an `X-CSRF-Token` header on any
 * session-cookie-bearing unsafe request, and may re-issue the cookie on any
 * response — so call this immediately before each fetch rather than once per
 * flow. Returns undefined outside the browser or when the cookie is
 * absent/empty. Mirrors the cookie-read in `@revealui/core`'s admin APIClient
 * (`request()`) and `@revealui/ai`'s `useAgentStream`.
 */
function readCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const part of document.cookie.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    if (part.slice(0, eqIdx).trim() === 'revealui-csrf') {
      return part.slice(eqIdx + 1).trim() || undefined;
    }
  }
  return undefined;
}

export interface PasskeyRegisterOptions {
  /** Email for passkey registration (sign-up flow) */
  email?: string;
  /** Display name for the credential */
  name?: string;
  /** Human-readable device name (e.g., "MacBook Pro") */
  deviceName?: string;
}

export interface PasskeyRegisterResult {
  /** Backup codes returned during sign-up flow */
  backupCodes?: string[];
}

export interface UsePasskeyRegisterResult {
  /** Register a new passkey credential */
  register: (options?: PasskeyRegisterOptions) => Promise<PasskeyRegisterResult | null>;
  isLoading: boolean;
  error: string | null;
  /** Whether the browser supports WebAuthn */
  supported: boolean;
}

/**
 * Hook for passkey registration (sign-up and security settings).
 *
 * @returns Register function, loading state, error, and browser support flag
 *
 * @example
 * ```tsx
 * function AddPasskey() {
 *   const { register, isLoading, error, supported } = usePasskeyRegister();
 *
 *   if (!supported) return <p>Passkeys are not supported in this browser.</p>;
 *
 *   const handleAdd = async () => {
 *     const result = await register({ deviceName: 'My Laptop' });
 *     if (result) {
 *       // Passkey registered successfully
 *     }
 *   };
 * }
 * ```
 */
export function usePasskeyRegister(): UsePasskeyRegisterResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(!!window.PublicKeyCredential);
  }, []);

  const register = async (
    options?: PasskeyRegisterOptions,
  ): Promise<PasskeyRegisterResult | null> => {
    if (!supported) {
      setError('Passkeys are not supported in this browser');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Step 1: Get registration options from the server
      const optionsCsrfToken = readCsrfToken();
      const optionsResponse = await fetch('/api/auth/passkey/register-options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(optionsCsrfToken ? { 'X-CSRF-Token': optionsCsrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          email: options?.email,
          name: options?.name,
        }),
      });

      const optionsJson: unknown = await optionsResponse.json();

      if (!optionsResponse.ok) {
        const errorData = optionsJson as { error?: string };
        setError(errorData.error ?? 'Failed to get registration options');
        return null;
      }

      // Step 2: Start browser WebAuthn registration ceremony
      // Server wraps options: { options: { challenge, ... } }
      // @simplewebauthn/browser v13+ expects { optionsJSON: ... }
      const { startRegistration } = await import('@simplewebauthn/browser');
      const optionsData = optionsJson as {
        options: Parameters<typeof startRegistration>[0]['optionsJSON'];
      };
      const attestationResponse = await startRegistration({ optionsJSON: optionsData.options });

      // Step 3: Verify with the server
      const verifyCsrfToken = readCsrfToken();
      const verifyResponse = await fetch('/api/auth/passkey/register-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(verifyCsrfToken ? { 'X-CSRF-Token': verifyCsrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          attestationResponse,
          deviceName: options?.deviceName,
        }),
      });

      const verifyJson: unknown = await verifyResponse.json();

      if (!verifyResponse.ok) {
        const errorData = verifyJson as { error?: string };
        setError(errorData.error ?? 'Failed to verify passkey registration');
        return null;
      }

      const result = verifyJson as PasskeyRegisterResult;
      return result;
    } catch (err) {
      // Handle user cancellation of the WebAuthn ceremony
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Passkey registration was cancelled');
        return null;
      }
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    register,
    isLoading,
    error,
    supported,
  };
}

export interface UsePasskeySignInResult {
  /** Authenticate with a passkey */
  signIn: () => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  /** Whether the browser supports WebAuthn */
  supported: boolean;
}

/**
 * Hook for passkey authentication (login page).
 *
 * @returns Sign-in function, loading state, error, and browser support flag
 *
 * @example
 * ```tsx
 * function LoginPage() {
 *   const { signIn, isLoading, error, supported } = usePasskeySignIn();
 *
 *   const handlePasskeyLogin = async () => {
 *     const success = await signIn();
 *     if (success) {
 *       router.push('/admin');
 *     }
 *   };
 *
 *   return (
 *     <>
 *       {supported && (
 *         <button onClick={handlePasskeyLogin} disabled={isLoading}>
 *           Sign in with Passkey
 *         </button>
 *       )}
 *       {error && <p>{error}</p>}
 *     </>
 *   );
 * }
 * ```
 */
export function usePasskeySignIn(): UsePasskeySignInResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(!!window.PublicKeyCredential);
  }, []);

  const signIn = async (): Promise<boolean> => {
    if (!supported) {
      setError('Passkeys are not supported in this browser');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Step 1: Get authentication options from the server
      const optionsCsrfToken = readCsrfToken();
      const optionsResponse = await fetch('/api/auth/passkey/authenticate-options', {
        method: 'POST',
        credentials: 'include',
        // Conditional headers key keeps cookie-less sign-in requests
        // byte-identical to the pre-CSRF request shape.
        ...(optionsCsrfToken ? { headers: { 'X-CSRF-Token': optionsCsrfToken } } : {}),
      });

      const optionsJson: unknown = await optionsResponse.json();

      if (!optionsResponse.ok) {
        const errorData = optionsJson as { error?: string };
        setError(errorData.error ?? 'Failed to get authentication options');
        return false;
      }

      // Step 2: Start browser WebAuthn authentication ceremony
      // @simplewebauthn/browser v13+ expects { optionsJSON: ... }
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const authOptionsData = optionsJson as {
        options: Parameters<typeof startAuthentication>[0]['optionsJSON'];
      };
      const assertionResponse = await startAuthentication({ optionsJSON: authOptionsData.options });

      // Step 3: Verify with the server
      const verifyCsrfToken = readCsrfToken();
      const verifyResponse = await fetch('/api/auth/passkey/authenticate-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(verifyCsrfToken ? { 'X-CSRF-Token': verifyCsrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ authenticationResponse: assertionResponse }),
      });

      const verifyJson: unknown = await verifyResponse.json();

      if (!verifyResponse.ok) {
        const errorData = verifyJson as { error?: string };
        setError(errorData.error ?? 'Passkey authentication failed');
        return false;
      }

      return true;
    } catch (err) {
      // Handle user cancellation of the WebAuthn ceremony
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Passkey authentication was cancelled');
        return false;
      }
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signIn,
    isLoading,
    error,
    supported,
  };
}
