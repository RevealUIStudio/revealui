import { Callout } from '@revealui/presentation';
import { useEffect, useState } from 'react';
import { Footer } from '../components/Footer';
import { SITE } from '../content/site';

interface Surface {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly publicUrl: string;
  readonly mode: 'self' | 'probe' | 'link';
  readonly probeUrl?: string;
}

const SURFACES: readonly Surface[] = [
  {
    id: 'marketing',
    label: 'Marketing site',
    description: 'revealui.com',
    publicUrl: 'https://revealui.com',
    mode: 'self',
  },
  {
    id: 'api',
    label: 'API',
    description: 'api.revealui.com',
    publicUrl: SITE.urls.api,
    mode: 'probe',
    probeUrl: `${SITE.urls.api}/health`,
  },
  {
    id: 'docs',
    label: 'Documentation',
    description: 'docs.revealui.com',
    publicUrl: SITE.urls.docs,
    mode: 'link',
  },
  {
    id: 'admin',
    label: 'Admin dashboard',
    description: 'admin.revealui.com',
    publicUrl: SITE.urls.admin,
    mode: 'link',
  },
];

type ProbeResult =
  | { status: 'pending' }
  | { status: 'up'; latencyMs: number; checkedAt: number }
  | { status: 'down'; reason: string; checkedAt: number };

function badgeFor(
  state: { kind: 'self' } | { kind: 'link' } | { kind: 'probe'; result: ProbeResult },
) {
  if (state.kind === 'self') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200 dark:bg-green-950/30 dark:text-green-400 dark:ring-green-800">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-green-500" />
        Operational (you are here)
      </span>
    );
  }
  if (state.kind === 'link') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-zinc-400" />
        Visit to verify
      </span>
    );
  }
  const r = state.result;
  if (r.status === 'pending') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-700">
        <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-zinc-400" />
        Checking…
      </span>
    );
  }
  if (r.status === 'up') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-green-200 dark:bg-green-950/30 dark:text-green-400 dark:ring-green-800">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-green-500" />
        Operational · {r.latencyMs}ms
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-800">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-red-500" />
      Unreachable
    </span>
  );
}

