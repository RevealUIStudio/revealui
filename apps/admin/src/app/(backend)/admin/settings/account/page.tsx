'use client';

const SUCCESS_DISMISS_MS = 5_000;
const ERROR_DISMISS_MS = 8_000;

import {
  Dialog,
  DialogActions,
  DialogDescription,
  DialogTitle,
} from '@revealui/presentation/client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { PasswordChangeForm } from './PasswordChangeForm';

// =============================================================================
// Types
// =============================================================================

type OAuthProvider = 'github' | 'google' | 'vercel';

interface LinkedProvider {
  provider: OAuthProvider;
  email: string | null;
  name: string | null;
}

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  hasPassword: boolean;
  linkedProviders: LinkedProvider[];
}

// =============================================================================
// Provider metadata
// =============================================================================

const PROVIDERS: {
  id: OAuthProvider;
  label: string;
  description: string;
}[] = [
  {
    id: 'github',
    label: 'GitHub',
    description: 'Sign in with your GitHub account',
  },
  {
    id: 'google',
    label: 'Google',
    description: 'Sign in with your Google account',
  },
  {
    id: 'vercel',
    label: 'Vercel',
    description: 'Sign in with your Vercel account',
  },
];

// =============================================================================
// Provider icon SVGs
// =============================================================================

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function VercelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2L2 19.5h20L12 2z" />
    </svg>
  );
}

const PROVIDER_ICONS: Record<OAuthProvider, typeof GitHubIcon> = {
  github: GitHubIcon,
  google: GoogleIcon,
  vercel: VercelIcon,
};

// =============================================================================
// Page component
// =============================================================================

export default function AccountSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 sm:p-6 max-w-lg">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="h-5 w-48 animate-pulse rounded bg-zinc-800" />
            <div className="mt-3 h-4 w-72 animate-pulse rounded bg-zinc-800" />
          </div>
        </div>
      }
    >
      <AccountSettingsContent />
    </Suspense>
  );
}

