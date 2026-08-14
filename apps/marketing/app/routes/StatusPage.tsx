import { Button, Callout, MarketingSection, SectionHeader } from '@revealui/presentation';
import { useEffect, useState } from 'react';
import { Footer } from '../components/Footer';
import { SITE } from '../content/site';
import {
  STATUS_BADGES,
  STATUS_HERO,
  STATUS_INCIDENTS,
  STATUS_MONITOR,
  STATUS_OUTAGE,
  STATUS_SUMMARY,
  STATUS_SURFACES,
} from '../content/status';

type ProbeResult =
  | { status: 'pending' }
  | { status: 'up'; latencyMs: number; checkedAt: number }
  | { status: 'down'; reason: string; checkedAt: number };

function badgeFor(
  state: { kind: 'self' } | { kind: 'link' } | { kind: 'probe'; result: ProbeResult },
) {
  if (state.kind === 'self') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-success-subtle px-2.5 py-0.5 text-xs font-medium text-success-text ring-1 ring-success/30">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
        {STATUS_BADGES.self}
      </span>
    );
  }
  if (state.kind === 'link') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground" />
        {STATUS_BADGES.link}
      </span>
    );
  }
  const r = state.result;
  if (r.status === 'pending') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
        <span
          aria-hidden="true"
          className="size-1.5 animate-pulse rounded-full bg-muted-foreground"
        />
        {STATUS_BADGES.pending}
      </span>
    );
  }
  if (r.status === 'up') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-success-subtle px-2.5 py-0.5 text-xs font-medium text-success-text ring-1 ring-success/30">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
        Operational · {r.latencyMs}ms
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive ring-1 ring-destructive/30">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />
      {STATUS_BADGES.unreachable}
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
  const probeIds = STATUS_SURFACES.filter((s) => s.mode === 'probe').map((s) => s.id);
  const [probes, setProbes] = useState<Record<string, ProbeResult>>(() => {
    const init: Record<string, ProbeResult> = {};
    for (const id of probeIds) init[id] = { status: 'pending' };
    return init;
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const probesToRun = STATUS_SURFACES.filter((s) => s.mode === 'probe');
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

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const probeResults = probeIds.map((id) => probes[id]);
  const anyDown = probeResults.some((r) => r && r.status === 'down');
  const anyPending = probeResults.some((r) => r && r.status === 'pending');
  const overallTitle = anyPending
    ? STATUS_SUMMARY.pending
    : anyDown
      ? STATUS_SUMMARY.down
      : STATUS_SUMMARY.up;
  const overallVariant: 'info' | 'success' | 'warning' = anyPending
    ? 'info'
    : anyDown
      ? 'warning'
      : 'success';

  return (
    <div className="min-h-screen bg-background">
      <MarketingSection tone="background" density="compact" width="narrow">
        <Callout variant={overallVariant} title={overallTitle}>
          {STATUS_SUMMARY.body}{' '}
          <Button
            type="button"
            appearance="link"
            variant="brand"
            size="sm"
            className="inline h-auto p-0"
            onClick={() => {
              setProbes((prev) => {
                const next: Record<string, ProbeResult> = { ...prev };
                for (const id of probeIds) next[id] = { status: 'pending' };
                return next;
              });
              setRefreshKey((k) => k + 1);
            }}
          >
            {STATUS_SUMMARY.recheck}
          </Button>
          .
        </Callout>
      </MarketingSection>

      <MarketingSection tone="background" density="default" width="narrow">
        <SectionHeader
          title={STATUS_HERO.title}
          description={STATUS_HERO.subtitle}
          titleAs="h1"
          titleClassName="font-display text-4xl sm:text-5xl"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Last loaded: {new Date().toLocaleString()}.
        </p>

        <ul className="mt-8 divide-y divide-border rounded-xl ring-1 ring-border">
          {STATUS_SURFACES.map((surface) => {
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
                    <p className="mt-1 text-xs text-destructive">
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
      </MarketingSection>

      <MarketingSection tone="secondary" density="default" width="narrow">
        <h2 className="font-display text-xl font-semibold text-foreground">
          {STATUS_MONITOR.heading}
        </h2>
        <p className="mt-4 leading-7 text-body">{STATUS_MONITOR.intro}</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-body">
          <li>
            <strong>What works today.</strong> {STATUS_MONITOR.worksToday}
          </li>
          <li>
            <strong>What we are watching but not publishing yet.</strong> {STATUS_MONITOR.watching}
          </li>
          <li>
            <strong>What does not exist yet.</strong> {STATUS_MONITOR.missing}
          </li>
        </ul>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          {STATUS_INCIDENTS.heading}
        </h2>
        <p className="mt-4 leading-7 text-body">{STATUS_INCIDENTS.body}</p>

        <h2 className="mt-10 font-display text-xl font-semibold text-foreground">
          {STATUS_OUTAGE.heading}
        </h2>
        <p className="mt-4 leading-7 text-body">
          {STATUS_OUTAGE.body}{' '}
          <a className="font-medium text-primary underline" href={`mailto:${SITE.emails.support}`}>
            {SITE.emails.support}
          </a>
          .
        </p>
        <p className="mt-4 leading-7 text-body">
          {STATUS_OUTAGE.security} <a href="/security">Security policy</a>.
        </p>
      </MarketingSection>
      <Footer />
    </div>
  );
}
