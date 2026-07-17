'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils/csrf';

interface CurrentNudge {
  id: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}

interface CurrentNudgeResponse {
  success: boolean;
  nudge: CurrentNudge | null;
}

async function fetchCurrentNudge(apiUrl: string): Promise<CurrentNudge | null> {
  try {
    const res = await fetch(`${apiUrl}/nudges/current`, { credentials: 'include' });
    if (!res.ok) return null;
    const data = (await res.json()) as CurrentNudgeResponse;
    return data.nudge ?? null;
  } catch {
    return null;
  }
}

/**
 * One-at-a-time onboarding nudge (GAP-300 §7). Sits next to
 * OnboardingChecklist in the BeforeDashboard slot. Dismissal is a
 * server-tracked snooze, not a localStorage kill switch — see
 * `packages/db/src/schema/nudges.ts`.
 */
export default function OnboardingNudge() {
  const [nudge, setNudge] = useState<CurrentNudge | null>(null);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  useEffect(() => {
    let cancelled = false;
    fetchCurrentNudge(apiUrl).then((current) => {
      if (!cancelled) setNudge(current);
    });
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  if (!nudge) return null;

  const handleDismiss = () => {
    const dismissedId = nudge.id;
    setNudge(null);
    // Best-effort: the nudge stays hidden client-side regardless of whether
    // the server write lands; if it fails, the nudge simply reappears on
    // the next load since no dismissal was recorded.
    void apiFetch(`${apiUrl}/nudges/${dismissedId}/dismiss`, {
      method: 'POST',
      credentials: 'include',
    });
  };

  return (
    <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{nudge.headline}</h2>
          <p className="mt-1 text-sm text-zinc-300">{nudge.body}</p>
          <Link
            href={nudge.ctaHref}
            className="mt-3 inline-block rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            {nudge.ctaLabel}
          </Link>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
