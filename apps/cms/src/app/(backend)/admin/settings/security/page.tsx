'use client';

import { useMFASetup, usePasskeyRegister } from '@revealui/auth/react';
import {
  Dialog,
  DialogActions,
  DialogDescription,
  DialogTitle,
} from '@revealui/presentation/client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

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
        <div className="p-6 max-w-lg">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="h-5 w-48 animate-pulse rounded bg-zinc-800" />
            <div className="mt-3 h-4 w-72 animate-pulse rounded bg-zinc-800" />
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
      // Silently fail — status will show as loading
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

  useEffect(() => {
    void Promise.all([fetchMFAStatus(), fetchPasskeys()]).finally(() => setLoading(false));
  }, [fetchMFAStatus, fetchPasskeys]);

  // ---------------------------------------------------------------------------
  // Auto-dismiss messages
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(null), 5000);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 8000);
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
      const res = await fetch('/api/auth/mfa/disable', {
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
        setError(data.error ?? 'Failed to disable 2FA.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setDisabling(false);
    }
  }

  async function handleRegenerateCodes() {
    setRegenerating(true);
    try {
      const res = await fetch('/api/auth/mfa/regenerate', {
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
        setError(data.error ?? 'Failed to regenerate backup codes.');
      }
    } catch {
      setError('Network error. Please try again.');
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
      const res = await fetch(`/api/auth/passkey/${id}`, {
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
        setError(data.error ?? 'Failed to rename passkey.');
      }
    } catch {
      setError('Network error. Please try again.');
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
      const res = await fetch(`/api/auth/passkey/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        setSuccess('Passkey removed.');
        await fetchPasskeys();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? 'Failed to delete passkey.');
      }
    } catch {
      setError('Network error. Please try again.');
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen">
      <div className="p-6 max-w-lg">
        {/* Success banner */}
        {success && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {success}
          </div>
        )}

        {/* Error banner */}
        {(error || mfaError || passkeyError) && (
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            {error || mfaError || passkeyError}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="h-5 w-48 animate-pulse rounded bg-zinc-800" />
            <div className="mt-3 h-4 w-72 animate-pulse rounded bg-zinc-800" />
            <div className="mt-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-800" />
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && (
          <>
            {/* ============================================================= */}
            {/* Section 1: Two-Factor Authentication                          */}
            {/* ============================================================= */}
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center justify-between">
                <h1 className="text-base font-semibold text-white">Two-Factor Authentication</h1>
                {mfaStatus && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      mfaStatus.enabled
                        ? 'bg-emerald-900/30 text-emerald-400'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        mfaStatus.enabled ? 'bg-emerald-400' : 'bg-zinc-500'
                      }`}
                    />
                    {mfaStatus.enabled ? 'Enabled' : 'Not configured'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                Add an extra layer of security by requiring a one-time code from your authenticator
                app.
              </p>

              {/* Setup flow */}
              {setupData && (
                <div className="mt-5 space-y-4">
                  {/* OTP URI */}
                  <div>
                    <p className="text-xs font-medium text-zinc-400">
                      Copy this URI into your authenticator app
                    </p>
                    {/* TODO: Add QR code rendering with qrcode.react */}
                    <div className="mt-1 rounded-lg border border-zinc-700 bg-zinc-950 p-3">
                      <code className="block break-all text-xs text-zinc-300">{setupData.uri}</code>
                    </div>
                  </div>

                  {/* Backup codes */}
                  <div>
                    <p className="text-xs font-medium text-zinc-400">
                      Backup codes — save these in a secure place
                    </p>
                    <div className="mt-1 grid grid-cols-2 gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 p-3">
                      {setupData.backupCodes.map((code) => (
                        <code key={code} className="text-xs font-mono text-zinc-300">
                          {code}
                        </code>
                      ))}
                    </div>
                  </div>

                  {/* Verification */}
                  <div>
                    <label htmlFor="mfa-verify-code" className="text-xs font-medium text-zinc-400">
                      Enter a code from your authenticator app to verify
                    </label>
                    <div className="mt-1 flex gap-2">
                      <input
                        id="mfa-verify-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="w-32 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void handleVerifySetup()}
                        disabled={verifyCode.length !== 6 || mfaLoading}
                        className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {mfaLoading ? 'Verifying...' : 'Verify'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelSetup}
                        className="rounded-md px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
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
                      className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {mfaLoading ? 'Setting up...' : 'Enable 2FA'}
                    </button>
                  )}

                  {mfaStatus?.enabled && (
                    <div className="space-y-3">
                      {/* Disable 2FA */}
                      {showDisableForm ? (
                        <div className="rounded-lg border border-zinc-700 p-3">
                          <label
                            htmlFor="mfa-disable-password"
                            className="text-xs font-medium text-zinc-400"
                          >
                            Confirm your password to disable 2FA
                          </label>
                          <div className="mt-1.5 flex gap-2">
                            <input
                              id="mfa-disable-password"
                              type="password"
                              value={disablePassword}
                              onChange={(e) => setDisablePassword(e.target.value)}
                              placeholder="Password"
                              className="w-48 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => void handleDisableMFA()}
                              disabled={disabling || !disablePassword.trim()}
                              className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {disabling ? 'Disabling...' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowDisableForm(false);
                                setDisablePassword('');
                              }}
                              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowDisableForm(true)}
                          className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-red-700 hover:text-red-400"
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
                          className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {regenerating ? 'Regenerating...' : 'Regenerate backup codes'}
                        </button>
                      </div>

                      {/* Show regenerated codes */}
                      {regeneratedCodes && (
                        <div>
                          <p className="text-xs font-medium text-zinc-400">
                            New backup codes — save these in a secure place
                          </p>
                          <div className="mt-1 grid grid-cols-2 gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 p-3">
                            {regeneratedCodes.map((code) => (
                              <code key={code} className="text-xs font-mono text-zinc-300">
                                {code}
                              </code>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => setRegeneratedCodes(null)}
                            className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
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
            <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Passkeys</h2>
                <span className="text-xs text-zinc-500">
                  {passkeys.length} of {MAX_PASSKEYS} passkeys
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                Passkeys let you sign in securely without a password using biometrics or a security
                key.
              </p>

              {/* Passkey list */}
              {passkeys.length > 0 && (
                <div className="mt-5 space-y-3">
                  {passkeys.map((passkey) => (
                    <div
                      key={passkey.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          className="h-5 w-5 text-zinc-400"
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
                              <input
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void submitRename(passkey.id);
                                  if (e.key === 'Escape') cancelRename();
                                }}
                                className="w-36 rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-sm text-zinc-200 focus:border-zinc-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => void submitRename(passkey.id)}
                                className="text-xs text-emerald-400 hover:text-emerald-300"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelRename}
                                className="text-xs text-zinc-500 hover:text-zinc-300"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="text-sm font-medium text-zinc-200">
                              {passkey.deviceName ?? 'Unnamed passkey'}
                            </div>
                          )}
                          <div className="text-xs text-zinc-500">
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
                            className="rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(passkey.id)}
                            disabled={deletingId === passkey.id}
                            className="rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <p className="text-xs text-zinc-500">
                    Passkeys are not supported in this browser.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleAddPasskey()}
                    disabled={passkeyLoading || passkeys.length >= MAX_PASSKEYS}
                    className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {passkeyLoading ? 'Adding...' : 'Add passkey'}
                  </button>
                )}
                {passkeys.length >= MAX_PASSKEYS && (
                  <p className="mt-2 text-xs text-amber-400/80">
                    Maximum number of passkeys reached. Remove one to add another.
                  </p>
                )}
              </div>
            </div>

            {/* ============================================================= */}
            {/* Section 3: Account Recovery                                   */}
            {/* ============================================================= */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-base font-semibold text-white">Account Recovery</h2>
              <p className="mt-1 text-sm text-zinc-400">
                If you lose access to all your devices, you can recover your account via email magic
                link.
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Backup codes remaining</span>
                  <span
                    className={mfaStatus?.backupCodesRemaining ? 'text-zinc-200' : 'text-zinc-500'}
                  >
                    {mfaStatus?.enabled
                      ? (mfaStatus.backupCodesRemaining ?? 'Unknown')
                      : 'N/A — 2FA not enabled'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Email recovery</span>
                  <span className="text-emerald-400">Available</span>
                </div>
              </div>
              {mfaStatus?.enabled &&
                mfaStatus.backupCodesRemaining !== undefined &&
                mfaStatus.backupCodesRemaining <= 2 && (
                  <p className="mt-4 text-xs text-amber-400/80">
                    You have few backup codes remaining. Consider regenerating them above.
                  </p>
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
            className="rounded-md px-3 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void confirmDelete()}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Remove
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
