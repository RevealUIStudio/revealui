'use client';

const SAVED_FEEDBACK_MS = 2_000;

import { Input, Select } from '@revealui/presentation';
import { Field, Label } from '@revealui/presentation/client';
import { useEffect, useState } from 'react';
import { LicenseGate } from '@/lib/components/LicenseGate';
import type { Provider, ProviderInfo } from '@/lib/settings/api-key-providers';
import { apiFetch } from '@/lib/utils/csrf';

interface ApiKeysPageClientProps {
  /** Providers to offer — already filtered for this deployment (server-resolved). */
  providers: ProviderInfo[];
  /** True on a hosted (serverless) deployment; false on self-hosted. */
  isHosted: boolean;
}

export default function ApiKeysPageClient({ providers, isHosted }: ApiKeysPageClientProps) {
  const [provider, setProvider] = useState<Provider>(providers[0]?.id ?? 'anthropic');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);
  const [currentKeyHint, setCurrentKeyHint] = useState<string | null>(null);

  // Load existing key metadata from server on mount
  useEffect(() => {
    fetch('/api/user/api-keys')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { provider: string; keyHint: string | null } | null) => {
        if (data) {
          setCurrentProvider(data.provider);
          setCurrentKeyHint(data.keyHint);
        }
      })
      .catch(() => {
        // Swallow fetch errors  -  API key metadata is non-critical
      });
  }, []);

  async function handleSave() {
    if (!apiKey.trim()) return;
    setSaveError(null);
    try {
      const res = await apiFetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key: apiKey.trim() }),
      });
      if (res.ok) {
        const data = (await res.json()) as { provider: string; keyHint: string };
        setCurrentProvider(data.provider);
        setCurrentKeyHint(data.keyHint);
        setApiKey('');
        setSaved(true);
        setTimeout(() => setSaved(false), SAVED_FEEDBACK_MS);
      } else {
        // empty-catch-ok: JSON-parse fallback for an error-response body; `{}` is the safe shape so `data.error` evaluates to undefined and the UI falls back to the generic error text below.
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(
          data.error ?? 'Failed to save key. Contact support@revealui.com if this persists.',
        );
      }
    } catch {
      setSaveError('Unable to reach the server. Please check your connection and try again.');
    }
  }

  async function handleClear() {
    setSaveError(null);
    try {
      await apiFetch('/api/user/api-keys', { method: 'DELETE' });
      setApiKey('');
      setCurrentProvider(null);
      setCurrentKeyHint(null);
      setSaved(false);
    } catch {
      setSaveError('Unable to reach the server. Please check your connection and try again.');
    }
  }

  const activeProviderInfo = providers.find((p) => p.id === provider);

  return (
    <LicenseGate feature="ai">
      <div className="min-h-screen">
        <div className="p-4 sm:p-6 max-w-lg">
          {/* Status banner */}
          {currentProvider && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
              <span className="h-2 w-2 rounded-full bg-success" />
              {providers.find((p) => p.id === currentProvider)?.label ?? currentProvider} key
              configured{currentKeyHint ? ` (${currentKeyHint})` : ''}. Agent tasks will use it.
            </div>
          )}

          {/* Error banner */}
          {saveError && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error"
            >
              {saveError}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-5">
            <h1 className="text-base font-semibold text-foreground">AI Provider</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect the AI provider your agents run on. We store your key encrypted on RevealUI's
              servers and only use it server-side when an agent task runs.
            </p>
            {isHosted && (
              <p className="mt-1 text-xs text-muted-foreground">
                This is a hosted deployment, so local-only providers like Ollama and Inference Snaps
                aren't listed below.
              </p>
            )}

            <div className="mt-5 flex flex-col gap-4">
              {/* Provider selector */}
              <Field>
                <Label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Provider
                </Label>
                <Select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>

              {/* API key input */}
              <Field>
                <Label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  API Key
                  {activeProviderInfo && (
                    <a
                      href={activeProviderInfo.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Get key ↗
                    </a>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={activeProviderInfo?.placeholder ?? ''}
                    className="pr-16 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? 'hide' : 'show'}
                  </button>
                </div>
              </Field>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!apiKey.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saved ? (
                    <span className="inline-flex items-center gap-1.5">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Saved
                    </span>
                  ) : (
                    'Save Key'
                  )}
                </button>
                {currentProvider && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </LicenseGate>
  );
}
