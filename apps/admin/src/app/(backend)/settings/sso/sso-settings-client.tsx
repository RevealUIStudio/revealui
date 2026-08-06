'use client';

const SUCCESS_DISMISS_MS = 5_000;
const ERROR_DISMISS_MS = 8_000;

import { Button, Input, Select } from '@revealui/presentation';
import { Checkbox, Field, Label, Textarea } from '@revealui/presentation/client';
import { useCallback, useEffect, useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';
import { apiFetch } from '@/lib/utils/csrf';

export type SsoProviderType = 'oidc' | 'saml';

export interface SsoProvider {
  id: string;
  accountId: string;
  providerType: SsoProviderType;
  name: string;
  enabled: boolean;
  issuer: string;
  discoveryUrl: string | null;
  clientId: string | null;
  clientSecretRef: string | null;
  samlMetadataUrl: string | null;
  samlMetadataXml: string | null;
  samlSpEntityId: string | null;
  hasSigningCert: boolean;
  groupClaim: string;
  groupRoleMap: Record<string, string>;
  defaultRole: string;
  requireGroupMatch: boolean;
  allowPasswordFallback: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SsoFormState {
  providerType: SsoProviderType;
  name: string;
  issuer: string;
  discoveryUrl: string;
  clientId: string;
  clientSecretRef: string;
  samlMetadataUrl: string;
  samlMetadataXml: string;
  samlSpEntityId: string;
  groupClaim: string;
  defaultRole: string;
  requireGroupMatch: boolean;
  enabled: boolean;
}

export interface TestConnectionResult {
  ok: boolean;
  reason?: string;
  message?: string;
  warning?: string;
  discoveryUrl?: string;
  metadataUrl?: string | null;
  discovery?: {
    issuer: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    jwksUri: string;
    scopesSupported: string[];
  };
  saml?: {
    entityId: string;
    entryPoint: string;
    hasSigningCert: boolean;
    issuerMatchesMetadata: boolean;
  };
  claimStructurePreview?: {
    standardClaims: string[];
    groupClaim: string;
    notes: string[];
  };
}

const EMPTY_FORM: SsoFormState = {
  providerType: 'oidc',
  name: '',
  issuer: '',
  discoveryUrl: '',
  clientId: '',
  clientSecretRef: '',
  samlMetadataUrl: '',
  samlMetadataXml: '',
  samlSpEntityId: '',
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
    providerType: p.providerType,
    name: p.name,
    issuer: p.issuer,
    discoveryUrl: p.discoveryUrl ?? '',
    clientId: p.clientId ?? '',
    clientSecretRef: p.clientSecretRef ?? '',
    samlMetadataUrl: p.samlMetadataUrl ?? '',
    samlMetadataXml: p.samlMetadataXml ?? '',
    samlSpEntityId: p.samlSpEntityId ?? '',
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
    const connectionKeys: Array<keyof SsoFormState> = [
      'providerType',
      'issuer',
      'discoveryUrl',
      'groupClaim',
      'samlMetadataUrl',
      'samlMetadataXml',
    ];
    if (connectionKeys.includes(key)) {
      setTestedOk(false);
      setTestResult(null);
    }
  }

  function canTestConnection(): boolean {
    if (!form.issuer.trim()) return false;
    if (form.providerType === 'saml') {
      return Boolean(form.samlMetadataUrl.trim() || form.samlMetadataXml.trim());
    }
    return true;
  }

  async function handleTestConnection() {
    if (!accountId) return;
    if (!form.issuer.trim()) {
      setError(
        form.providerType === 'saml'
          ? 'IdP entity ID (issuer) is required to test the connection.'
          : 'Issuer is required to test the connection.',
      );
      return;
    }
    if (form.providerType === 'saml' && !canTestConnection()) {
      setError('Provide IdP metadata URL or paste metadata XML to test.');
      return;
    }
    setTesting(true);
    setError(null);
    try {
      const body =
        form.providerType === 'saml'
          ? {
              providerType: 'saml' as const,
              issuer: form.issuer.trim(),
              samlMetadataUrl: form.samlMetadataUrl.trim() || undefined,
              samlMetadataXml: form.samlMetadataXml.trim() || undefined,
              groupClaim: form.groupClaim.trim() || 'groups',
              providerId: editingId ?? undefined,
            }
          : {
              providerType: 'oidc' as const,
              issuer: form.issuer.trim(),
              discoveryUrl: form.discoveryUrl.trim() || undefined,
              groupClaim: form.groupClaim.trim() || 'groups',
              providerId: editingId ?? undefined,
            };

      const res = await apiFetch(accountsUrl(`/${accountId}/sso-providers/test-connection`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      // empty-catch-ok: JSON-parse fallback for an error-response body; `{}` is the safe shape so `data.error` evaluates to undefined and the UI falls back to the generic error text below.
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
        setSuccess(
          form.providerType === 'saml'
            ? 'IdP metadata validated. You can enable this provider when ready.'
            : 'Discovery succeeded. You can enable this provider when ready.',
        );
      } else {
        setError(data.message ?? 'Test failed. Check issuer and metadata / discovery URL.');
      }
    } catch {
      setError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!accountId) return;
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!form.issuer.trim()) {
      setError(
        form.providerType === 'saml'
          ? 'IdP entity ID (issuer) is required.'
          : 'Name and issuer are required.',
      );
      return;
    }
    if (
      form.providerType === 'saml' &&
      !(form.samlMetadataUrl.trim() || form.samlMetadataXml.trim())
    ) {
      setError('SAML providers require a metadata URL or metadata XML.');
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
      const payload =
        form.providerType === 'saml'
          ? {
              name: form.name.trim(),
              providerType: 'saml' as const,
              issuer: form.issuer.trim(),
              samlMetadataUrl: form.samlMetadataUrl.trim() || null,
              samlMetadataXml: form.samlMetadataXml.trim() || null,
              samlSpEntityId: form.samlSpEntityId.trim() || null,
              groupClaim: form.groupClaim.trim() || 'groups',
              defaultRole: form.defaultRole,
              requireGroupMatch: form.requireGroupMatch,
              enabled: form.enabled,
            }
          : {
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
      // empty-catch-ok: JSON-parse fallback for an error-response body; `{}` is the safe shape so `data.error` evaluates to undefined and the UI falls back to the generic error text below.
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
        // empty-catch-ok: JSON-parse fallback for an error-response body; `{}` is the safe shape so `data.error` evaluates to undefined and the UI falls back to the generic error text below.
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
        // empty-catch-ok: JSON-parse fallback for an error-response body; `{}` is the safe shape so `data.error` evaluates to undefined and the UI falls back to the generic error text below.
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

  const formTitle = editingId
    ? form.providerType === 'saml'
      ? 'Edit SAML provider'
      : 'Edit OIDC provider'
    : form.providerType === 'saml'
      ? 'Add SAML provider'
      : 'Add OIDC provider';

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
                    Connect an OIDC or SAML identity provider (Okta, Azure AD, Google Workspace,
                    Keycloak). Store client secrets as env/revvault references only. Never paste raw
                    secrets here.
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
                <h2 className="text-base font-semibold text-foreground">{formTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {form.providerType === 'saml'
                    ? 'Paste IdP metadata URL or XML. Optional SP entity ID overrides the default ACS-based entity ID.'
                    : 'OIDC discovery + client credentials. Secrets as references only.'}
                </p>

                <div className="mt-5 flex flex-col gap-4">
                  <Field>
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Protocol
                    </Label>
                    <Select
                      value={form.providerType}
                      onChange={(e) =>
                        updateField('providerType', e.target.value === 'saml' ? 'saml' : 'oidc')
                      }
                      disabled={Boolean(editingId)}
                    >
                      <option value="oidc">OIDC</option>
                      <option value="saml">SAML</option>
                    </Select>
                    {editingId && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Protocol is fixed after create. Remove and re-add to switch.
                      </p>
                    )}
                  </Field>

                  <Field>
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Display name
                    </Label>
                    <Input
                      value={form.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      placeholder={
                        form.providerType === 'saml' ? 'Azure AD SAML' : 'Okta Production'
                      }
                    />
                  </Field>

                  <Field>
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      {form.providerType === 'saml' ? 'IdP entity ID (issuer)' : 'Issuer'}
                    </Label>
                    <Input
                      value={form.issuer}
                      onChange={(e) => updateField('issuer', e.target.value)}
                      placeholder={
                        form.providerType === 'saml'
                          ? 'https://sts.windows.net/…/'
                          : 'https://your-org.okta.com'
                      }
                    />
                  </Field>

                  {form.providerType === 'oidc' && (
                    <>
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
                    </>
                  )}

                  {form.providerType === 'saml' && (
                    <>
                      <Field>
                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          IdP metadata URL
                        </Label>
                        <Input
                          value={form.samlMetadataUrl}
                          onChange={(e) => updateField('samlMetadataUrl', e.target.value)}
                          placeholder="https://idp.example.com/metadata.xml"
                        />
                      </Field>

                      <Field>
                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          IdP metadata XML (optional if URL set)
                        </Label>
                        <Textarea
                          value={form.samlMetadataXml}
                          onChange={(e) => updateField('samlMetadataXml', e.target.value)}
                          placeholder="<EntityDescriptor …>"
                          rows={6}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </Field>

                      <Field>
                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          SP entity ID (optional override)
                        </Label>
                        <Input
                          value={form.samlSpEntityId}
                          onChange={(e) => updateField('samlSpEntityId', e.target.value)}
                          placeholder="Defaults to ACS callback URL or REVEALUI_SSO_SP_ENTITY_ID"
                        />
                      </Field>
                    </>
                  )}

                  <Field>
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Group claim / attribute
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
                    <Select
                      value={form.defaultRole}
                      onChange={(e) => updateField('defaultRole', e.target.value)}
                    >
                      <option value="viewer">viewer</option>
                      <option value="member">member</option>
                      <option value="editor">editor</option>
                      <option value="admin">admin</option>
                    </Select>
                  </Field>

                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={form.requireGroupMatch}
                      onChange={(checked) => updateField('requireGroupMatch', checked)}
                    />
                    <span>Require group match (reject login when no group maps)</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                    <Checkbox
                      checked={form.enabled}
                      onChange={(checked) => {
                        if (checked && !testedOk) {
                          setEnableConfirm(false);
                        }
                        updateField('enabled', checked);
                      }}
                    />
                    <span>Enabled</span>
                    {!testedOk && form.enabled && (
                      <span className="text-xs text-warning-foreground/80">
                        (test connection first, or confirm on save)
                      </span>
                    )}
                  </div>

                  {form.enabled && !testedOk && (
                    <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                      <Checkbox
                        checked={enableConfirm}
                        onChange={(checked) => setEnableConfirm(checked)}
                      />
                      <span>
                        I understand discovery was not tested successfully. Enable anyway.
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      type="button"
                      variant="neutral"
                      size="sm"
                      onClick={() => void handleTestConnection()}
                      disabled={testing || !canTestConnection()}
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
                        {testResult.ok
                          ? form.providerType === 'saml'
                            ? 'Metadata OK'
                            : 'Discovery OK'
                          : form.providerType === 'saml'
                            ? 'Metadata failed'
                            : 'Discovery failed'}
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
                      {testResult.ok && testResult.saml && (
                        <dl className="mt-3 space-y-1 text-xs text-foreground">
                          <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Entity ID</dt>
                            <dd className="truncate text-right">{testResult.saml.entityId}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">SSO entry</dt>
                            <dd className="truncate text-right">{testResult.saml.entryPoint}</dd>
                          </div>
                          <div className="flex justify-between gap-4">
                            <dt className="text-muted-foreground">Signing cert</dt>
                            <dd className="text-right">
                              {testResult.saml.hasSigningCert ? 'present' : 'missing'}
                            </dd>
                          </div>
                        </dl>
                      )}
                      {testResult.warning && (
                        <p className="mt-2 text-xs text-warning-foreground">{testResult.warning}</p>
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
