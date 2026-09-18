'use client';

import { TIER_LABELS } from '@revealui/contracts/pricing';
import { Button } from '@revealui/presentation/server';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useLicense } from '@/lib/providers/LicenseProvider';
import { SITE_NAME } from '@/lib/utils/siteBranding';
import {
  dismissWalk,
  markWalkStepVisited,
  planHonestyLine,
  readWalkProgress,
  resolveWalkCompletion,
  resolveWalkTier,
  type WalkLiveSignals,
  type WalkStepId,
  walkProgressCounts,
  walkStepsForTier,
  wasWalkDismissed,
} from './onboarding-walk';

const EMPTY_SIGNALS: WalkLiveSignals = {
  hasAgents: false,
  hasAgentTasks: false,
  hasPages: false,
};

/** Resolve a boolean from a same-origin admin collections proxy (pages). */
async function hasAnyDoc(collection: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/collections/${collection}?limit=1&depth=0`, {
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { docs?: unknown[] };
    return (data.docs?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Derive first-day completion from live data rather than click tracking, so
 * the walk reflects what the account has actually done. Every source fails
 * closed to `false` on its own — a 403 from an ungated tier or a network
 * hiccup just leaves that item unchecked.
 */
async function fetchLiveSignals(apiUrl: string): Promise<WalkLiveSignals> {
  try {
    const [hasAgents, hasAgentTasks, hasPages] = await Promise.all([
      fetch(`${apiUrl}/a2a/agents`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { agents: [] }))
        .then((data: { agents?: unknown[] }) => (data.agents?.length ?? 0) > 0)
        .catch(() => false),
      fetch(`${apiUrl}/a2a/agent-tasks/exists`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { exists: false }))
        .then((data: { exists?: boolean }) => data.exists ?? false)
        .catch(() => false),
      hasAnyDoc('pages'),
    ]);
    return { hasAgents, hasAgentTasks, hasPages };
  } catch {
    return EMPTY_SIGNALS;
  }
}

export default function OnboardingChecklist() {
  const license = useLicense();
  const [dismissed, setDismissed] = useState(wasWalkDismissed);
  const [signals, setSignals] = useState<WalkLiveSignals>(EMPTY_SIGNALS);
  const [visited, setVisited] = useState(() => readWalkProgress().visited);
  const [landed, setLanded] = useState(false);
  const [kgEntitled, setKgEntitled] = useState(false);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();
  const walkTier = resolveWalkTier({
    tier: license.tier,
    isLoading: license.isLoading,
    resolveError: license.resolveError,
  });

  useEffect(() => {
    if (dismissed) return;
    const next = markWalkStepVisited('dashboard');
    setVisited(next.visited);
    setLanded(true);
  }, [dismissed]);

  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    fetchLiveSignals(apiUrl).then((state) => {
      if (!cancelled) setSignals(state);
    });
    return () => {
      cancelled = true;
    };
  }, [dismissed, apiUrl]);

  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    fetch('/api/kg/repos', { credentials: 'include' })
      .then((res) => {
        if (!cancelled) setKgEntitled(res.ok);
      })
      .catch(() => {
        if (!cancelled) setKgEntitled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dismissed]);

  const steps = useMemo(() => walkStepsForTier(walkTier, { kgEntitled }), [walkTier, kgEntitled]);
  const completion = useMemo(
    () => resolveWalkCompletion(steps, signals, visited, landed),
    [steps, signals, visited, landed],
  );
  const counts = walkProgressCounts(steps, completion);

  if (dismissed) return null;

  const handleDismiss = () => {
    dismissWalk();
    setDismissed(true);
  };

  const handleVisit = (id: WalkStepId) => {
    const next = markWalkStepVisited(id);
    setVisited(next.visited);
  };

  const planLabel = walkTier ? TIER_LABELS[walkTier] : 'Plan not loaded';

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">First-day walk</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Welcome to {SITE_NAME}. Follow these steps in order. {counts.completed} of{' '}
            {counts.total} complete.
          </p>
          <p className="mt-1 text-sm text-foreground" data-testid="onboarding-plan-honesty">
            <span className="font-medium">{planLabel}.</span> {planHonestyLine(walkTier)}
          </p>
        </div>
        <Button
          type="button"
          appearance="ghost"
          variant="neutral"
          size="sm"
          onClick={handleDismiss}
          className="shrink-0 text-xs text-muted-foreground"
        >
          Dismiss
        </Button>
      </div>

      <ol className="grid list-none gap-2 p-0 sm:grid-cols-2">
        {steps.map((item, index) => {
          const checked = completion[item.id];
          const locked = item.kind === 'locked';

          return (
            <li key={item.id}>
              <Link
                href={item.href}
                onClick={() => handleVisit(item.id)}
                className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                    checked
                      ? 'border-success bg-success/20 text-success'
                      : locked
                        ? 'border-border bg-muted text-muted-foreground'
                        : 'border-border text-muted-foreground'
                  }`}
                >
                  {checked ? <span aria-hidden="true">&#10003;</span> : index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.label}
                    {locked ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">Pro+</span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
