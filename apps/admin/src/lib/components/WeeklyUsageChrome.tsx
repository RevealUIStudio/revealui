'use client';

import { Progress } from '@revealui/presentation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export interface WeeklyUsagePayload {
  used: number;
  quota: number;
  overage: number;
  cycleStart: string;
  resetAt: string;
  weekUsed: number;
  weekStart: string;
  weekResetAt: string;
  percent: number | null;
}

type ChromeState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; data: WeeklyUsagePayload };

function apiOrigin(): string {
  return (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim();
}

function intentForPercent(percent: number | null): 'brand' | 'warning' | 'danger' | 'neutral' {
  if (percent === null) return 'neutral';
  if (percent > 90) return 'danger';
  if (percent > 70) return 'warning';
  return 'brand';
}

function labelFor(data: WeeklyUsagePayload): string {
  if (data.quota < 0) return 'Unlimited';
  if (data.percent === null) return 'No allotment';
  return `${data.percent}%`;
}

function descriptionFor(data: WeeklyUsagePayload): string {
  if (data.quota < 0) {
    return `This week ${data.weekUsed.toLocaleString()} agent tasks. Unlimited.`;
  }
  if (data.percent === null) {
    return 'No agent-task allotment this week.';
  }
  return `This week ${data.weekUsed.toLocaleString()} of ${data.quota.toLocaleString()} agent tasks.`;
}

export function WeeklyUsageChrome({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<ChromeState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiOrigin()}/api/billing/usage`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('usage unavailable'))))
      .then((data: WeeklyUsagePayload) => {
        if (
          typeof data.weekUsed !== 'number' ||
          typeof data.quota !== 'number' ||
          !('percent' in data)
        ) {
          setState({ status: 'unavailable' });
          return;
        }
        setState({ status: 'ready', data });
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setState({ status: 'unavailable' });
      });
    return () => controller.abort();
  }, []);

  if (state.status === 'loading') {
    return (
      <div className={compact ? 'min-w-0 px-2' : 'px-2 py-1'} role="status">
        <span className="text-xs text-muted-foreground">Loading this week's usage</span>
      </div>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <div className={compact ? 'min-w-0 px-2' : 'px-2 py-1'}>
        <span className="text-xs text-muted-foreground">Usage unavailable</span>
      </div>
    );
  }

  const { data } = state;
  const text = labelFor(data);
  const description = descriptionFor(data);
  const intent = intentForPercent(data.percent);

  return (
    <Link
      href="/account/billing"
      className={
        compact
          ? 'flex min-w-0 items-center gap-2 px-2 py-1 no-underline'
          : 'block px-2 py-1.5 no-underline'
      }
      title={description}
      aria-label={`This week's agent-task usage: ${text}. ${description}`}
    >
      <span className="text-xs font-medium tabular-nums text-foreground">{text}</span>
      {data.percent !== null ? (
        <Progress
          value={data.percent}
          max={100}
          size="xs"
          intent={intent}
          label={compact ? undefined : "This week's agent-task usage"}
          className={compact ? 'w-16 shrink-0' : 'mt-1'}
        />
      ) : null}
    </Link>
  );
}
