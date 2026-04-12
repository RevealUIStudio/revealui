/**
 * Studio Auth Context
 *
 * Manages device-based authentication state. Token is stored in:
 * - Tauri vault (desktop) via vault_set/vault_get
 * - localStorage (browser dev mode) as fallback
 *
 * On mount, checks for a stored token and validates it against the API.
 * Provides link (send OTP), verify (submit OTP), and signOut actions.
 */

import { createContext, use, useEffect, useRef, useState } from 'react';
import { checkStatus, linkDevice, refreshToken, revokeToken, verifyDevice } from '../lib/auth-api';
import { vaultGet, vaultSet } from '../lib/invoke';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export type AuthStep = 'idle' | 'email' | 'otp' | 'authenticated';

export interface AuthContextValue {
  /** Current auth step in the flow */
  step: AuthStep;
  /** Authenticated user (null when not authenticated) */
  user: AuthUser | null;
  /** Token expiry (ISO string) */
  tokenExpiresAt: string | null;
  /** Loading state (initial check or in-flight request) */
  loading: boolean;
  /** Error message from the last operation */
  error: string | null;
  /** Start the login flow  -  sends OTP to email */
  sendOtp: (apiUrl: string, email: string) => Promise<boolean>;
  /** Submit OTP code  -  returns true on success */
  submitOtp: (apiUrl: string, email: string, code: string) => Promise<boolean>;
  /** Sign out  -  revokes token and clears state */
  signOut: (apiUrl: string) => Promise<void>;
  /** Re-check auth status against the API */
  recheck: (apiUrl: string) => Promise<void>;
  /** Returns the current bearer token (null when not authenticated) */
  getToken: () => string | null;
}

// ── Token Storage ───────────────────────────────────────────────────────────

const VAULT_TOKEN_PATH = 'studio/device-token';
const LS_TOKEN_KEY = 'revealui-studio-token';

async function loadToken(): Promise<string | null> {
  try {
    return await vaultGet(VAULT_TOKEN_PATH);
  } catch {
    // Vault unavailable (browser mode)  -  fall back to localStorage
    return localStorage.getItem(LS_TOKEN_KEY);
  }
}

async function saveToken(token: string): Promise<void> {
  try {
    await vaultSet(VAULT_TOKEN_PATH, token, true);
  } catch {
    localStorage.setItem(LS_TOKEN_KEY, token);
  }
}

async function clearToken(): Promise<void> {
  try {
    // Can't delete from vault, overwrite with empty
    await vaultSet(VAULT_TOKEN_PATH, '', true);
  } catch {
    // ignore
  }
  localStorage.removeItem(LS_TOKEN_KEY);
}

// ── Context ─────────────────────────────────────────────────────────────────

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider');
  return ctx;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(apiUrl: string): AuthContextValue {
  const [step, setStep] = useState<AuthStep>('idle');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Check stored token on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await loadToken();
        if (!token || cancelled) {
          setStep('email');
          setLoading(false);
          return;
        }
        tokenRef.current = token;

        const status = await checkStatus(apiUrl, token);
        if (cancelled) return;

        if (status.authenticated && status.user) {
          setUser(status.user as AuthUser);
          setTokenExpiresAt(status.tokenExpiresAt ?? null);
          setStep('authenticated');
        } else {
          await clearToken();
          tokenRef.current = null;
          setStep('email');
        }
      } catch {
        // API unreachable  -  allow offline access if token exists
        if (tokenRef.current) {
          setStep('authenticated');
        } else {
          setStep('email');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  // Auto-refresh token when it's within 7 days of expiry
  useEffect(() => {
    if (step !== 'authenticated' || !tokenExpiresAt || !tokenRef.current) return;

    const expiresMs = new Date(tokenExpiresAt).getTime();
    const refreshAt = expiresMs - 7 * 24 * 60 * 60 * 1000; // 7 days before expiry
    const delay = refreshAt - Date.now();

    if (delay <= 0) {
      // Already within refresh window  -  refresh now
      refreshToken(apiUrl, tokenRef.current)
        .then(async (res) => {
          if (res.success && res.token) {
            tokenRef.current = res.token;
            await saveToken(res.token);
            setTokenExpiresAt(res.expiresAt ?? null);
          }
        })
        .catch(() => {
          /* best-effort refresh */
        });
      return;
    }

    const timer = setTimeout(() => {
      if (tokenRef.current) {
        refreshToken(apiUrl, tokenRef.current)
          .then(async (res) => {
            if (res.success && res.token) {
              tokenRef.current = res.token;
              await saveToken(res.token);
              setTokenExpiresAt(res.expiresAt ?? null);
            }
          })
          .catch(() => {
            /* best-effort refresh */
          });
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [step, tokenExpiresAt, apiUrl]);

  async function sendOtp(_apiUrl: string, email: string): Promise<boolean> {
    setError(null);
    setLoading(true);
    try {
      const res = await linkDevice(_apiUrl, email);
      if (res.success) {
        setStep('otp');
        return true;
      }
      setError(res.error ?? 'Failed to send verification code');
      return false;
    } catch {
      setError('Unable to reach the RevealUI API');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(_apiUrl: string, email: string, code: string): Promise<boolean> {
    setError(null);
    setLoading(true);
    try {
      const res = await verifyDevice(_apiUrl, email, code);
      if (res.success && res.token && res.user) {
        tokenRef.current = res.token;
        await saveToken(res.token);
        setUser(res.user as AuthUser);
        setTokenExpiresAt(res.expiresAt ?? null);
        setStep('authenticated');
        return true;
      }
      setError(res.error ?? 'Invalid verification code');
      return false;
    } catch {
      setError('Unable to reach the RevealUI API');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function signOut(_apiUrl: string): Promise<void> {
    if (tokenRef.current) {
      try {
        await revokeToken(_apiUrl, tokenRef.current);
      } catch {
        // Best-effort revoke
      }
    }
    tokenRef.current = null;
    await clearToken();
    setUser(null);
    setTokenExpiresAt(null);
    setStep('email');
    setError(null);
  }

  async function recheck(_apiUrl: string): Promise<void> {
    const token = tokenRef.current;
    if (!token) return;
    try {
      const status = await checkStatus(_apiUrl, token);
      if (status.authenticated && status.user) {
        setUser(status.user as AuthUser);
        setTokenExpiresAt(status.tokenExpiresAt ?? null);
        setStep('authenticated');
      } else {
        await clearToken();
        tokenRef.current = null;
        setUser(null);
        setStep('email');
      }
    } catch {
      // API unreachable  -  keep current state
    }
  }

  function getToken(): string | null {
    return tokenRef.current;
  }

  return {
    step,
    user,
    tokenExpiresAt,
    loading,
    error,
    sendOtp,
    submitOtp,
    signOut,
    recheck,
    getToken,
  };
}
