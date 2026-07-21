'use client';

const SUCCESS_DISMISS_MS = 5_000;
const ERROR_DISMISS_MS = 8_000;

import {
  Button,
  Dialog,
  DialogActions,
  DialogDescription,
  DialogTitle,
} from '@revealui/presentation/client';
import { GitHubIcon, GoogleIcon, VercelIcon } from '@revealui/presentation/server';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/utils/csrf';
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
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="h-5 w-48 animate-pulse rounded bg-foreground/10" />
            <div className="mt-3 h-4 w-72 animate-pulse rounded bg-foreground/10" />
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
      window.history.replaceState(null, '', '/settings/account');
    }
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      window.history.replaceState(null, '', '/settings/account');
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
    const redirectTo = '/settings/account';
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
      const res = await apiFetch('/api/auth/unlink', {
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
          <output className="mb-6 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            <span className="h-2 w-2 rounded-full bg-success" />
            {success}
          </output>
        )}

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
          >
            <span className="h-2 w-2 rounded-full bg-error" />
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <section
            aria-busy="true"
            aria-label="Loading account settings"
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="h-5 w-48 animate-pulse rounded bg-foreground/10" />
            <div className="mt-3 h-4 w-72 animate-pulse rounded bg-foreground/10" />
            <div className="mt-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-foreground/10" />
              ))}
            </div>
          </section>
        )}

        {/* Account info */}
        {!loading && user && (
          <>
            <div className="mb-6 rounded-xl border border-border bg-card p-5">
              <h1 className="text-base font-semibold text-foreground">Account</h1>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Email</span>
                  <span className="truncate text-muted-foreground">{user.email}</span>
                </div>
                {user.name && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="shrink-0 text-muted-foreground">Name</span>
                    <span className="truncate text-muted-foreground">{user.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Role</span>
                  <span className="text-muted-foreground capitalize">{user.role}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="shrink-0 text-muted-foreground">Password</span>
                  <span className={user.hasPassword ? 'text-success' : 'text-muted-foreground'}>
                    {user.hasPassword ? 'Set' : 'Not set'}
                  </span>
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="mb-6 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Password</h2>
                {user.hasPassword && !showPasswordForm && (
                  <Button
                    type="button"
                    variant="neutral"
                    size="sm"
                    onClick={() => setShowPasswordForm(true)}
                    className="text-xs"
                  >
                    Change password
                  </Button>
                )}
              </div>
              {!user.hasPassword ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  No password set.{' '}
                  <a
                    href="/reset-password"
                    className="text-foreground underline hover:no-underline"
                  >
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
                <p className="mt-2 text-sm text-muted-foreground">Password is set.</p>
              )}
            </div>

            {/* Connected accounts */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">Connected Accounts</h2>
              <p className="mt-1 text-sm text-muted-foreground">
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
                      className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="size-5 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">
                            {provider.label}
                          </div>
                          {isLinked && linkedInfo?.email ? (
                            <div className="text-xs text-muted-foreground">
                              {linkedInfo.name ? `${linkedInfo.name} · ` : ''}
                              {linkedInfo.email}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              {provider.description}
                            </div>
                          )}
                        </div>
                      </div>

                      {isLinked ? (
                        <Button
                          type="button"
                          appearance="outline"
                          variant="neutral"
                          size="sm"
                          onClick={() => requestUnlink(provider.id)}
                          disabled={isUnlinking}
                          className="text-xs text-muted-foreground hover:border-error hover:text-error"
                        >
                          {isUnlinking ? 'Unlinking...' : 'Unlink'}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="neutral"
                          size="sm"
                          onClick={() => handleLink(provider.id)}
                          className="text-xs"
                        >
                          Link
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Safety notes */}
              {!user.hasPassword && linkedSet.size === 0 && (
                <p className="mt-4 text-xs text-error">
                  You have no password and no linked accounts. Set a password or link a provider to
                  regain access.
                </p>
              )}
              {!user.hasPassword && linkedSet.size === 1 && (
                <p className="mt-4 text-xs text-warning-foreground">
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
          <Button
            type="button"
            appearance="ghost"
            variant="neutral"
            onClick={cancelUnlink}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={() => void confirmUnlink()}>
            Unlink
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
