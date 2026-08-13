'use client';

import { Button } from '@revealui/presentation/server';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SITE_NAME } from '@/lib/utils/siteBranding';

const DISMISSED_KEY = 'revealui-onboarding-dismissed';

type ItemKey = 'agents' | 'agentTasks' | 'pages' | 'products';

interface ChecklistItem {
  key: ItemKey;
  label: string;
  description: string;
  href: string;
}

const items: ChecklistItem[] = [
  {
    key: 'agents',
    label: 'Run your first agent',
    description: 'Talk to an agent and watch it take an action on your behalf.',
    href: '/agents',
  },
  {
    key: 'agentTasks',
    label: 'See the receipt',
    description: 'Every agent action leaves a task record you can inspect.',
    href: '/agent-tasks',
  },
  {
    key: 'pages',
    label: 'Create your first page',
    description: 'Add a homepage, about page, or blog post to get started.',
    href: '/pages',
  },
  {
    key: 'products',
    label: 'Add a product',
    description: 'Set up your first product with pricing and details.',
    href: '/products',
  },
];

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Resolve a boolean from a same-origin admin collections proxy (pages, products). */
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
 * Derive checklist completion from live data rather than click tracking, so
 * the checklist reflects what the account has actually done. Every source
 * fails closed to `false` on its own  -  a 403 from an ungated tier or a
 * network hiccup on one item just leaves that item unchecked, it never
 * throws. `null` is returned only when derivation could not be attempted at
 * all, so the caller falls back to the plain static list.
 */
async function fetchCompletionState(apiUrl: string): Promise<Record<ItemKey, boolean> | null> {
  try {
    const [agentsDone, agentTasksDone, pagesDone, productsDone] = await Promise.all([
      fetch(`${apiUrl}/a2a/agents`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { agents: [] }))
        .then((data: { agents?: unknown[] }) => (data.agents?.length ?? 0) > 0)
        .catch(() => false),
      fetch(`${apiUrl}/a2a/agent-tasks/exists`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : { exists: false }))
        .then((data: { exists?: boolean }) => data.exists ?? false)
        .catch(() => false),
      hasAnyDoc('pages'),
      hasAnyDoc('products'),
    ]);

    return {
      agents: agentsDone,
      agentTasks: agentTasksDone,
      pages: pagesDone,
      products: productsDone,
    };
  } catch {
    return null;
  }
}

export default function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [completion, setCompletion] = useState<Record<ItemKey, boolean> | null>(null);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'https://api.revealui.com').trim();

  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    fetchCompletionState(apiUrl).then((state) => {
      if (!cancelled) setCompletion(state);
    });
    return () => {
      cancelled = true;
    };
  }, [dismissed, apiUrl]);

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // localStorage unavailable  -  dismiss in-memory only
    }
    setDismissed(true);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Getting Started</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Welcome to {SITE_NAME}. Here are a few things to get you going.
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

      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item, index) => {
          const checked = completion?.[item.key] ?? false;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                  checked
                    ? 'border-success bg-success/20 text-success'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {checked ? <span aria-hidden="true">&#10003;</span> : index + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