function AccountSettingsContent() {
  const searchParams = useSearchParams();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState<OAuthProvider | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingUnlink = useRef<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return;
      const data = (await res.json()) as { user: UserProfile };
      setUser(data.user);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  // Handle redirect params from OAuth linking callback
  useEffect(() => {
    const linked = searchParams.get('linked');
    const errorParam = searchParams.get('error');

    if (linked) {
      const label = PROVIDERS.find((p) => p.id === linked)?.label ?? linked;
      setSuccess(`${label} account linked successfully.`);
      // Refresh user data to show the new link
      void fetchUser();
      // Clean URL without triggering navigation
      window.history.replaceState(null, '', '/admin/settings/account');
    }
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      window.history.replaceState(null, '', '/admin/settings/account');
    }
  }, [searchParams, fetchUser]);

  // Auto-dismiss messages
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), SUCCESS_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), ERROR_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [error]);

  function handleLink(provider: OAuthProvider) {
    const redirectTo = '/admin/settings/account';
    window.location.href = `/api/auth/link/${provider}?redirectTo=${encodeURIComponent(redirectTo)}`;
  }

  function requestUnlink(provider: OAuthProvider) {
    pendingUnlink.current = provider;
    setConfirmOpen(true);
  }

  function cancelUnlink() {
    setConfirmOpen(false);
    pendingUnlink.current = null;
  }

  async function confirmUnlink() {
    const provider = pendingUnlink.current;
    if (!provider) return;

    setConfirmOpen(false);
    pendingUnlink.current = null;
    setUnlinking(provider);
    setError(null);

    try {
      const res = await fetch('/api/auth/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });

      if (res.ok) {
        const label = PROVIDERS.find((p) => p.id === provider)?.label ?? provider;
        setSuccess(`${label} account unlinked.`);
        await fetchUser();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(
          data.error ?? 'Unable to unlink account. Contact support@revealui.com if this persists.',
        );
      }
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setUnlinking(null);
    }
  }

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const handlePasswordSuccess = useCallback(() => {
    setShowPasswordForm(false);
    setSuccess('Password updated successfully.');
    void fetchUser();
  }, [fetchUser]);

  const linkedSet = new Set(user?.linkedProviders.map((lp) => lp.provider) ?? []);
  const pendingLabel =
    PROVIDERS.find((p) => p.id === pendingUnlink.current)?.label ?? pendingUnlink.current ?? '';

  return (
    <div className="min-h-screen">
      <div className="p-4 sm:p-6 max-w-lg">
        {/* Success banner */}
        {success && (
          <output className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {success}
          </output>
        )}

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-400"
          >
            <span className="h-2 w-2 rounded-full bg-red-400" />
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <section
            aria-busy="true"
            aria-label="Loading account settings"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <div className="h-5 w-48 animate-pulse rounded bg-zinc-800" />
            <div className="mt-3 h-4 w-72 animate-pulse rounded bg-zinc-800" />
            <div className="mt-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-800" />
              ))}
            </div>
          </section>
        )}

        {/* Account info */}
        {!loading && user && (
          <>
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h1 className="text-base font-semibold text-white">Account</h1>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="shrink-0 text-zinc-400">Email</span>
                  <span className="truncate text-zinc-200">{user.email}</span>
                </div>
                {user.name && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="shrink-0 text-zinc-400">Name</span>
                    <span className="truncate text-zinc-200">{user.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4">
                  <span className="shrink-0 text-zinc-400">Role</span>
                  <span className="text-zinc-200 capitalize">{user.role}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="shrink-0 text-zinc-400">Password</span>
                  <span className={user.hasPassword ? 'text-emerald-400' : 'text-zinc-500'}>
                    {user.hasPassword ? 'Set' : 'Not set'}
                  </span>
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Password</h2>
                {user.hasPassword && !showPasswordForm && (
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(true)}
                    className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
                  >
                    Change password
                  </button>
                )}
              </div>
              {!user.hasPassword ? (
                <p className="mt-2 text-sm text-zinc-400">
                  No password set.{' '}
                  <a href="/reset-password" className="text-zinc-200 underline hover:no-underline">
                    Use password reset
                  </a>{' '}
                  to set one.
                </p>
              ) : showPasswordForm ? (
                <PasswordChangeForm
                  onSuccess={handlePasswordSuccess}
                  onCancel={() => setShowPasswordForm(false)}
                />
              ) : (
                <p className="mt-2 text-sm text-zinc-400">Password is set.</p>
              )}
            </div>

            {/* Connected accounts */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-base font-semibold text-white">Connected Accounts</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Link accounts to enable single sign-on. You must keep at least one sign-in method
                active.
              </p>

              <div className="mt-5 space-y-3">
                {PROVIDERS.map((provider) => {
                  const isLinked = linkedSet.has(provider.id);
                  const linkedInfo = user.linkedProviders.find((lp) => lp.provider === provider.id);
                  const isUnlinking = unlinking === provider.id;
                  const Icon = PROVIDER_ICONS[provider.id];

                  return (
                    <div
                      key={provider.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-zinc-400" />
                        <div>
                          <div className="text-sm font-medium text-zinc-200">{provider.label}</div>
                          {isLinked && linkedInfo?.email ? (
                            <div className="text-xs text-zinc-500">
                              {linkedInfo.name ? `${linkedInfo.name} · ` : ''}
                              {linkedInfo.email}
                            </div>
                          ) : (
                            <div className="text-xs text-zinc-600">{provider.description}</div>
                          )}
                        </div>
                      </div>

                      {isLinked ? (
                        <button
                          type="button"
                          onClick={() => requestUnlink(provider.id)}
                          disabled={isUnlinking}
                          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-red-700 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isUnlinking ? 'Unlinking...' : 'Unlink'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleLink(provider.id)}
                          className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700"
                        >
                          Link
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Safety notes */}
              {!user.hasPassword && linkedSet.size === 0 && (
                <p className="mt-4 text-xs text-red-400">
                  You have no password and no linked accounts. Set a password or link a provider to
                  regain access.
                </p>
              )}
              {!user.hasPassword && linkedSet.size === 1 && (
                <p className="mt-4 text-xs text-amber-400/80">
                  You have no password set. Unlinking your only connected account will lock you out.
                  Set a password first or link another provider.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Unlink confirmation dialog */}
      <Dialog open={confirmOpen} onClose={cancelUnlink} size="sm">
        <DialogTitle>Unlink {pendingLabel}?</DialogTitle>
        <DialogDescription>
          You'll no longer be able to sign in with this account.
        </DialogDescription>
        <DialogActions>
          <button
            type="button"
            onClick={cancelUnlink}
            className="rounded-md px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirmUnlink()}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Unlink
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
