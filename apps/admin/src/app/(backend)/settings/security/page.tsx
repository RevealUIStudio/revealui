'use client';

const SUCCESS_DISMISS_MS = 5_000;
const ERROR_DISMISS_MS = 8_000;

import { useMFASetup, usePasskeyRegister } from '@revealui/auth/react';
import { Input } from '@revealui/presentation';
import {
  Dialog,
  DialogActions,
  DialogDescription,
  DialogTitle,
  Field,
  Label,
} from '@revealui/presentation/client';
import { QRCodeSVG } from 'qrcode.react';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/utils/csrf';

// =============================================================================
// Types
// =============================================================================

interface MFAStatus {
  enabled: boolean;
  backupCodesRemaining?: number;
}

interface Passkey {
  id: string;
  deviceName: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ActiveSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActivityAt: string;
  createdAt: string;
  isCurrent: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_PASSKEYS = 10;

// =============================================================================
// Page component
// =============================================================================

export default function SecuritySettingsPage() {
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
      <SecuritySettingsContent />
    </Suspense>
  );
}

// =============================================================================
// Content component
// =============================================================================

function SecuritySettingsContent() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sessions state
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // MFA state
  const [mfaStatus, setMfaStatus] = useState<MFAStatus | null>(null);
  const [setupData, setSetupData] = useState<{
    uri: string;
    backupCodes: string[];
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regeneratedCodes, setRegeneratedCodes] = useState<string[] | null>(null);

  // Passkey state
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const pendingDeleteId = useRef<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Hooks
  const { setup, verifySetup, isLoading: mfaLoading, error: mfaError } = useMFASetup();
  const {
    register,
    isLoading: passkeyLoading,
    error: passkeyError,
    supported: passkeySupported,
  } = usePasskeyRegister();

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchMFAStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/mfa/status', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as MFAStatus;
        setMfaStatus(data);
      }
    } catch {
      // Silently fail  -  status will show as loading
    }
  }, []);

  const fetchPasskeys = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/passkey/list', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { passkeys: Passkey[] };
        setPasskeys(data.passkeys);
      }
    } catch {
      // Silently fail
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/sessions', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as {
          currentSessionId: string;
          sessions: ActiveSession[];
        };
        setActiveSessions(data.sessions.sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : 0)));
      }
    } catch {
      // Silently fail  -  non-critical
    }
  }, []);

  useEffect(() => {
    void Promise.all([fetchMFAStatus(), fetchPasskeys(), fetchSessions()]).finally(() =>
      setLoading(false),
    );
  }, [fetchMFAStatus, fetchPasskeys, fetchSessions]);

  async function revokeSession(sessionId: string) {
    setRevokingId(sessionId);
    setError(null);
    try {
      const res = await apiFetch(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        setSuccess('Session revoked.');
        await fetchSessions();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(
          data.error ?? 'Unable to revoke session. Contact support@revealui.com if this persists.',
        );
      }
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setRevokingId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Auto-dismiss messages
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // MFA handlers
  // ---------------------------------------------------------------------------
  async function handleEnableMFA() {
    const data = await setup();
    if (data) {
      setSetupData({ uri: data.uri, backupCodes: data.backupCodes });
    }
  }

  async function handleVerifySetup() {
    const ok = await verifySetup(verifyCode);
    if (ok) {
      setSetupData(null);
      setVerifyCode('');
      setSuccess('Two-factor authentication enabled successfully.');
      await fetchMFAStatus();
    }
  }

  function cancelSetup() {
    setSetupData(null);
    setVerifyCode('');
  }

  async function handleDisableMFA() {
    if (!disablePassword.trim()) {
      setError('Password is required to disable 2FA.');
      return;
    }

    setDisabling(true);
    try {
      const res = await apiFetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: disablePassword }),
      });

      if (res.ok) {
        setShowDisableForm(false);
        setDisablePassword('');
        setSuccess('Two-factor authentication disabled.');
        await fetchMFAStatus();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(
          data.error ?? 'Unable to disable 2FA. Contact support@revealui.com if this persists.',
        );
      }
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setDisabling(false);
    }
  }

  async function handleRegenerateCodes() {
    setRegenerating(true);
    try {
      const res = await apiFetch('/api/auth/mfa/regenerate', {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        const data = (await res.json()) as { success: boolean; backupCodes: string[] };
        setRegeneratedCodes(data.backupCodes);
        setSuccess('Backup codes regenerated. Save them in a secure place.');
        await fetchMFAStatus();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(
          data.error ??
            'Unable to regenerate backup codes. Contact support@revealui.com if this persists.',
        );
      }
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setRegenerating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Passkey handlers
  // ---------------------------------------------------------------------------
  async function handleAddPasskey() {
    const result = await register({ deviceName: 'New passkey' });
    if (result) {
      setSuccess('Passkey added successfully.');
      await fetchPasskeys();
    }
  }

  function startRename(passkey: Passkey) {
    setRenamingId(passkey.id);
    setRenameValue(passkey.deviceName ?? '');
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue('');
  }

  async function submitRename(id: string) {
    if (!renameValue.trim()) return;

    try {
      const res = await apiFetch(`/api/auth/passkey/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ deviceName: renameValue.trim() }),
      });

      if (res.ok) {
        setRenamingId(null);
        setRenameValue('');
        setSuccess('Passkey renamed.');
        await fetchPasskeys();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(
          data.error ?? 'Unable to rename passkey. Contact support@revealui.com if this persists.',
        );
      }
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    }
  }

  function requestDelete(id: string) {
    pendingDeleteId.current = id;
    setDeleteConfirmOpen(true);
  }

  function cancelDelete() {
    setDeleteConfirmOpen(false);
    pendingDeleteId.current = null;
  }

  async function confirmDelete() {
    const id = pendingDeleteId.current;
    if (!id) return;

    setDeleteConfirmOpen(false);
    pendingDeleteId.current = null;
    setDeletingId(id);

    try {
      const res = await apiFetch(`/api/auth/passkey/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setSuccess('Passkey removed.');
        await fetchPasskeys();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(
          data.error ?? 'Unable to remove passkey. Contact support@revealui.com if this persists.',
        );
      }
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setDeletingId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatRelative(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function parseUserAgent(ua: string): string {
    if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) return 'iOS device';
    if (ua.includes('Android')) return 'Android device';
    if (ua.includes('Windows') && ua.includes('Chrome')) return 'Chrome on Windows';
    if (ua.includes('Macintosh') && ua.includes('Chrome')) return 'Chrome on Mac';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Windows')) return 'Windows browser';
    if (ua.includes('Macintosh')) return 'Mac browser';
    if (ua.includes('Linux')) return 'Linux browser';
    return 'Unknown device';
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
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
        {(error || mfaError || passkeyError) && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
          >
            <span className="h-2 w-2 rounded-full bg-error" />
            {error || mfaError || passkeyError}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <section
            aria-busy="true"
            aria-label="Loading security settings"
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

        {/* Content */}
        {!loading && (
          <>
            {/* ============================================================= */}
            {/* Section 1: Two-Factor Authentication                          */}
            {/* ============================================================= */}
            <div className="mb-6 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h1 className="text-base font-semibold text-foreground">
                  Two-Factor Authentication
                </h1>
                {mfaStatus && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      mfaStatus.enabled
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        mfaStatus.enabled ? 'bg-success' : 'bg-muted-foreground'
                      }`}
                    />
                    {mfaStatus.enabled ? 'Enabled' : 'Not configured'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Add an extra layer of security by requiring a one-time code from your authenticator
                app.
              </p>

              {/* Setup flow */}
              {setupData && (
                <div className="mt-5 space-y-4">
                  {/* OTP URI */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Copy this URI into your authenticator app
                    </p>
                    <div className="mt-2 flex justify-center rounded-lg border border-border bg-white p-4">
                      <QRCodeSVG value={setupData.uri} size={200} level="M" />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Or copy the URI manually:</p>
                    <div className="mt-1 rounded-lg border border-border bg-muted p-3">
                      <code className="block break-all text-xs text-muted-foreground">
                        {setupData.uri}
                      </code>
                    </div>
                  </div>

                  {/* Backup codes */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Backup codes - save these in a secure place
                    </p>
                    <div className="mt-1 grid grid-cols-1 gap-1.5 rounded-lg border border-border bg-muted p-3 sm:grid-cols-2">
                      {setupData.backupCodes.map((code) => (
                        <code key={code} className="text-xs font-mono text-muted-foreground">
                          {code}
                        </code>
                      ))}
                    </div>
                  </div>

                  {/* Verification */}
                  <Field>
                    <Label className="text-xs font-medium text-muted-foreground">
                      Enter a code from your authenticator app to verify
                    </Label>
                    <div className="mt-1 flex gap-2">
                      <Input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={verifyCode}
                        onChange={(e) =>
                          setVerifyCode(
                            [...e.target.value].filter((c) => c >= '0' && c <= '9').join(''),
                          )
                        }
                        placeholder="000000"
                        className="w-32"
                      />
                      <button
                        type="button"
                        onClick={() => void handleVerifySetup()}
                        disabled={verifyCode.length !== 6 || mfaLoading}
                        className="rounded-md bg-success px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {mfaLoading ? 'Verifying...' : 'Verify'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelSetup}
                        className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  </Field>
                </div>
              )}

              {/* Actions when not in setup flow */}
              {!setupData && (
                <div className="mt-5">
                  {mfaStatus && !mfaStatus.enabled && (
                    <button
                      type="button"
                      onClick={() => void handleEnableMFA()}
                      disabled={mfaLoading}
                      className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {mfaLoading ? 'Setting up...' : 'Enable 2FA'}
                    </button>
                  )}

                  {mfaStatus?.enabled && (
                    <div className="space-y-3">
                      {/* Disable 2FA */}
                      {showDisableForm ? (
                        <div className="rounded-lg border border-border p-3">
                          <Field>
                            <Label className="text-xs font-medium text-muted-foreground">
                              Confirm your password to disable 2FA
                            </Label>
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              <Input
                                type="password"
                                value={disablePassword}
                                onChange={(e) => setDisablePassword(e.target.value)}
                                placeholder="Password"
                                className="w-full sm:w-48"
                              />
                              <button
                                type="button"
                                onClick={() => void handleDisableMFA()}
                                disabled={disabling || !disablePassword.trim()}
                                className="rounded-md bg-error px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {disabling ? 'Disabling...' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowDisableForm(false);
                                  setDisablePassword('');
                                }}
                                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                          </Field>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowDisableForm(true)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-error/50 hover:text-error"
                        >
                          Disable 2FA
                        </button>
                      )}

                      {/* Regenerate backup codes */}
                      <div>
                        <button
                          type="button"
                          onClick={() => void handleRegenerateCodes()}
                          disabled={regenerating}
                          className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {regenerating ? 'Regenerating...' : 'Regenerate backup codes'}
                        </button>
                      </div>

                      {/* Show regenerated codes */}
                      {regeneratedCodes && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">
                            New backup codes - save these in a secure place
                          </p>
                          <div className="mt-1 grid grid-cols-1 gap-1.5 rounded-lg border border-border bg-muted p-3 sm:grid-cols-2">
                            {regeneratedCodes.map((code) => (
                              <code key={code} className="text-xs font-mono text-muted-foreground">
                                {code}
                              </code>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setRegeneratedCodes(null)}
                            className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ============================================================= */}
            {/* Section 2: Passkeys                                           */}
            {/* ============================================================= */}
            <div className="mb-6 rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Passkeys</h2>
                <span className="text-xs text-muted-foreground">
                  {passkeys.length} of {MAX_PASSKEYS} passkeys
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Passkeys let you sign in securely without a password using biometrics or a security
                key.
              </p>

              {/* Passkey list */}
              {passkeys.length > 0 && (
                <div className="mt-5 space-y-3">
                  {passkeys.map((passkey) => (
                    <div
                      key={passkey.id}
                      className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          className="h-5 w-5 text-muted-foreground"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                          />
                        </svg>
                        <div>
                          {renamingId === passkey.id ? (
                            <div className="flex gap-1.5">
                              <Input
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void submitRename(passkey.id);
                                  if (e.key === 'Escape') cancelRename();
                                }}
                                className="w-36"
                              />
                              <button
                                type="button"
                                onClick={() => void submitRename(passkey.id)}
                                className="text-xs text-success hover:text-success/80"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelRename}
                                className="text-xs text-muted-foreground hover:text-foreground"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="text-sm font-medium text-muted-foreground">
                              {passkey.deviceName ?? 'Unnamed passkey'}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Added {formatDate(passkey.createdAt)}
                            {passkey.lastUsedAt && ` · Last used ${formatDate(passkey.lastUsedAt)}`}
                          </div>
                        </div>
                      </div>

                      {renamingId !== passkey.id && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startRename(passkey)}
                            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(passkey.id)}
                            disabled={deletingId === passkey.id}
                            className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingId === passkey.id ? 'Removing...' : 'Remove'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add passkey button */}
              <div className="mt-5">
                {!passkeySupported ? (
                  <p className="text-xs text-muted-foreground">
                    Passkeys are not supported in this browser.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleAddPasskey()}
                    disabled={passkeyLoading || passkeys.length >= MAX_PASSKEYS}
                    className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {passkeyLoading ? 'Adding...' : 'Add passkey'}
                  </button>
                )}
                {passkeys.length >= MAX_PASSKEYS && (
                  <p className="mt-2 text-xs text-warning-foreground/80">
                    Maximum number of passkeys reached. Remove one to add another.
                  </p>
                )}
              </div>
            </div>

            {/* ============================================================= */}
            {/* Section 3: Account Recovery                                   */}
            {/* ============================================================= */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">Account Recovery</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                If you lose access to all your devices, you can recover your account via email magic
                link.
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Backup codes remaining</span>
                  <span
                    className={
                      mfaStatus?.backupCodesRemaining ? 'text-foreground' : 'text-muted-foreground'
                    }
                  >
                    {mfaStatus?.enabled
                      ? (mfaStatus.backupCodesRemaining ?? 'Unknown')
                      : 'N/A  -  2FA not enabled'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email recovery</span>
                  <span className="text-success">Available</span>
                </div>
              </div>
              {mfaStatus?.enabled &&
                mfaStatus.backupCodesRemaining !== undefined &&
                mfaStatus.backupCodesRemaining <= 2 && (
                  <p className="mt-4 text-xs text-warning-foreground/80">
                    You have few backup codes remaining. Consider regenerating them above.
                  </p>
                )}
            </div>

            {/* ============================================================= */}
            {/* Section 4: Active Sessions                                    */}
            {/* ============================================================= */}
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">Active Sessions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Devices and browsers currently signed in to your account.
              </p>

              {activeSessions.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No other sessions found.</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {activeSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-start justify-between rounded-lg border border-border px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm text-muted-foreground">
                            {session.userAgent
                              ? parseUserAgent(session.userAgent)
                              : 'Unknown device'}
                          </span>
                          {session.isCurrent && (
                            <span className="shrink-0 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {session.ipAddress && <span>{session.ipAddress} · </span>}
                          Last active {formatRelative(session.lastActivityAt)}
                        </div>
                      </div>
                      {!session.isCurrent && (
                        <button
                          type="button"
                          onClick={() => void revokeSession(session.id)}
                          disabled={revokingId === session.id}
                          aria-label="Revoke this session"
                          className="ml-4 shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-error/50 hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {revokingId === session.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeSessions.filter((s) => !s.isCurrent).length > 1 && (
                <button
                  type="button"
                  onClick={async () => {
                    const others = activeSessions.filter((s) => !s.isCurrent);
                    for (const s of others) {
                      if (!revokingId) await revokeSession(s.id);
                    }
                  }}
                  disabled={!!revokingId}
                  className="mt-4 text-xs text-error hover:text-error/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Revoke all other sessions
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Delete passkey confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onClose={cancelDelete} size="sm">
        <DialogTitle>Remove passkey?</DialogTitle>
        <DialogDescription>
          This passkey will be permanently removed. You will no longer be able to sign in with it.
        </DialogDescription>
        <DialogActions>
          <button
            type="button"
            onClick={cancelDelete}
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirmDelete()}
            className="rounded-md bg-error px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-error/90"
          >
            Remove
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
