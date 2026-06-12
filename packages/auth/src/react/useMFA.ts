/**
 * MFA Hooks
 *
 * React hooks for Multi-Factor Authentication setup and verification.
 *
 * CSRF: every POST echoes the JS-readable `revealui-csrf` cookie (the signed
 * double-submit token the RevealUI admin proxy issues on page load) as an
 * `X-CSRF-Token` header when the cookie is present. The proxy requires it on
 * session-cookie-bearing unsafe requests and `/api/auth/mfa/*` is not exempt —
 * MFA enrollment always runs with a session, so without the header it 403s
 * ("CSRF token missing"). Cookie-less callers send no header and are
 * unchanged.
 */

'use client';

import { useState } from 'react';
import { readCsrfToken } from './csrf.js';

/**
 * MFA setup data returned when initiating TOTP setup.
 */
export interface MFASetupData {
  /** Base32-encoded TOTP secret */
  secret: string;
  /** otpauth:// URI for QR code generation */
  uri: string;
  /** One-time backup codes for account recovery */
  backupCodes: string[];
}

export interface UseMFASetupResult {
  /** Initiate MFA setup  -  returns secret, QR URI, and backup codes */
  setup: () => Promise<MFASetupData | null>;
  /** Verify a TOTP code to confirm setup */
  verifySetup: (code: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for MFA setup on the security settings page.
 *
 * @returns Setup and verify functions, loading state, and error
 *
 * @example
 * ```tsx
 * function SecuritySettings() {
 *   const { setup, verifySetup, isLoading, error } = useMFASetup();
 *
 *   const handleEnable = async () => {
 *     const data = await setup();
 *     if (data) {
 *       // Show QR code using data.uri, display backup codes
 *     }
 *   };
 *
 *   const handleVerify = async (code: string) => {
 *     const success = await verifySetup(code);
 *     if (success) {
 *       // MFA is now enabled
 *     }
 *   };
 * }
 * ```
 */
export function useMFASetup(): UseMFASetupResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setup = async (): Promise<MFASetupData | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const csrfToken = readCsrfToken();
      const response = await fetch('/api/auth/mfa/setup', {
        method: 'POST',
        credentials: 'include',
        // Conditional headers key keeps cookie-less setup requests
        // byte-identical to the pre-CSRF request shape.
        ...(csrfToken ? { headers: { 'X-CSRF-Token': csrfToken } } : {}),
      });

      const json: unknown = await response.json();

      if (!response.ok) {
        const errorData = json as { error?: string };
        setError(errorData.error ?? 'Failed to set up MFA');
        return null;
      }

      const data = json as MFASetupData;
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const verifySetup = async (code: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const csrfToken = readCsrfToken();
      const response = await fetch('/api/auth/mfa/verify-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });

      const json: unknown = await response.json();

      if (!response.ok) {
        const errorData = json as { error?: string };
        setError(errorData.error ?? 'Failed to verify MFA code');
        return false;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    setup,
    verifySetup,
    isLoading,
    error,
  };
}

export interface UseMFAVerifyResult {
  /** Verify a TOTP code during login */
  verify: (code: string) => Promise<boolean>;
  /** Verify a backup code during login */
  verifyBackupCode: (code: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for MFA verification during the login flow.
 *
 * After sign-in returns `requiresMfa: true`, redirect to the MFA page
 * and use this hook to complete authentication.
 *
 * @returns Verify functions, loading state, and error
 *
 * @example
 * ```tsx
 * function MFAPage() {
 *   const { verify, verifyBackupCode, isLoading, error } = useMFAVerify();
 *
 *   const handleSubmit = async (code: string) => {
 *     const success = await verify(code);
 *     if (success) {
 *       // Full navigation: a soft router.push() would replay the pre-auth Router Cache
 *       window.location.href = '/admin';
 *     }
 *   };
 * }
 * ```
 */
export function useMFAVerify(): UseMFAVerifyResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verify = async (code: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const csrfToken = readCsrfToken();
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });

      const json: unknown = await response.json();

      if (!response.ok) {
        const errorData = json as { error?: string };
        setError(errorData.error ?? 'Invalid verification code');
        return false;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyBackupCode = async (code: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const csrfToken = readCsrfToken();
      const response = await fetch('/api/auth/mfa/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });

      const json: unknown = await response.json();

      if (!response.ok) {
        const errorData = json as { error?: string };
        setError(errorData.error ?? 'Invalid backup code');
        return false;
      }

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    verify,
    verifyBackupCode,
    isLoading,
    error,
  };
}
