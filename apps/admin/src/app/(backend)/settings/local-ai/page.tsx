/**
 * Settings · Local AI — self-host host profile status (read-only).
 *
 * Control plane for apply lives on Studio + revealui-harnesses / revealui-local-ai.
 * This page only surfaces the profile written on the host.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils/csrf';

interface LocalAiStatusAvailable {
  available: true;
  hosted: false;
  profilePath: string;
  activeEnvPath: string;
  profileExists: boolean;
  tier: string | null;
  provider: string | null;
  model: string | null;
  baseURL: string | null;
  note: string | null;
  updatedAt: string | null;
  memAvailableGiB: number | null;
  ollamaModelsDir: string | null;
}

interface LocalAiStatusUnavailable {
  available: false;
  hosted: true;
  reason: string;
}

type LocalAiStatus = LocalAiStatusAvailable | LocalAiStatusUnavailable;

export default function LocalAiSettingsPage() {
  const [data, setData] = useState<LocalAiStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/local-ai/status');
      if (!res.ok) {
        setError(`Request failed (${res.status})`);
        setData(null);
        return;
      }
      const body = (await res.json()) as { success?: boolean; data?: LocalAiStatus };
      if (!body.data) {
        setError('Malformed response');
        setData(null);
        return;
      }
      setData(body.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-4 sm:p-6 max-w-lg">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Local AI</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Host resource tier for self-hosted inference (US-origin snaps + Ollama).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="h-5 w-40 animate-pulse rounded bg-foreground/10" />
          <div className="mt-3 h-4 w-64 animate-pulse rounded bg-foreground/10" />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && data && !data.available ? (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Not available on hosted</p>
          <p className="mt-2">{data.reason}</p>
        </div>
      ) : null}

      {!loading && data?.available ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Tier</dt>
                <dd className="font-medium text-foreground">{data.tier ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="font-medium text-foreground">{data.provider ?? 'none (idle)'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Model</dt>
                <dd className="font-medium text-foreground">{data.model ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Base URL</dt>
                <dd className="truncate font-mono text-xs text-foreground">
                  {data.baseURL ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Free RAM</dt>
                <dd className="font-medium text-foreground">
                  {data.memAvailableGiB != null ? `~${data.memAvailableGiB} Gi` : '—'}
                </dd>
              </div>
              {data.note ? (
                <div>
                  <dt className="text-muted-foreground">Note</dt>
                  <dd className="mt-1 text-foreground">{data.note}</dd>
                </div>
              ) : null}
              {data.updatedAt ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Updated</dt>
                  <dd className="text-xs text-muted-foreground">{data.updatedAt}</dd>
                </div>
              ) : null}
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Apply tiers on the host</p>
            <pre className="mt-2 overflow-x-auto rounded bg-background p-2 font-mono text-[11px] text-foreground">
              {`revealui-local-ai idle
# or
revealui-harnesses inference apply idle`}
            </pre>
            <p className="mt-2">
              Profile: <code className="text-foreground">{data.profilePath}</code>
            </p>
            {!data.profileExists ? (
              <p className="mt-1 text-amber-600 dark:text-amber-400">
                No profile file yet. Apply a tier from Studio or the CLI.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