function formatChecked(epochMs: number): string {
  const seconds = Math.floor((Date.now() - epochMs) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return new Date(epochMs).toLocaleTimeString();
}

export function StatusPage() {
  const probeIds = SURFACES.filter((s) => s.mode === 'probe').map((s) => s.id);
  const [probes, setProbes] = useState<Record<string, ProbeResult>>(() => {
    const init: Record<string, ProbeResult> = {};
    for (const id of probeIds) init[id] = { status: 'pending' };
    return init;
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const probesToRun = SURFACES.filter((s) => s.mode === 'probe');
    for (const surface of probesToRun) {
      if (!surface.probeUrl) continue;
      const startedAt = performance.now();
      fetch(surface.probeUrl, { cache: 'no-store' })
        .then((response) => {
          if (cancelled) return;
          const latencyMs = Math.round(performance.now() - startedAt);
          const checkedAt = Date.now();
          if (response.ok) {
            setProbes((prev) => ({
              ...prev,
              [surface.id]: { status: 'up', latencyMs, checkedAt },
            }));
          } else {
            setProbes((prev) => ({
              ...prev,
              [surface.id]: {
                status: 'down',
                reason: `HTTP ${response.status}`,
                checkedAt,
              },
            }));
          }
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          const reason =
            error instanceof Error ? error.message : 'Network error reaching the endpoint.';
          setProbes((prev) => ({
            ...prev,
            [surface.id]: { status: 'down', reason, checkedAt: Date.now() },
          }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Tick every 30s to keep "Xs ago" copy fresh without spamming probes.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const probeResults = probeIds.map((id) => probes[id]);
  const anyDown = probeResults.some((r) => r && r.status === 'down');
  const anyPending = probeResults.some((r) => r && r.status === 'pending');
  const overallTitle = anyPending
    ? 'Checking current status…'
    : anyDown
      ? 'Some surfaces are not responding'
      : 'All probed surfaces are operational';
  const overallVariant: 'info' | 'success' | 'warning' = anyPending
    ? 'info'
    : anyDown
      ? 'warning'
      : 'success';

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 pt-24 lg:px-8">
        <Callout variant={overallVariant} title={overallTitle}>
          This page probes the API health endpoint in your browser when you load it. It reflects
          what your network sees right now, not a separate uptime service. Solo-operator company: we
          do not run 24×7 manned monitoring you can subscribe to.{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              setProbes((prev) => {
                const next: Record<string, ProbeResult> = { ...prev };
                for (const id of probeIds) next[id] = { status: 'pending' };
                return next;
              });
              setRefreshKey((k) => k + 1);
            }}
          >
            Re-check now
          </button>
          .
        </Callout>
      </div>

      <section className="mx-auto max-w-3xl px-6 pt-10 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Status</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Live probe and link surface for the four RevealUI properties. Last loaded:{' '}
          {new Date().toLocaleString()}.
        </p>

        <ul className="mt-8 divide-y divide-border rounded-xl ring-1 ring-border">
          {SURFACES.map((surface) => {
            const result = surface.mode === 'probe' ? probes[surface.id] : undefined;
            const state =
              surface.mode === 'self'
                ? ({ kind: 'self' } as const)
                : surface.mode === 'link'
                  ? ({ kind: 'link' } as const)
                  : ({ kind: 'probe', result: result ?? { status: 'pending' } } as const);
            return (
              <li
                key={surface.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{surface.label}</p>
                  <a
                    className="text-sm text-muted-foreground hover:text-foreground"
                    href={surface.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {surface.description}
                  </a>
                  {result && result.status === 'down' && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      {result.reason} · checked {formatChecked(result.checkedAt)}
                    </p>
                  )}
                  {result && result.status === 'up' && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Checked {formatChecked(result.checkedAt)}
                    </p>
                  )}
                </div>
                <div className="shrink-0">{badgeFor(state)}</div>
              </li>
            );
          })}
        </ul>
      </section>

      <article className="mx-auto max-w-3xl px-6 pb-24 pt-12 lg:px-8 prose prose-gray">
        <h2>How we monitor</h2>
        <p>
          RevealUI Studio is a solo-operator company. We run a single API health endpoint that this
          page probes when you load it. We do not currently offer email or SMS subscriptions for
          status changes. Honest answers about what we do and do not have:
        </p>
        <ul>
          <li>
            <strong>What works today.</strong> The probe above reflects current API reachability
            from your browser. Vercel runs its own platform health checks; we receive alerts when
            their checks fail.
          </li>
          <li>
            <strong>What we are watching but not publishing yet.</strong> A separate public uptime
            history with subscribable incident channels (Instatus / BetterStack class) is queued for
            after we have paying customers. Until then, this live-probe page is the honest interim.
          </li>
          <li>
            <strong>What does not exist yet.</strong> A 24×7 on-call rotation. Multi-region
            failover. A separate paid status page domain. We will publish these on this page when
            they ship, not before.
          </li>
        </ul>

        <h2>Incident history</h2>
        <p>
          No incidents have been disclosed here yet. When one occurs, we will post a brief notice
          with timestamps, impact, root cause (once known), and remediation. We commit to disclosing
          real incidents rather than hiding them.
        </p>

        <h2>Are you experiencing an outage?</h2>
        <p>
          If this page shows all surfaces operational but you are still seeing issues, the problem
          is probably between your network and ours, or specific to a feature this page does not
          probe yet. Email <a href={`mailto:${SITE.emails.support}`}>{SITE.emails.support}</a> with
          the URL you hit, the time you first saw the issue, and any error message. We treat outage
          reports as higher priority than standard support email.
        </p>
        <p>
          For confirmed security incidents, follow the <a href="/security">security policy</a>{' '}
          instead. That channel has different SLAs.
        </p>
      </article>
      <Footer />
    </div>
  );
}
