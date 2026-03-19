/**
 * Passkey Hooks
 *
 * React hooks for WebAuthn passkey registration and authentication.
 * Uses dynamic imports for @simplewebauthn/browser to avoid SSR issues.
 */

'use client';

import { useEffect, useState } from 'react';

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
      const optionsResponse = await fetch('/api/auth/passkey/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const verifyResponse = await fetch('/api/auth/passkey/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const supported = typeof window !== 'undefined' && !!window.PublicKeyCredential;

  const signIn = async (): Promise<boolean> => {
    if (!supported) {
      setError('Passkeys are not supported in this browser');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Step 1: Get authentication options from the server
      const optionsResponse = await fetch('/api/auth/passkey/authenticate-options', {
        method: 'POST',
        credentials: 'include',
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
      const verifyResponse = await fetch('/api/auth/passkey/authenticate-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ assertion: assertionResponse }),
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
