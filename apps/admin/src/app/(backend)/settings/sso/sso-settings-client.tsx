'use client';

const SUCCESS_DISMISS_MS = 5_000;
const ERROR_DISMISS_MS = 8_000;

import { Button, Input } from '@revealui/presentation';
import { Field, Label } from '@revealui/presentation/client';
import { useCallback, useEffect, useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';
import { apiFetch } from '@/lib/utils/csrf';

export interface SsoProvider {
  id: string;
  accountId: string;
  providerType: 'oidc' | 'saml';
  name: string;
  enabled: boolean;
  issuer: string;
  discoveryUrl: string | null;
  clientId: string | null;
  clientSecretRef: string | null;
  groupClaim: string;
  groupRoleMap: Record<string, string>;
  defaultRole: string;
  requireGroupMatch: boolean;
  allowPasswordFallback: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SsoFormState {
  name: string;
  issuer: string;
  discoveryUrl: string;
  clientId: string;
  clientSecretRef: string;
  groupClaim: string;
  defaultRole: string;
  requireGroupMatch: boolean;
  enabled: boolean;
}

export interface TestConnectionResult {
  ok: boolean;
  reason?: string;
  message?: string;
  discoveryUrl?: string;
  discovery?: {
    issuer: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    jwksUri: string;
    scopesSupported: string[];
  };
  claimStructurePreview?: {
    standardClaims: string[];
    groupClaim: string;
    notes: string[];
  };
}

const EMPTY_FORM: SsoFormState = {
  name: '',
  issuer: '',
  discoveryUrl: '',
  clientId: '',
  clientSecretRef: '',
  groupClaim: 'groups',
  defaultRole: 'member',
  requireGroupMatch: false,
  enabled: false,
};

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
}

function accountsUrl(path: string): string {
  const base = apiBase();
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}/api/accounts${suffix}` : `/api/accounts${suffix}`;
}

export function providerToForm(p: SsoProvider): SsoFormState {
  return {
    name: p.name,
    issuer: p.issuer,
    discoveryUrl: p.discoveryUrl ?? '',
    clientId: p.clientId ?? '',
    clientSecretRef: p.clientSecretRef ?? '',
    groupClaim: p.groupClaim,
    defaultRole: p.defaultRole,
    requireGroupMatch: p.requireGroupMatch,
    enabled: p.enabled,
  };
}

export default function SsoSettingsClient() {
  return (
    <LicenseGate feature="sso">
      <SsoSettingsContent />
    </LicenseGate>
  );
}

function SsoSettingsContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [providers, setProviders] = useState<SsoProvider[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SsoFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [testedOk, setTestedOk] = useState(false);
  const [enableConfirm, setEnableConfirm] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const currentRes = await fetch(accountsUrl('/current'), { credentials: 'include' });
      if (currentRes.status === 401) {
        setError('Sign in required to manage SSO.');
        setLoading(false);
        return;
      }
      if (!currentRes.ok) {
        setError('Unable to resolve account for SSO settings.');
        setLoading(false);
        return;
      }
      const current = (await currentRes.json()) as {
        accountId: string | null;
        ssoFeature: boolean;
      };
      if (!current.accountId) {
        setError('No account membership found. SSO is configured per account.');
        setLoading(false);
        return;
      }
      if (!current.ssoFeature) {
        // LicenseGate should hide, but API is source of truth for entitlement
        setError('SSO is not enabled for this account.');
        setAccountId(current.accountId);
        setLoading(false);
        return;
      }
      setAccountId(current.accountId);

      const listRes = await fetch(accountsUrl(`/${current.accountId}/sso-providers`), {
        credentials: 'include',
      });
      if (listRes.status === 403) {
        setError('SSO is not enabled for this account.');
        setLoading(false);
        return;
      }
      if (!listRes.ok) {
        setError('Unable to load SSO providers.');
        setLoading(false);
        return;
      }
      const data = (await listRes.json()) as { providers: SsoProvider[] };
      setProviders(data.providers);
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setTestResult(null);
    setTestedOk(false);
    setEnableConfirm(false);
    setShowForm(true);
  }

  function openEdit(provider: SsoProvider) {
    setEditingId(provider.id);
    setForm(providerToForm(provider));
    setTestResult(null);
    setTestedOk(false);
    setEnableConfirm(false);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setTestResult(null);
    setTestedOk(false);
    setEnableConfirm(false);
  }

  function updateField<K extends keyof SsoFormState>(key: K, value: SsoFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Requiring re-test when connection-relevant fields change
    if (key === 'issuer' || key === 'discoveryUrl' || key === 'groupClaim') {
      setTestedOk(false);
      setTestResult(null);
    }
  }

  async function handleTestConnection() {
    if (!accountId) return;
    if (!form.issuer.trim()) {
      setError('Issuer is required to test the connection.');
      return;
    }
    setTesting(true);
    setError(null);
    try {
      const res = await apiFetch(accountsUrl(`/${accountId}/sso-providers/test-connection`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuer: form.issuer.trim(),
          discoveryUrl: form.discoveryUrl.trim() || undefined,
          groupClaim: form.groupClaim.trim() || 'groups',
          providerId: editingId ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as TestConnectionResult & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'Test connection failed.');
        setTestedOk(false);
        setTestResult(null);
        return;
      }
      setTestResult(data);
      setTestedOk(data.ok === true);
      if (data.ok) {
        setSuccess('Discovery succeeded. You can enable this provider when ready.');
      } else {
        setError(data.message ?? 'Discovery failed. Check issuer and discovery URL.');
      }
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!accountId) return;
    if (!(form.name.trim() && form.issuer.trim())) {
      setError('Name and issuer are required.');
      return;
    }
    if (form.enabled && !testedOk && !enableConfirm) {
      setEnableConfirm(true);
      setError(
        'Enable requires a successful test connection, or confirm enable without a test below.',
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        providerType: 'oidc' as const,
        issuer: form.issuer.trim(),
        discoveryUrl: form.discoveryUrl.trim() || null,
        clientId: form.clientId.trim() || null,
        clientSecretRef: form.clientSecretRef.trim() || null,
        groupClaim: form.groupClaim.trim() || 'groups',
        defaultRole: form.defaultRole,
        requireGroupMatch: form.requireGroupMatch,
        enabled: form.enabled,
      };

      const url = editingId
        ? accountsUrl(`/${accountId}/sso-providers/${editingId}`)
        : accountsUrl(`/${accountId}/sso-providers`);
      const method = editingId ? 'PATCH' : 'POST';

      const res = await apiFetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        provider?: SsoProvider;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? 'Unable to save SSO provider.');
        return;
      }
      setSuccess(editingId ? 'SSO provider updated.' : 'SSO provider created.');
      cancelForm();
      await load();
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(providerId: string) {
    if (!accountId) return;
    if (
      !window.confirm('Remove this SSO provider? Users will no longer be able to sign in with it.')
    ) {
      return;
    }
    setError(null);
    try {
      const res = await apiFetch(accountsUrl(`/${accountId}/sso-providers/${providerId}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Unable to remove SSO provider.');
        return;
      }
      setSuccess('SSO provider removed.');
      await load();
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    }
  }

  async function handleToggleEnabled(provider: SsoProvider, enabled: boolean) {
    if (!accountId) return;
    if (enabled && !window.confirm('Enable this provider without a fresh test connection?')) {
      return;
    }
    setError(null);
    try {
      const res = await apiFetch(accountsUrl(`/${accountId}/sso-providers/${provider.id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Unable to update provider.');
        return;
      }
      setSuccess(enabled ? 'Provider enabled.' : 'Provider disabled.');
      await load();
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    }
  }

  return (
    <div className="min-h-screen">
      <div className="p-4 sm:p-6 max-w-2xl">
        {success && (
          <output className="mb-6 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            <span className="h-2 w-2 rounded-full bg-success" />
            {success}
          </output>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
          >
            <span className="h-2 w-2 rounded-full bg-error" />
            {error}
          </div>
        )}

        {loading && (
          <section
            aria-busy="true"
            aria-label="Loading SSO settings"
            className="rounded-xl border border-border bg-card p-5"
          >
            <div className="h-5 w-48 animate-pulse rounded bg-foreground/10" />
            <div className="mt-3 h-4 w-72 animate-pulse rounded bg-foreground/10" />
          </section>
        )}

        {!loading && (
          <>
            <div className="mb-6 rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-base font-semibold text-foreground">Enterprise SSO</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Connect an OIDC identity provider (Okta, Azure AD, Google Workspace, Keycloak).
                    Store client secrets as env/revvault references only. Never paste raw secrets
                    here.
                  </p>
                </div>
                {!showForm && (
                  <Button type="button" variant="neutral" size="sm" onClick={openCreate}>
                    Add provider
                  </Button>
                )}
              </div>

              {providers.length === 0 && !showForm && (
                <p className="mt-5 text-sm text-muted-foreground">
                  No SSO providers configured yet.
                </p>
              )}

              {providers.length > 0 && !showForm && (
                <ul className="mt-5 space-y-3">
                  {providers.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-col gap-3 rounded-lg border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{p.name}</span>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              p.enabled
                                ? 'bg-success/10 text-success'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {p.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            {p.providerType}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{p.issuer}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          appearance="outline"
                          variant="neutral"
                          size="sm"
                          onClick={() => void handleToggleEnabled(p, !p.enabled)}
                          className="text-xs"
                        >
                          {p.enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          type="button"
                          appearance="ghost"
                          variant="neutral"
                          size="sm"
                          onClick={() => openEdit(p)}
                          className="text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          appearance="ghost"
                          variant="neutral"
                          size="sm"
                          onClick={() => void handleDelete(p.id)}
                          className="text-xs text-muted-foreground hover:text-error"
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {showForm && (
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold text-foreground">
                  {editingId ? 'Edit OIDC provider' : 'Add OIDC provider'}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  SAML configuration is planned. OIDC only for this release.
                </p>

                <div className="mt-5 flex flex-col gap-4">
                  <Field>
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Display name
                    </Label>
                    <Input
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder="Okta Production"
                    />
                  </Field>

                  <Field>
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Issuer
                    </Label>
                    <Input
                      value={form.issuer}
                      onChange={(e) => updateField('issuer', e.target.value)}
                      placeholder="https://your-org.okta.com"
                    />
                  </Field>

                  <Field>
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Discovery URL (optional)
                    </Label>
                    <Input
                      value={form.discoveryUrl}
                      onChange={(e) => updateField('discoveryUrl', e.target.value)}
                      placeholder="https://…/.well-known/openid-configuration"
                    />
                  </Field>

                  <Field>
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Client ID
                    </Label>
                    <Input
                      value={form.clientId}
                      onChange={(e) => updateField('clientId', e.target.value)}
                      placeholder="0oa…"
                      autoComplete="off"
                    />
                  </Field>

                  <Field>
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Client secret reference
                    </Label>
                    <Input
                      value={form.clientSecretRef}
                      onChange={(e) => updateField('clientSecretRef', e.target.value)}
                      placeholder="REVEALUI_SSO_CLIENT_SECRET or revvault path"
                      autoComplete="off"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Env var name or revvault path only. Never paste the secret value.
                    </p>
                  </Field>

                  <Field>
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Group claim
                    </Label>
                    <Input
                      value={form.groupClaim}
                      onChange={(e) => updateField('groupClaim', e.target.value)}
                      placeholder="groups"
                    />
                  </Field>

                  <Field>
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Default role
                    </Label>
                    <select
                      value={form.defaultRole}
                      onChange={(e) => updateField('defaultRole', e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                      <option value="viewer">viewer</option>
                      <option value="member">member</option>
                      <option value="editor">editor</option>
                      <option value="admin">admin</option>
                    </select>
                  </Field>

                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={form.requireGroupMatch}
                      onChange={(e) => updateField('requireGroupMatch', e.target.checked)}
                      className="rounded border-border"
                    />
                    Require group match (reject login when no group maps)
                  </label>

                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={form.enabled}
                      onChange={(e) => {
                        const next = e.target.checked;
                        if (next && !testedOk) {
                          setEnableConfirm(false);
                        }
                        updateField('enabled', next);
                      }}
                      className="rounded border-border"
                    />
                    Enabled
                    {!testedOk && form.enabled && (
                      <span className="text-xs text-warning-foreground/80">
                        (test connection first, or confirm on save)
                      </span>
                    )}
                  </label>

                  {form.enabled && !testedOk && (
                    <label className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                      <input
                        type="checkbox"
                        checked={enableConfirm}
                        onChange={(e) => setEnableConfirm(e.target.checked)}
                        className="mt-0.5"
                      />
                      I understand discovery was not tested successfully. Enable anyway.
                    </label>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      type="button"
                      variant="neutral"
                      size="sm"
                      onClick={() => void handleTestConnection()}
                      disabled={testing || !form.issuer.trim()}
                    >
                      {testing ? 'Testing…' : 'Test connection'}
                    </Button>
                    <Button
                      type="button"
                      variant="success"
                      size="sm"
                      onClick={() => void handleSave()}
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create provider'}
                    </Button>
                    <Button
                      type="button"
                      appearance="ghost"
                      variant="neutral"
                      size="sm"
                      onClick={cancelForm}
                    >
                      Cancel
                    </Button>
                  </div>

                  {testResult && (
                    <div
                      className={`mt-2 rounded-lg border px-4 py-3 text-sm ${
                        testResult.ok
                          ? 'border-success/30 bg-success/10 text-success'
                          : 'border-error/30 bg-error/10 text-error'
                      }`}
                    >
                      <p className="font-medium">
                        {testResult.ok ? 'Discovery OK' : 'Discovery failed'}
                      </p>
                      {testResult.discoveryUrl && (
                        <p className="mt-1 break-all text-xs opacity-90">
                          {testResult.discoveryUrl}
                        </p>
                      )}
                      {testResult.ok && testResult.discovery && (
                        <dl className="mt-3 space-y-1 text-xs text-foreground">
                          <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Authorization</dt>
                            <dd className="truncate text-right">
                              {testResult.discovery.authorizationEndpoint}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Token</dt>
                            <dd className="truncate text-right">
                              {testResult.discovery.tokenEndpoint}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">JWKS</dt>
                            <dd className="truncate text-right">{testResult.discovery.jwksUri}</dd>
                          </div>
                          {testResult.discovery.scopesSupported.length > 0 && (
                            <div className="flex justify-between gap-4">
                              <dt className="text-muted-foreground">Scopes</dt>
                              <dd className="text-right">
                                {testResult.discovery.scopesSupported.join(', ')}
                              </dd>
                            </div>
                          )}
                        </dl>
                      )}
                      {testResult.ok && testResult.claimStructurePreview && (
                        <div className="mt-3 text-xs text-foreground">
                          <p className="font-medium text-muted-foreground">
                            Claim structure preview
                          </p>
                          <p className="mt-1">
                            Standard: {testResult.claimStructurePreview.standardClaims.join(', ')}
                          </p>
                          <p>
                            Group claim: <code>{testResult.claimStructurePreview.groupClaim}</code>
                          </p>
                          <ul className="mt-1 list-inside list-disc text-muted-foreground">
                            {testResult.claimStructurePreview.notes.map((note) => (
                              <li key={note}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!testResult.ok && testResult.message && (
                        <p className="mt-1 text-xs">{testResult.message}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
